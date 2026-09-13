"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionSession, runAction, ActionError, type ActionResult } from "@/lib/auth/guard";
import { loadConfig } from "@/lib/config";
import { resolveBooking, gateVerdict, gateIn, sendToYard, callToDock, startHandling, finishHandling, gateOut, flagException, clearException, sweepNoShows, type GateInDecision } from "@/lib/engine/gate";
import type { ExceptionType } from "@/lib/db/schema";

function revalidateLive() {
  revalidatePath("/security");
  revalidatePath("/admin");
  revalidatePath("/carrier");
  revalidatePath("/customer");
}

export type LookupResult = {
  bookingId: number;
  verdict: "GRANTED" | "CHECK";
  reasons: string[];
  arrival: "early" | "on_time" | "late" | "unknown";
  reference: string;
  gatePassNumber: string | null;
  status: string;
  truckPlate: string | null;
  trailerPlate: string | null;
  driverName: string | null;
  driverMobile: string | null;
  driverIdNumber: string | null;
  truckType: string | null;
  carrier: string | null;
  customer: string | null;
  cargo: string;
  cargoType: string | null;
  quantity: string;
  direction: "inbound" | "outbound";
  slotStart: string | null;
  slotEnd: string | null;
  dockCode: string | null;
  dockName: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  priority: string;
};

export async function lookupBookingAction(lookup: string): Promise<ActionResult<LookupResult>> {
  return runAction(async () => {
    await actionSession("security", "admin");
    const r = await resolveBooking(db, lookup);
    if (!r) throw new ActionError("No booking matches that code. Check the reference and try again.");
    const cfg = await loadConfig();
    const v = gateVerdict(r, cfg);
    const b = r.booking;
    const displaySlot = b.originalSlotStart && b.slotStart && b.slotEnd && b.originalSlotStart.getTime() !== b.slotStart.getTime()
      ? { start: b.originalSlotStart, end: new Date(b.originalSlotStart.getTime() + (b.slotEnd.getTime() - b.slotStart.getTime())) }
      : { start: b.slotStart, end: b.slotEnd };
    return {
      data: {
        bookingId: r.booking.id,
        verdict: v.verdict,
        reasons: v.reasons,
        arrival: v.arrival,
        reference: r.shipment.reference,
        gatePassNumber: r.booking.gatePassNumber,
        status: r.booking.status,
        truckPlate: r.booking.truckPlate,
        trailerPlate: r.booking.trailerPlate,
        driverName: r.booking.driverName,
        driverMobile: r.booking.driverMobile,
        driverIdNumber: r.booking.driverIdNumber,
        truckType: r.booking.truckType,
        carrier: r.carrier?.name ?? null,
        customer: r.customer?.name ?? null,
        cargo: r.shipment.cargoDescription,
        cargoType: r.cargoTypeName,
        quantity: r.shipment.quantity != null ? `${r.shipment.quantity} ${r.shipment.uom ?? ""}`.trim() : "",
        direction: r.shipment.direction,
        slotStart: displaySlot.start?.toISOString() ?? null,
        slotEnd: displaySlot.end?.toISOString() ?? null,
        dockCode: r.dock?.code ?? null,
        dockName: r.dock?.name ?? null,
        containerNumber: r.shipment.containerNumber,
        sealNumber: r.shipment.sealNumber,
        priority: r.shipment.priority,
      },
    };
  });
}

export type GateInResult = { outcome: "dock"; dockCode: string; dockName: string; promoted: boolean; redirected: boolean; bumped: { reference: string; from: string; to: string }[] } | { outcome: "yard"; position: number; reason: string };

export async function gateInAction(bookingId: number, note?: string, force?: boolean): Promise<ActionResult<GateInResult>> {
  return runAction<GateInResult>(async () => {
    const actor = await actionSession("security", "admin");
    const cfg = await loadConfig();
    const d: GateInDecision = await db.transaction((tx) => gateIn(tx, actor, cfg, bookingId, { note, force }));
    revalidateLive();
    if (d.outcome === "dock") {
      const data: GateInResult = { outcome: "dock", dockCode: d.dock.code, dockName: d.dock.name, promoted: d.promoted, redirected: d.redirected, bumped: d.bumped };
      return { data, message: d.promoted ? `Gated in. Early arrival, proceed straight to ${d.dock.code}.` : d.redirected ? `Gated in. Booked dock busy, proceed to ${d.dock.code}.` : `Gated in. Proceed to ${d.dock.code}.` };
    }
    const data: GateInResult = { outcome: "yard", position: d.position, reason: d.reason };
    return { data, message: `Gated in. Wait in yard, position ${d.position}.` };
  });
}

export async function sendToYardAction(bookingId: number, note?: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("security", "admin");
    const cfg = await loadConfig();
    const d = await db.transaction((tx) => sendToYard(tx, actor, cfg, bookingId, note));
    revalidateLive();
    return { message: d.outcome === "yard" ? `Sent to yard, position ${d.position}.` : "Sent to yard." };
  });
}

export async function callToDockAction(bookingId: number, dockId?: number | null): Promise<ActionResult<{ dockCode: string }>> {
  return runAction(async () => {
    const actor = await actionSession("security", "admin");
    const cfg = await loadConfig();
    const dock = await db.transaction((tx) => callToDock(tx, actor, cfg, bookingId, dockId));
    revalidateLive();
    return { data: { dockCode: dock.code }, message: `Called to ${dock.code}.` };
  });
}

export async function startHandlingAction(bookingId: number): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin", "security");
    await db.transaction((tx) => startHandling(tx, actor, bookingId));
    revalidateLive();
    return { message: "Handling started." };
  });
}

export async function finishHandlingAction(bookingId: number, note?: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin", "security");
    await db.transaction((tx) => finishHandling(tx, actor, bookingId, note));
    revalidateLive();
    return { message: "Handling complete. Truck can proceed to the gate." };
  });
}

export async function gateOutAction(bookingId: number, note?: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("security", "admin");
    await db.transaction((tx) => gateOut(tx, actor, bookingId, note));
    revalidateLive();
    return { message: "Gated out. Truck has left the facility." };
  });
}

export async function flagExceptionAction(bookingId: number, exceptionType: ExceptionType, note: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("security", "admin");
    if (!note.trim()) throw new ActionError("Add a note describing the problem.");
    await db.transaction((tx) => flagException(tx, actor, bookingId, exceptionType, note.trim()));
    revalidateLive();
    return { message: "Exception flagged. Admin has been notified." };
  });
}

export async function clearExceptionAction(bookingId: number, resumeAs: "BOOKED" | "ARRIVED" | "IN_YARD" | "AT_DOCK", note: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    if (!note.trim()) throw new ActionError("Add a note explaining the decision.");
    await db.transaction((tx) => clearException(tx, actor, bookingId, resumeAs, note.trim()));
    revalidateLive();
    return { message: "Exception cleared." };
  });
}

export async function sweepNoShowsAction(): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    await actionSession("admin");
    const cfg = await loadConfig();
    const count = await db.transaction((tx) => sweepNoShows(tx, cfg));
    revalidateLive();
    return { data: { count }, message: count ? `${count} booking(s) marked as no show.` : "No overdue bookings found." };
  });
}
