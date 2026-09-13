import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Tx, Db } from "@/lib/db";
import { bookings, shipments, docks, gateEvents, yardQueue, organisations, cargoTypes, type Booking, type Dock, type Shipment } from "@/lib/db/schema";
import type { SiteConfig } from "@/lib/config";
import { ActionError } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { writeAudit, bookingSnapshot } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { getHandlingMinutes, syncShipmentStatus, reassignBooking } from "./booking";
import { dockAcceptsDirection, nextAvailableWindow, releaseSlotsForBooking } from "./slots";
import { ACTIVE_STATUSES, INSIDE_STATUSES } from "@/lib/status";
import { fmtDateTime, fmtTime } from "@/lib/time";

export type ResolvedBooking = {
  booking: Booking;
  shipment: Shipment;
  dock: Dock | null;
  carrier: { id: number; name: string } | null;
  customer: { id: number; name: string } | null;
  cargoTypeName: string | null;
};

/** Finds a booking by QR token, gate pass number, or shipment reference. */
export async function resolveBooking(tx: Tx | Db, lookup: string): Promise<ResolvedBooking | null> {
  const raw = lookup.trim();
  if (!raw) return null;
  // QR codes carry a URL: take the last path segment as the token.
  const token = raw.includes("/") ? raw.split("/").filter(Boolean).pop()! : raw;
  const upper = token.toUpperCase();

  const rows = await tx
    .select({ booking: bookings, shipment: shipments })
    .from(bookings)
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .where(or(eq(bookings.qrToken, token), eq(bookings.gatePassNumber, upper), eq(shipments.reference, upper)))
    .orderBy(desc(bookings.createdAt))
    .limit(1);
  if (!rows.length) return null;
  const { booking, shipment } = rows[0];
  const [dock] = booking.dockId ? await tx.select().from(docks).where(eq(docks.id, booking.dockId)) : [null];
  const [carrier] = shipment.carrierOrgId ? await tx.select({ id: organisations.id, name: organisations.name }).from(organisations).where(eq(organisations.id, shipment.carrierOrgId)) : [null];
  const [customer] = await tx.select({ id: organisations.id, name: organisations.name }).from(organisations).where(eq(organisations.id, shipment.customerOrgId));
  const [ct] = shipment.cargoTypeId ? await tx.select().from(cargoTypes).where(eq(cargoTypes.id, shipment.cargoTypeId)) : [null];
  return { booking, shipment, dock: dock ?? null, carrier: carrier ?? null, customer: customer ?? null, cargoTypeName: ct?.name ?? null };
}

/** The gate verdict for a booking: GRANTED when the pass is valid for entry now, otherwise CHECK with reasons. */
export function gateVerdict(r: ResolvedBooking, cfg: SiteConfig, now = new Date()) {
  const reasons: string[] = [];
  const b = r.booking;
  if (b.status === "BOOKED") {
    if (b.slotStart) {
      const early = (b.slotStart.getTime() - now.getTime()) / 60_000;
      const late = (now.getTime() - (b.slotEnd?.getTime() ?? b.slotStart.getTime())) / 60_000;
      if (early > cfg.earlyArrivalMaxMinutes) reasons.push(`Arrived ${Math.round(early / 60)} hours before slot. Earlier than allowed, truck will wait in yard.`);
      if (late > cfg.noShowAfterMinutes) reasons.push(`Slot ended ${Math.round(late)} minutes ago.`);
    }
  } else if (b.status === "PENDING_APPROVAL") reasons.push("Booking has not been approved yet.");
  else if (INSIDE_STATUSES.includes(b.status)) reasons.push("Truck is already inside the facility.");
  else if (b.status === "GATE_OUT") reasons.push("This pass has already been used. Truck gated out.");
  else if (b.status === "CANCELLED") reasons.push("Booking was cancelled.");
  else if (b.status === "REJECTED") reasons.push("Booking was rejected.");
  else if (b.status === "NO_SHOW") reasons.push("Booking was marked as a no show.");
  else reasons.push("Booking has no confirmed slot.");
  if (r.dock && r.dock.status !== "active") reasons.push(`Assigned dock ${r.dock.code} is ${r.dock.status}.`);

  const arrival = arrivalClass(b, cfg, now);
  return { verdict: reasons.length ? ("CHECK" as const) : ("GRANTED" as const), reasons, arrival };
}

export function arrivalClass(b: Pick<Booking, "slotStart" | "slotEnd">, cfg: SiteConfig, now = new Date()): "early" | "on_time" | "late" | "unknown" {
  if (!b.slotStart) return "unknown";
  if (now < b.slotStart) return "early";
  if (now.getTime() > b.slotStart.getTime() + cfg.lateToleranceMinutes * 60_000) return "late";
  return "on_time";
}

async function recordEvent(tx: Tx, input: { bookingId: number; eventType: typeof gateEvents.$inferInsert.eventType; actor?: SessionUser | null; dockId?: number | null; note?: string | null; exceptionType?: typeof gateEvents.$inferInsert.exceptionType; at?: Date }) {
  await tx.insert(gateEvents).values({
    bookingId: input.bookingId,
    eventType: input.eventType,
    recordedByUserId: input.actor?.id ?? null,
    dockId: input.dockId ?? null,
    note: input.note ?? null,
    exceptionType: input.exceptionType ?? null,
    occurredAt: input.at ?? new Date(),
  });
}

async function activeDockOccupancy(tx: Tx) {
  return tx
    .select({ dockId: bookings.dockId, bookingId: bookings.id })
    .from(bookings)
    .where(inArray(bookings.status, ["AT_DOCK", "HANDLING", "COMPLETED"]));
}

async function nextYardPosition(tx: Tx) {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${yardQueue.position}), 0)::int` })
    .from(yardQueue)
    .where(isNull(yardQueue.leftAt));
  return (row?.max ?? 0) + 1;
}

async function yardCount(tx: Tx) {
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(yardQueue).where(isNull(yardQueue.leftAt));
  return row?.count ?? 0;
}

export type GateInDecision =
  | { outcome: "dock"; dock: Dock; promoted: boolean; redirected: boolean; bumped: { reference: string; from: string; to: string }[] }
  | { outcome: "yard"; position: number; reason: string };

/**
 * Gate In. Records the arrival, then decides where the truck goes:
 * its own dock if free, an early arrival promotion into another free dock
 * (pushing later bookings when config allows), or the yard queue.
 */
export async function gateIn(tx: Tx, actor: SessionUser, cfg: SiteConfig, bookingId: number, opts: { note?: string; force?: boolean } = {}): Promise<GateInDecision> {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (booking.status !== "BOOKED") {
    if (booking.status === "PENDING_APPROVAL") throw new ActionError("This booking is still waiting for approval. Do not admit the truck.");
    if (INSIDE_STATUSES.includes(booking.status)) throw new ActionError("This truck is already inside the facility.");
    throw new ActionError(`Booking is ${booking.status.replaceAll("_", " ").toLowerCase()} and cannot be gated in.`);
  }
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  const now = new Date();
  const handlingMinutes = await getHandlingMinutes(tx, shipment, cfg);
  const arrival = arrivalClass(booking, cfg, now);
  const minutesEarly = booking.slotStart ? Math.round((booking.slotStart.getTime() - now.getTime()) / 60_000) : 0;

  await tx.update(bookings).set({ status: "ARRIVED", arrivedAt: now, updatedAt: now }).where(eq(bookings.id, bookingId));
  await recordEvent(tx, { bookingId, eventType: "gate_in", actor, note: opts.note ?? `Arrival: ${arrival.replace("_", " ")}${arrival === "early" ? `, ${minutesEarly} min early` : ""}`, at: now });
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "GATE_IN", actorUserId: actor.id, before: bookingSnapshot(booking), after: { status: "ARRIVED", arrival, minutesEarly } });

  const tooEarly = arrival === "early" && minutesEarly > cfg.earlyArrivalMaxMinutes && !opts.force;
  const decision = tooEarly
    ? null
    : await placeTruck(tx, actor, cfg, { ...booking, status: "ARRIVED" }, shipment, handlingMinutes, now, arrival);

  if (decision) return decision;

  const reason = tooEarly ? `Arrived ${minutesEarly} minutes early, beyond the ${cfg.earlyArrivalMaxMinutes} minute limit` : "No compatible dock free";
  return sendToYardInternal(tx, actor, cfg, bookingId, shipment, reason, now);
}

/**
 * Tries to put an arrived truck on a dock. Returns null if it must wait in the yard.
 * Implements the early arrival override the client asked for.
 */
async function placeTruck(
  tx: Tx,
  actor: SessionUser,
  cfg: SiteConfig,
  booking: Booking,
  shipment: Shipment,
  handlingMinutes: number,
  now: Date,
  arrival: ReturnType<typeof arrivalClass>,
): Promise<GateInDecision | null> {
  const windowEnd = new Date(now.getTime() + handlingMinutes * 60_000);
  const occupancy = await activeDockOccupancy(tx);
  const occupiedDockIds = new Set(occupancy.map((o) => o.dockId).filter((d): d is number => d != null));
  const allDocks = await tx.select().from(docks).where(eq(docks.status, "active")).orderBy(asc(docks.sortOrder), asc(docks.code));
  const compatible = allDocks.filter((d) => dockAcceptsDirection(d.type, shipment.direction) && !occupiedDockIds.has(d.id));
  if (!compatible.length) return null;

  // Bookings that hold time on these docks during the handling window, other than this truck.
  const holders = await tx
    .select({ b: bookings, s: shipments })
    .from(bookings)
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .where(
      and(
        inArray(bookings.status, ACTIVE_STATUSES),
        inArray(bookings.dockId, compatible.map((d) => d.id)),
        lt(bookings.slotStart, windowEnd),
        gt(bookings.slotEnd, now),
        sql`${bookings.id} <> ${booking.id}`,
      ),
    );

  const conflictsByDock = new Map<number, typeof holders>();
  for (const d of compatible) conflictsByDock.set(d.id, holders.filter((h) => h.b.dockId === d.id));

  // Site wide concurrency cap.
  const [concurrent] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(inArray(bookings.status, ["AT_DOCK", "HANDLING"])));
  if ((concurrent?.count ?? 0) >= cfg.maxConcurrentTrucks) return null;

  // Not early: the truck goes to its own dock if free, otherwise any free compatible dock.
  const ownDock = compatible.find((d) => d.id === booking.dockId);
  const isEarly = arrival === "early";
  const modeOff = cfg.earlyArrivalMode === "off";

  const freeDocks = compatible.filter((d) => (conflictsByDock.get(d.id) ?? []).length === 0);
  const ordered = [...(ownDock ? [ownDock] : []), ...freeDocks.filter((d) => d.id !== ownDock?.id)];

  // Own dock is always allowed if nothing else is physically there and the only "conflict" is this truck's own later slot.
  let target: Dock | null = null;
  if (ownDock && (conflictsByDock.get(ownDock.id) ?? []).length === 0) target = ownDock;
  else if (!isEarly || !modeOff) target = ordered.find((d) => d.id !== ownDock?.id) ?? null;

  if (isEarly && modeOff && !target) return null;

  let bumped: { reference: string; from: string; to: string }[] = [];
  if (!target && isEarly && cfg.earlyArrivalMode === "bump") {
    // Pick the dock whose holders are all later, unarrived bookings, with the fewest of them.
    const candidates = compatible
      .map((d) => ({ dock: d, conflicts: conflictsByDock.get(d.id) ?? [] }))
      .filter(({ conflicts }) => conflicts.length > 0 && conflicts.every((c) => c.b.status === "BOOKED" && c.b.slotStart! > now))
      .sort((a, b) => a.conflicts.length - b.conflicts.length || (a.dock.id === booking.dockId ? -1 : 0));
    for (const cand of candidates) {
      const moved: { reference: string; from: string; to: string }[] = [];
      let ok = true;
      for (const c of cand.conflicts) {
        const window = await nextAvailableWindow(tx, cfg, {
          direction: c.s.direction,
          handlingMinutes: await getHandlingMinutes(tx, c.s, cfg),
          from: c.b.slotStart!,
          excludeBookingId: c.b.id,
          preferDockId: c.b.dockId,
          avoid: [{ dockId: cand.dock.id, start: now, end: windowEnd }],
        });
        if (!window) {
          ok = false;
          break;
        }
        const r = await reassignBooking(tx, cfg, c.b.id, window.anchorSlotId, {
          reason: `EARLY_ARRIVAL_PROMOTED: ${shipment.reference} arrived early and was moved into ${cand.dock.code}`,
          bySystem: true,
          action: "RESCHEDULED_BY_SYSTEM",
        });
        moved.push({ reference: c.s.reference, from: `${cand.dock.code} ${fmtTime(c.b.slotStart!, cfg.siteTimezone)}`, to: `${r.newDock?.code} ${fmtDateTime(window.slotStart, cfg.siteTimezone)}` });
      }
      if (ok) {
        target = cand.dock;
        bumped = moved;
        break;
      }
    }
  }

  if (!target) return null;

  const promoted = isEarly;
  const redirected = target.id !== booking.dockId;
  // Release the truck's own booked slot rows and re-time the booking to now.
  await releaseSlotsForBooking(tx, booking.id);
  const slotEnd = windowEnd > (booking.slotEnd ?? windowEnd) && target.id === booking.dockId ? windowEnd : windowEnd;
  await tx.update(bookings).set({ slotStart: null, slotEnd: null, dockId: null }).where(eq(bookings.id, booking.id));
  await tx
    .update(bookings)
    .set({
      status: "AT_DOCK",
      dockId: target.id,
      slotStart: now,
      slotEnd,
      originalSlotStart: booking.originalSlotStart ?? booking.slotStart,
      originalDockId: booking.originalDockId ?? booking.dockId,
      earlyArrivalPromoted: isEarly ? true : booking.earlyArrivalPromoted,
      dockInAt: now,
      updatedAt: now,
    })
    .where(eq(bookings.id, booking.id));
  await recordEvent(tx, { bookingId: booking.id, eventType: "dock_in", actor, dockId: target.id, note: isEarly ? `Early arrival promoted into ${target.code}` : redirected ? `Booked dock busy, redirected to ${target.code}` : `Proceed to ${target.code}`, at: now });
  await syncShipmentStatus(tx, shipment.id, "AT_DOCK");
  await writeAudit(tx, {
    entityType: "booking",
    entityId: booking.id,
    action: isEarly ? "EARLY_ARRIVAL_PROMOTED" : "DOCK_ASSIGNED",
    actorUserId: actor.id,
    before: bookingSnapshot(booking),
    after: { status: "AT_DOCK", dockId: target.id, slotStart: now.toISOString(), slotEnd: slotEnd.toISOString(), bumped },
    reason: isEarly ? "EARLY_ARRIVAL_PROMOTED" : null,
  });
  if (isEarly) {
    for (const orgId of [shipment.carrierOrgId, shipment.customerOrgId]) {
      if (!orgId) continue;
      await notify(tx, {
        organisationId: orgId,
        title: `${shipment.reference} arrived early and went straight to ${target.code}`,
        body: `Truck ${booking.truckPlate} was admitted at ${fmtTime(now, cfg.siteTimezone)}, ahead of its ${fmtTime(booking.slotStart!, cfg.siteTimezone)} slot.`,
        href: orgId === shipment.customerOrgId ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${booking.id}`,
        entityType: "booking",
        entityId: booking.id,
      });
    }
  }
  return { outcome: "dock", dock: target, promoted, redirected, bumped };
}

async function sendToYardInternal(tx: Tx, actor: SessionUser, cfg: SiteConfig, bookingId: number, shipment: Shipment, reason: string, now: Date): Promise<GateInDecision> {
  const count = await yardCount(tx);
  const position = await nextYardPosition(tx);
  await tx.insert(yardQueue).values({ bookingId, position, reason, enteredAt: now });
  await tx.update(bookings).set({ status: "IN_YARD", updatedAt: now }).where(eq(bookings.id, bookingId));
  await recordEvent(tx, { bookingId, eventType: "yard_in", actor, note: `${reason}. Yard position ${position}`, at: now });
  await syncShipmentStatus(tx, shipment.id, "IN_YARD");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "SENT_TO_YARD", actorUserId: actor.id, after: { status: "IN_YARD", position }, reason });
  if (count + 1 >= cfg.yardCapacity) {
    await notify(tx, { role: "admin", level: "critical", title: "Yard at capacity", body: `${count + 1} trucks are waiting in the yard. Capacity is ${cfg.yardCapacity}.`, href: "/admin/yard" });
  }
  return { outcome: "yard", position, reason };
}

export async function sendToYard(tx: Tx, actor: SessionUser, cfg: SiteConfig, bookingId: number, note?: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (!["ARRIVED", "AT_DOCK", "EXCEPTION"].includes(booking.status)) throw new ActionError("Only trucks that have arrived or are waiting at a dock can be sent to the yard.");
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  const now = new Date();
  if (booking.status === "AT_DOCK") {
    await recordEvent(tx, { bookingId, eventType: "dock_out", actor, dockId: booking.dockId, note: "Moved off dock to yard", at: now });
  }
  return sendToYardInternal(tx, actor, cfg, bookingId, shipment, note || "Sent to yard by security", now);
}

/** Moves a yard truck to a dock. If dockId is omitted, the first free compatible dock is used. */
export async function callToDock(tx: Tx, actor: SessionUser, cfg: SiteConfig, bookingId: number, dockId?: number | null) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (!["IN_YARD", "ARRIVED", "EXCEPTION"].includes(booking.status)) throw new ActionError("Only trucks waiting in the yard can be called to a dock.");
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  const handlingMinutes = await getHandlingMinutes(tx, shipment, cfg);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + handlingMinutes * 60_000);

  const occupancy = await activeDockOccupancy(tx);
  const occupied = new Set(occupancy.map((o) => o.dockId));
  const allDocks = await tx.select().from(docks).where(eq(docks.status, "active")).orderBy(asc(docks.sortOrder));
  let target: Dock | undefined;
  if (dockId) {
    target = allDocks.find((d) => d.id === dockId);
    if (!target) throw new ActionError("That dock is not active.");
    if (!dockAcceptsDirection(target.type, shipment.direction)) throw new ActionError(`${target.code} does not handle ${shipment.direction} cargo.`);
    if (occupied.has(target.id)) throw new ActionError(`${target.code} is occupied.`);
  } else {
    target = allDocks.find((d) => dockAcceptsDirection(d.type, shipment.direction) && !occupied.has(d.id));
    if (!target) throw new ActionError("No compatible dock is free right now.");
  }
  const holders = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(inArray(bookings.status, ACTIVE_STATUSES), eq(bookings.dockId, target.id), lt(bookings.slotStart, windowEnd), gt(bookings.slotEnd, now), sql`${bookings.id} <> ${bookingId}`));
  if (holders.length) throw new ActionError(`${target.code} has another booking due within the handling window. Choose a different dock or move that booking first.`);

  await releaseSlotsForBooking(tx, bookingId);
  await tx.update(bookings).set({ slotStart: null, slotEnd: null, dockId: null }).where(eq(bookings.id, bookingId));
  await tx
    .update(bookings)
    .set({ status: "AT_DOCK", dockId: target.id, slotStart: now, slotEnd: windowEnd, originalSlotStart: booking.originalSlotStart ?? booking.slotStart, originalDockId: booking.originalDockId ?? booking.dockId, dockInAt: now, updatedAt: now })
    .where(eq(bookings.id, bookingId));
  await tx.update(yardQueue).set({ calledAt: now, leftAt: now, calledToDockId: target.id }).where(and(eq(yardQueue.bookingId, bookingId), isNull(yardQueue.leftAt)));
  await recordEvent(tx, { bookingId, eventType: "yard_out", actor, dockId: target.id, note: `Called to ${target.code}`, at: now });
  await recordEvent(tx, { bookingId, eventType: "dock_in", actor, dockId: target.id, note: `Docked at ${target.code}`, at: now });
  await syncShipmentStatus(tx, shipment.id, "AT_DOCK");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "CALLED_TO_DOCK", actorUserId: actor.id, before: bookingSnapshot(booking), after: { status: "AT_DOCK", dockId: target.id } });
  return target;
}

export async function startHandling(tx: Tx, actor: SessionUser, bookingId: number) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (booking.status !== "AT_DOCK") throw new ActionError("Handling can only start for a truck at a dock.");
  const now = new Date();
  await tx.update(bookings).set({ status: "HANDLING", handlingStartAt: now, updatedAt: now }).where(eq(bookings.id, bookingId));
  await recordEvent(tx, { bookingId, eventType: "handling_start", actor, dockId: booking.dockId, at: now });
  await syncShipmentStatus(tx, booking.shipmentId, "HANDLING");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "HANDLING_STARTED", actorUserId: actor.id, before: { status: booking.status }, after: { status: "HANDLING" } });
}

export async function finishHandling(tx: Tx, actor: SessionUser, bookingId: number, note?: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (!["HANDLING", "AT_DOCK"].includes(booking.status)) throw new ActionError("Only trucks being handled can be completed.");
  const now = new Date();
  await tx.update(bookings).set({ status: "COMPLETED", handlingStartAt: booking.handlingStartAt ?? now, handlingEndAt: now, slotEnd: now, updatedAt: now }).where(eq(bookings.id, bookingId));
  await recordEvent(tx, { bookingId, eventType: "handling_end", actor, dockId: booking.dockId, note, at: now });
  await recordEvent(tx, { bookingId, eventType: "dock_out", actor, dockId: booking.dockId, at: now });
  await syncShipmentStatus(tx, booking.shipmentId, "COMPLETED");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "HANDLING_COMPLETED", actorUserId: actor.id, before: { status: booking.status }, after: { status: "COMPLETED" }, reason: note });
}

export async function gateOut(tx: Tx, actor: SessionUser, bookingId: number, note?: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (!INSIDE_STATUSES.includes(booking.status)) throw new ActionError("This truck is not inside the facility.");
  if (booking.status !== "COMPLETED" && !note?.trim()) {
    throw new ActionError("Handling is not complete. Add a note explaining why the truck is leaving.");
  }
  const now = new Date();
  await tx.update(bookings).set({ status: "GATE_OUT", gateOutAt: now, updatedAt: now }).where(eq(bookings.id, bookingId));
  await tx.update(yardQueue).set({ leftAt: now }).where(and(eq(yardQueue.bookingId, bookingId), isNull(yardQueue.leftAt)));
  await recordEvent(tx, { bookingId, eventType: "gate_out", actor, note, at: now });
  await syncShipmentStatus(tx, booking.shipmentId, "GATE_OUT");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "GATE_OUT", actorUserId: actor.id, before: { status: booking.status }, after: { status: "GATE_OUT" }, reason: note });
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  await notify(tx, {
    organisationId: shipment.customerOrgId,
    title: `${shipment.reference} completed`,
    body: `Truck ${booking.truckPlate} left the facility at ${fmtTime(now)}.`,
    href: `/customer/shipments/${shipment.id}`,
    entityType: "booking",
    entityId: bookingId,
  });
}

export async function flagException(tx: Tx, actor: SessionUser, bookingId: number, exceptionType: NonNullable<typeof gateEvents.$inferInsert.exceptionType>, note: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (["GATE_OUT", "CANCELLED", "REJECTED", "NO_SHOW"].includes(booking.status)) throw new ActionError("This booking is closed.");
  const now = new Date();
  await tx.update(bookings).set({ status: "EXCEPTION", updatedAt: now }).where(eq(bookings.id, bookingId));
  await recordEvent(tx, { bookingId, eventType: "exception", actor, dockId: booking.dockId, exceptionType, note, at: now });
  await syncShipmentStatus(tx, booking.shipmentId, "EXCEPTION");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "EXCEPTION_FLAGGED", actorUserId: actor.id, before: { status: booking.status }, after: { status: "EXCEPTION", exceptionType }, reason: note });
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  await notify(tx, { role: "admin", level: "critical", title: `Exception at gate: ${shipment.reference}`, body: `${exceptionType.replaceAll("_", " ")}. ${note}`, href: `/admin/bookings/${bookingId}`, entityType: "booking", entityId: bookingId });
  for (const orgId of [shipment.carrierOrgId, shipment.customerOrgId]) {
    if (!orgId) continue;
    await notify(tx, { organisationId: orgId, level: "critical", title: `Exception flagged on ${shipment.reference}`, body: `${exceptionType.replaceAll("_", " ")}. ${note}`, href: orgId === shipment.customerOrgId ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${bookingId}`, entityType: "booking", entityId: bookingId });
  }
}

/** Clears an exception so the truck can continue. Admin only. */
export async function clearException(tx: Tx, actor: SessionUser, bookingId: number, resumeAs: "BOOKED" | "ARRIVED" | "IN_YARD" | "AT_DOCK", note: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (booking.status !== "EXCEPTION") throw new ActionError("This booking is not in exception.");
  const now = new Date();
  await tx.update(bookings).set({ status: resumeAs, updatedAt: now }).where(eq(bookings.id, bookingId));
  await syncShipmentStatus(tx, booking.shipmentId, resumeAs);
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "EXCEPTION_CLEARED", actorUserId: actor.id, before: { status: "EXCEPTION" }, after: { status: resumeAs }, reason: note });
}

/** Marks bookings whose slot ended long ago with no gate in as NO_SHOW. Safe to run repeatedly. */
export async function sweepNoShows(tx: Tx, cfg: SiteConfig) {
  const cutoff = new Date(Date.now() - cfg.noShowAfterMinutes * 60_000);
  const stale = await tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "BOOKED"), lt(bookings.slotEnd, cutoff)));
  for (const b of stale) {
    await tx.update(bookings).set({ status: "NO_SHOW", updatedAt: new Date() }).where(eq(bookings.id, b.id));
    await releaseSlotsForBooking(tx, b.id);
    await syncShipmentStatus(tx, b.shipmentId, "NO_SHOW");
    await writeAudit(tx, { entityType: "booking", entityId: b.id, action: "MARKED_NO_SHOW", actorLabel: "system", before: bookingSnapshot(b), after: { status: "NO_SHOW" }, reason: `No gate in ${cfg.noShowAfterMinutes} minutes after slot end` });
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, b.shipmentId));
    for (const orgId of [shipment.carrierOrgId, shipment.customerOrgId]) {
      if (!orgId) continue;
      await notify(tx, { organisationId: orgId, level: "warning", title: `${shipment.reference} marked as no show`, body: `Truck ${b.truckPlate ?? ""} did not arrive for its slot.`, href: orgId === shipment.customerOrgId ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${b.id}`, entityType: "booking", entityId: b.id });
    }
  }
  return stale.length;
}
