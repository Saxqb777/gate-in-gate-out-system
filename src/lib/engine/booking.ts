import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { bookings, shipments, organisations, cargoTypes, docks, customFieldValues, type Booking, type Shipment } from "@/lib/db/schema";
import type { SiteConfig } from "@/lib/config";
import { ActionError } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { nextGatePassNumber, nextShipmentReference, opaqueToken } from "@/lib/references";
import { writeAudit, bookingSnapshot } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { lockWindow, bookWindow, releaseSlotsForBooking, assertConcurrency } from "./slots";
import { shipmentStatusForBooking, CARRIER_CANCELLABLE, ACTIVE_STATUSES } from "@/lib/status";
import { fmtDateTime } from "@/lib/time";

export async function getHandlingMinutes(tx: Tx, shipment: Pick<Shipment, "handlingMinutes" | "cargoTypeId">, cfg: SiteConfig) {
  if (shipment.handlingMinutes && shipment.handlingMinutes > 0) return shipment.handlingMinutes;
  if (shipment.cargoTypeId) {
    const [ct] = await tx.select().from(cargoTypes).where(eq(cargoTypes.id, shipment.cargoTypeId));
    if (ct?.handlingMinutes) return ct.handlingMinutes;
  }
  return cfg.defaultHandlingMinutes;
}

export async function syncShipmentStatus(tx: Tx, shipmentId: number, bookingStatus: Booking["status"]) {
  await tx
    .update(shipments)
    .set({ status: shipmentStatusForBooking(bookingStatus), updatedAt: new Date() })
    .where(eq(shipments.id, shipmentId));
}

export async function saveCustomValues(tx: Tx, entityType: "shipment" | "booking", entityId: number, values: Record<number, string>) {
  for (const [fieldId, value] of Object.entries(values)) {
    await tx
      .insert(customFieldValues)
      .values({ entityType, entityId, fieldId: Number(fieldId), value })
      .onConflictDoUpdate({
        target: [customFieldValues.entityType, customFieldValues.entityId, customFieldValues.fieldId],
        set: { value, updatedAt: new Date() },
      });
  }
}

// ---------------------------------------------------------------------------
// Shipment creation and carrier assignment
// ---------------------------------------------------------------------------

export type NewShipmentInput = {
  direction: "inbound" | "outbound";
  customerOrgId: number;
  carrierOrgId?: number | null;
  cargoDescription: string;
  cargoTypeId?: number | null;
  quantity?: number | null;
  uom?: string | null;
  blNumber?: string | null;
  containerNumber?: string | null;
  sealNumber?: string | null;
  poNumber?: string | null;
  invoiceNumber?: string | null;
  expectedDate: string;
  priority: "low" | "normal" | "high" | "urgent";
  notes?: string | null;
  handlingMinutes?: number | null;
  customValues?: Record<number, string>;
};

export async function createShipment(tx: Tx, actor: SessionUser, cfg: SiteConfig, input: NewShipmentInput) {
  const year = Number(input.expectedDate.slice(0, 4)) || new Date().getFullYear();
  const reference = await nextShipmentReference(tx, cfg.siteCode, input.direction, year);
  const hasCarrier = !!input.carrierOrgId;
  const [shipment] = await tx
    .insert(shipments)
    .values({
      reference,
      direction: input.direction,
      customerOrgId: input.customerOrgId,
      carrierOrgId: input.carrierOrgId ?? null,
      cargoDescription: input.cargoDescription,
      cargoTypeId: input.cargoTypeId ?? null,
      quantity: input.quantity ?? null,
      uom: input.uom ?? null,
      blNumber: input.blNumber ?? null,
      containerNumber: input.containerNumber ?? null,
      sealNumber: input.sealNumber ?? null,
      poNumber: input.poNumber ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      expectedDate: input.expectedDate,
      priority: input.priority,
      notes: input.notes ?? null,
      handlingMinutes: input.handlingMinutes ?? null,
      status: hasCarrier ? "AWAITING_TRUCK_DETAILS" : "AWAITING_CARRIER",
      createdBy: actor.id,
    })
    .returning();

  const [booking] = await tx
    .insert(bookings)
    .values({
      shipmentId: shipment.id,
      status: hasCarrier ? "AWAITING_TRUCK_DETAILS" : "DRAFT",
      qrToken: opaqueToken(),
      bookingLinkToken: opaqueToken(),
      createdBy: actor.id,
    })
    .returning();

  if (input.customValues) await saveCustomValues(tx, "shipment", shipment.id, input.customValues);

  await writeAudit(tx, {
    entityType: "shipment",
    entityId: shipment.id,
    action: "SHIPMENT_CREATED",
    actorUserId: actor.id,
    after: { reference, direction: input.direction, customerOrgId: input.customerOrgId, carrierOrgId: input.carrierOrgId ?? null, expectedDate: input.expectedDate },
  });

  if (hasCarrier) {
    await notifyCarrierAssigned(tx, shipment, booking, actor);
  }
  return { shipment, booking };
}

async function notifyCarrierAssigned(tx: Tx, shipment: Shipment, booking: Booking, actor: SessionUser) {
  const [customer] = await tx.select().from(organisations).where(eq(organisations.id, shipment.customerOrgId));
  await notify(tx, {
    organisationId: shipment.carrierOrgId,
    level: "info",
    title: `New booking request ${shipment.reference}`,
    body: `${customer?.name ?? "Customer"} has assigned you ${shipment.direction} cargo: ${shipment.cargoDescription}. Expected ${shipment.expectedDate}. Please add truck details and pick a slot.`,
    href: `/carrier/bookings/${booking.id}`,
    entityType: "booking",
    entityId: booking.id,
  });
  await writeAudit(tx, {
    entityType: "shipment",
    entityId: shipment.id,
    action: "CARRIER_ASSIGNED",
    actorUserId: actor.id,
    after: { carrierOrgId: shipment.carrierOrgId, bookingLink: `/book/${booking.bookingLinkToken}` },
  });
}

export async function assignCarrier(tx: Tx, actor: SessionUser, shipmentId: number, carrierOrgId: number) {
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId)).for("update");
  if (!shipment) throw new ActionError("Shipment not found.");
  if (actor.role === "customer" && shipment.customerOrgId !== actor.organisationId) throw new ActionError("You cannot change another customer's shipment.");
  const [booking] = await tx.select().from(bookings).where(eq(bookings.shipmentId, shipmentId));
  if (!booking) throw new ActionError("Booking record missing for this shipment.");
  if (!["DRAFT", "AWAITING_TRUCK_DETAILS"].includes(booking.status)) {
    throw new ActionError("The carrier can only be changed before truck details are submitted.");
  }
  const [carrier] = await tx.select().from(organisations).where(and(eq(organisations.id, carrierOrgId), eq(organisations.type, "carrier")));
  if (!carrier || !carrier.active) throw new ActionError("Please choose an active carrier.");

  const before = { carrierOrgId: shipment.carrierOrgId };
  await tx.update(shipments).set({ carrierOrgId, status: "AWAITING_TRUCK_DETAILS", updatedAt: new Date() }).where(eq(shipments.id, shipmentId));
  await tx.update(bookings).set({ status: "AWAITING_TRUCK_DETAILS", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
  const updated = { ...shipment, carrierOrgId };
  await notifyCarrierAssigned(tx, updated, booking, actor);
  await writeAudit(tx, { entityType: "shipment", entityId: shipmentId, action: "CARRIER_CHANGED", actorUserId: actor.id, before, after: { carrierOrgId } });
  return booking;
}

// ---------------------------------------------------------------------------
// Carrier submits truck details and slot
// ---------------------------------------------------------------------------

export type TruckDetailsInput = {
  truckPlate: string;
  trailerPlate?: string | null;
  driverName: string;
  driverMobile: string;
  driverIdNumber: string;
  truckType: string;
  capacity?: string | null;
  slotId: number;
  customValues?: Record<number, string>;
};

export async function submitBooking(tx: Tx, actor: SessionUser, cfg: SiteConfig, bookingId: number, input: TruckDetailsInput) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  if (!shipment) throw new ActionError("Shipment not found.");
  if (actor.role === "carrier" && shipment.carrierOrgId !== actor.organisationId) throw new ActionError("This booking is not assigned to your company.");
  if (actor.role === "customer" && shipment.customerOrgId !== actor.organisationId) throw new ActionError("This shipment does not belong to your organisation.");
  if (!shipment.carrierOrgId) throw new ActionError("Assign a carrier before entering truck details.");
  if (booking.status !== "AWAITING_TRUCK_DETAILS") throw new ActionError("This booking already has truck details. Cancel it first to rebook.");
  const onBehalf = actor.role !== "carrier";

  const handlingMinutes = await getHandlingMinutes(tx, shipment, cfg);
  const window = await lockWindow(tx, { slotId: input.slotId, handlingMinutes, direction: shipment.direction });
  const now = new Date();
  if (window.slotStart.getTime() - now.getTime() < cfg.minLeadMinutes * 60_000) {
    throw new ActionError(`Slots must be booked at least ${cfg.minLeadMinutes} minutes ahead.`);
  }
  await assertConcurrency(tx, cfg, window, booking.id);

  const year = now.getFullYear();
  const gatePassNumber = booking.gatePassNumber ?? (await nextGatePassNumber(tx, year));
  const status = cfg.approvalRequired ? "PENDING_APPROVAL" : "BOOKED";

  const [updated] = await tx
    .update(bookings)
    .set({
      dockId: window.dockId,
      slotId: window.anchorSlotId,
      slotStart: window.slotStart,
      slotEnd: window.slotEnd,
      originalSlotStart: window.slotStart,
      originalDockId: window.dockId,
      truckPlate: input.truckPlate.trim().toUpperCase(),
      trailerPlate: input.trailerPlate?.trim().toUpperCase() || null,
      driverName: input.driverName.trim(),
      driverMobile: input.driverMobile.trim(),
      driverIdNumber: input.driverIdNumber.trim(),
      truckType: input.truckType,
      capacity: input.capacity?.trim() || null,
      status,
      gatePassNumber,
      bookedAt: now,
      updatedAt: now,
    })
    .where(eq(bookings.id, booking.id))
    .returning();

  await bookWindow(tx, window, booking.id);
  if (input.customValues) await saveCustomValues(tx, "booking", booking.id, input.customValues);
  await syncShipmentStatus(tx, shipment.id, status);

  const [dock] = await tx.select().from(docks).where(eq(docks.id, window.dockId));
  await writeAudit(tx, {
    entityType: "booking",
    entityId: booking.id,
    action: status === "BOOKED" ? "BOOKING_CONFIRMED" : "BOOKING_SUBMITTED_FOR_APPROVAL",
    actorUserId: actor.id,
    before: bookingSnapshot(booking),
    after: bookingSnapshot(updated),
    reason: onBehalf ? `Truck details entered by ${actor.organisationName} on behalf of the carrier` : null,
  });
  const summary = `${dock?.code ?? "a dock"} at ${fmtDateTime(window.slotStart, cfg.siteTimezone)}. Truck ${updated.truckPlate}, driver ${updated.driverName}.`;
  if (onBehalf) {
    await notify(tx, {
      organisationId: shipment.carrierOrgId,
      level: "info",
      title: `${shipment.reference} booked on your behalf`,
      body: `${actor.organisationName} entered the truck details and booked ${summary} Open the booking to print the gate pass.`,
      href: `/carrier/bookings/${booking.id}`,
      entityType: "booking",
      entityId: booking.id,
    });
  }
  if (actor.role !== "customer") {
    await notify(tx, {
      organisationId: shipment.customerOrgId,
      level: "info",
      title: `${shipment.reference} ${status === "BOOKED" ? "booked" : "awaiting approval"}`,
      body: `${actor.organisationName} booked ${summary}`,
      href: `/customer/shipments/${shipment.id}`,
      entityType: "booking",
      entityId: booking.id,
    });
  }
  if (status === "PENDING_APPROVAL") {
    await notify(tx, {
      role: "admin",
      level: "warning",
      title: `Approval needed: ${shipment.reference}`,
      body: `${actor.organisationName} requested ${dock?.code ?? "a dock"} at ${fmtDateTime(window.slotStart, cfg.siteTimezone)}.`,
      href: `/admin/bookings/${booking.id}`,
      entityType: "booking",
      entityId: booking.id,
    });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Cancel, approve, reject, reassign
// ---------------------------------------------------------------------------

export async function cancelBooking(tx: Tx, actor: SessionUser, cfg: SiteConfig, bookingId: number, reason: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  if (!shipment) throw new ActionError("Shipment not found.");

  if (actor.role === "carrier") {
    if (shipment.carrierOrgId !== actor.organisationId) throw new ActionError("This booking is not assigned to your company.");
    if (!CARRIER_CANCELLABLE.includes(booking.status)) throw new ActionError("This booking can no longer be cancelled by the carrier. Contact the warehouse.");
    if (booking.slotStart && booking.slotStart.getTime() - Date.now() < cfg.carrierCancelCutoffMinutes * 60_000) {
      throw new ActionError(`Bookings cannot be cancelled within ${cfg.carrierCancelCutoffMinutes} minutes of the slot. Contact the warehouse.`);
    }
  } else if (actor.role === "customer") {
    if (shipment.customerOrgId !== actor.organisationId) throw new ActionError("This shipment does not belong to your organisation.");
    if (!["DRAFT", "AWAITING_TRUCK_DETAILS", "PENDING_APPROVAL", "BOOKED"].includes(booking.status)) throw new ActionError("This shipment is already in progress and cannot be cancelled here.");
  } else if (actor.role !== "admin") {
    throw new ActionError("Not allowed.");
  }
  if (["CANCELLED", "GATE_OUT", "NO_SHOW", "REJECTED"].includes(booking.status)) throw new ActionError("This booking is already closed.");

  const now = new Date();
  await tx.update(bookings).set({ status: "CANCELLED", cancelledAt: now, cancelReason: reason, updatedAt: now }).where(eq(bookings.id, bookingId));
  await releaseSlotsForBooking(tx, bookingId);
  await syncShipmentStatus(tx, shipment.id, "CANCELLED");
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "BOOKING_CANCELLED", actorUserId: actor.id, before: bookingSnapshot(booking), after: { status: "CANCELLED" }, reason });

  const targets = [shipment.customerOrgId, shipment.carrierOrgId].filter((id): id is number => !!id && id !== actor.organisationId);
  for (const orgId of targets) {
    await notify(tx, {
      organisationId: orgId,
      level: "warning",
      title: `${shipment.reference} cancelled`,
      body: `Cancelled by ${actor.name} (${actor.organisationName}). Reason: ${reason}`,
      href: orgId === shipment.customerOrgId ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${bookingId}`,
      entityType: "booking",
      entityId: bookingId,
    });
  }
}

export async function approveBooking(tx: Tx, actor: SessionUser, bookingId: number) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (booking.status !== "PENDING_APPROVAL") throw new ActionError("Only bookings pending approval can be approved.");
  const now = new Date();
  await tx.update(bookings).set({ status: "BOOKED", approvedBy: actor.id, approvedAt: now, updatedAt: now }).where(eq(bookings.id, bookingId));
  await syncShipmentStatus(tx, booking.shipmentId, "BOOKED");
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "BOOKING_APPROVED", actorUserId: actor.id, before: { status: "PENDING_APPROVAL" }, after: { status: "BOOKED" } });
  await notify(tx, {
    organisationId: shipment.carrierOrgId,
    title: `${shipment.reference} approved`,
    body: `Your booking was approved by ${actor.name}. The gate pass ${booking.gatePassNumber} is now valid.`,
    href: `/carrier/bookings/${bookingId}`,
    entityType: "booking",
    entityId: bookingId,
  });
}

export async function rejectBooking(tx: Tx, actor: SessionUser, bookingId: number, reason: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (booking.status !== "PENDING_APPROVAL") throw new ActionError("Only bookings pending approval can be rejected.");
  const now = new Date();
  await tx.update(bookings).set({ status: "REJECTED", rejectionReason: reason, updatedAt: now }).where(eq(bookings.id, bookingId));
  await releaseSlotsForBooking(tx, bookingId);
  await syncShipmentStatus(tx, booking.shipmentId, "REJECTED");
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "BOOKING_REJECTED", actorUserId: actor.id, before: bookingSnapshot(booking), after: { status: "REJECTED" }, reason });
  for (const orgId of [shipment.carrierOrgId, shipment.customerOrgId]) {
    if (!orgId) continue;
    await notify(tx, {
      organisationId: orgId,
      level: "warning",
      title: `${shipment.reference} rejected`,
      body: `Rejected by ${actor.name}. Reason: ${reason}`,
      href: orgId === shipment.customerOrgId ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${bookingId}`,
      entityType: "booking",
      entityId: bookingId,
    });
  }
}

/** Admin moves a booking to another dock or slot, with a reason. Also used by the system when bumping. */
export async function reassignBooking(
  tx: Tx,
  cfg: SiteConfig,
  bookingId: number,
  slotId: number,
  options: { actor?: SessionUser | null; reason: string; bySystem?: boolean; action?: string },
) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!booking) throw new ActionError("Booking not found.");
  if (!ACTIVE_STATUSES.includes(booking.status) || ["AT_DOCK", "HANDLING"].includes(booking.status)) {
    throw new ActionError("Only bookings that have not reached a dock can be moved.");
  }
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, booking.shipmentId));
  const handlingMinutes = await getHandlingMinutes(tx, shipment, cfg);

  await releaseSlotsForBooking(tx, bookingId);
  // Temporarily clear the range so the DB overlap constraint does not fire against the old window.
  await tx.update(bookings).set({ slotStart: null, slotEnd: null, dockId: null, slotId: null }).where(eq(bookings.id, bookingId));
  const window = await lockWindow(tx, { slotId, handlingMinutes, direction: shipment.direction });
  await assertConcurrency(tx, cfg, window, bookingId);

  const now = new Date();
  const [updated] = await tx
    .update(bookings)
    .set({
      dockId: window.dockId,
      slotId: window.anchorSlotId,
      slotStart: window.slotStart,
      slotEnd: window.slotEnd,
      originalSlotStart: booking.originalSlotStart ?? booking.slotStart,
      originalDockId: booking.originalDockId ?? booking.dockId,
      rescheduledBySystem: options.bySystem ? true : booking.rescheduledBySystem,
      rescheduleReason: options.reason,
      rescheduleAcknowledged: false,
      updatedAt: now,
    })
    .where(eq(bookings.id, bookingId))
    .returning();
  await bookWindow(tx, window, bookingId);

  const [newDock] = await tx.select().from(docks).where(eq(docks.id, window.dockId));
  const [oldDock] = booking.dockId ? await tx.select().from(docks).where(eq(docks.id, booking.dockId)) : [null];
  await writeAudit(tx, {
    entityType: "booking",
    entityId: bookingId,
    action: options.action ?? (options.bySystem ? "RESCHEDULED_BY_SYSTEM" : "BOOKING_REASSIGNED"),
    actorUserId: options.actor?.id ?? null,
    actorLabel: options.bySystem ? "system" : null,
    before: bookingSnapshot(booking),
    after: bookingSnapshot(updated),
    reason: options.reason,
  });

  const title = options.bySystem ? `${shipment.reference} rescheduled by the system` : `${shipment.reference} moved by the warehouse`;
  const body = `Moved from ${oldDock?.code ?? "unassigned"} ${booking.slotStart ? fmtDateTime(booking.slotStart, cfg.siteTimezone) : ""} to ${newDock?.code} ${fmtDateTime(window.slotStart, cfg.siteTimezone)}. Reason: ${options.reason}`;
  for (const orgId of [shipment.carrierOrgId, shipment.customerOrgId]) {
    if (!orgId) continue;
    await notify(tx, {
      organisationId: orgId,
      level: "warning",
      title,
      body,
      href: orgId === shipment.customerOrgId ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${bookingId}`,
      entityType: "booking",
      entityId: bookingId,
    });
  }
  return { updated, window, newDock, oldDock };
}

export async function acknowledgeReschedule(tx: Tx, actor: SessionUser, bookingId: number) {
  await tx.update(bookings).set({ rescheduleAcknowledged: true }).where(eq(bookings.id, bookingId));
  await writeAudit(tx, { entityType: "booking", entityId: bookingId, action: "RESCHEDULE_ACKNOWLEDGED", actorUserId: actor.id });
}

export async function bookingsForStatuses(tx: Tx, statuses: Booking["status"][]) {
  return tx.select().from(bookings).where(inArray(bookings.status, statuses));
}
