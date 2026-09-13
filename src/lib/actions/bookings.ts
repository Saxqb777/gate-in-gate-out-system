"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { actionSession, runAction, ActionError, type ActionResult } from "@/lib/auth/guard";
import { loadConfig } from "@/lib/config";
import { submitBooking, cancelBooking, approveBooking, rejectBooking, reassignBooking, acknowledgeReschedule, getHandlingMinutes } from "@/lib/engine/booking";
import { getAvailability, type AvailabilityResult } from "@/lib/engine/slots";
import { bookings, shipments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const truckSchema = z.object({
  truckPlate: z.string().trim().min(3, "Enter the truck plate.").max(20),
  trailerPlate: z.string().trim().max(20).nullable().optional(),
  driverName: z.string().trim().min(2, "Enter the driver name.").max(80),
  driverMobile: z.string().trim().min(7, "Enter the driver mobile number.").max(25),
  driverIdNumber: z.string().trim().min(5, "Enter the driver Emirates ID or licence number.").max(40),
  truckType: z.string().trim().min(1, "Choose the truck type."),
  capacity: z.string().trim().max(40).nullable().optional(),
  slotId: z.number().int().positive({ message: "Pick a slot." }),
  customValues: z.record(z.string(), z.string()).optional(),
});
export type TruckInput = z.input<typeof truckSchema>;

function revalidateAll() {
  revalidatePath("/carrier");
  revalidatePath("/customer");
  revalidatePath("/admin");
  revalidatePath("/security");
}

export async function getAvailabilityAction(bookingId: number, date: string): Promise<ActionResult<AvailabilityResult>> {
  return runAction(async () => {
    const actor = await actionSession("carrier", "admin");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ActionError("Pick a date.");
    const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!b) throw new ActionError("Booking not found.");
    const [s] = await db.select().from(shipments).where(eq(shipments.id, b.shipmentId));
    if (actor.role === "carrier" && s.carrierOrgId !== actor.organisationId) throw new ActionError("Not your booking.");
    const cfg = await loadConfig();
    const data = await db.transaction(async (tx) => {
      const handlingMinutes = await getHandlingMinutes(tx, s, cfg);
      return getAvailability(tx, cfg, { date, direction: s.direction, handlingMinutes, excludeBookingId: b.id });
    });
    return { data };
  });
}

export async function submitBookingAction(bookingId: number, input: TruckInput): Promise<ActionResult<{ gatePassNumber: string | null; status: string }>> {
  return runAction(async () => {
    const actor = await actionSession("carrier", "admin");
    const parsed = truckSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Please check the form.");
    const cfg = await loadConfig();
    const data = parsed.data;
    const customValues = data.customValues ? Object.fromEntries(Object.entries(data.customValues).map(([k, v]) => [Number(k), v])) : undefined;
    const updated = await db.transaction((tx) => submitBooking(tx, actor, cfg, bookingId, { ...data, customValues }));
    revalidateAll();
    return {
      data: { gatePassNumber: updated.gatePassNumber, status: updated.status },
      message: updated.status === "BOOKED" ? `Booked. Gate pass ${updated.gatePassNumber} issued.` : `Submitted. Gate pass ${updated.gatePassNumber} will be valid once approved.`,
    };
  });
}

export async function cancelBookingAction(bookingId: number, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("carrier", "admin", "customer");
    if (!reason.trim()) throw new ActionError("Give a reason for the cancellation.");
    const cfg = await loadConfig();
    await db.transaction((tx) => cancelBooking(tx, actor, cfg, bookingId, reason.trim()));
    revalidateAll();
    return { message: "Booking cancelled. The slot has been released." };
  });
}

export async function approveBookingAction(bookingId: number): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    await db.transaction((tx) => approveBooking(tx, actor, bookingId));
    revalidateAll();
    return { message: "Booking approved." };
  });
}

export async function rejectBookingAction(bookingId: number, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    if (!reason.trim()) throw new ActionError("Give a reason for the rejection.");
    await db.transaction((tx) => rejectBooking(tx, actor, bookingId, reason.trim()));
    revalidateAll();
    return { message: "Booking rejected and slot released." };
  });
}

export async function reassignBookingAction(bookingId: number, slotId: number, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    if (!reason.trim()) throw new ActionError("Give a reason for moving this booking.");
    const cfg = await loadConfig();
    const r = await db.transaction((tx) => reassignBooking(tx, cfg, bookingId, slotId, { actor, reason: reason.trim() }));
    revalidateAll();
    return { message: `Moved to ${r.newDock?.code}. Carrier and customer have been notified.` };
  });
}

export async function acknowledgeRescheduleAction(bookingId: number): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("carrier", "customer", "admin");
    await db.transaction((tx) => acknowledgeReschedule(tx, actor, bookingId));
    revalidateAll();
    return { message: "Acknowledged." };
  });
}
