"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { actionSession, runAction, ActionError, type ActionResult } from "@/lib/auth/guard";
import { loadConfig } from "@/lib/config";
import { createShipment, assignCarrier, cancelBooking, saveCustomValues } from "@/lib/engine/booking";
import { shipments, bookings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";

const shipmentSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  customerOrgId: z.number().int().positive().optional(),
  carrierOrgId: z.number().int().positive().nullable().optional(),
  cargoDescription: z.string().trim().min(3, "Describe the cargo in a few words.").max(300),
  cargoTypeId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  uom: z.string().trim().max(40).nullable().optional(),
  blNumber: z.string().trim().max(60).nullable().optional(),
  containerNumber: z.string().trim().max(40).nullable().optional(),
  sealNumber: z.string().trim().max(40).nullable().optional(),
  poNumber: z.string().trim().max(60).nullable().optional(),
  invoiceNumber: z.string().trim().max(60).nullable().optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an expected date."),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  notes: z.string().trim().max(1000).nullable().optional(),
  handlingMinutes: z.number().int().positive().max(600).nullable().optional(),
  customValues: z.record(z.string(), z.string()).optional(),
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

function firstZodError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Please check the form.";
}

export async function createShipmentAction(input: ShipmentInput): Promise<ActionResult<{ shipmentId: number; bookingId: number; reference: string }>> {
  return runAction(async () => {
    const actor = await actionSession("customer", "admin");
    const parsed = shipmentSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(firstZodError(parsed.error));
    const data = parsed.data;
    const customerOrgId = actor.role === "customer" ? actor.organisationId : data.customerOrgId;
    if (!customerOrgId) throw new ActionError("Choose the customer this shipment belongs to.");
    const cfg = await loadConfig();
    const customValues = data.customValues ? Object.fromEntries(Object.entries(data.customValues).map(([k, v]) => [Number(k), v])) : undefined;
    const result = await db.transaction((tx) => createShipment(tx, actor, cfg, { ...data, customerOrgId, customValues }));
    revalidatePath("/customer");
    revalidatePath("/admin");
    revalidatePath("/carrier");
    return { data: { shipmentId: result.shipment.id, bookingId: result.booking.id, reference: result.shipment.reference }, message: `Shipment ${result.shipment.reference} raised.` };
  });
}

export async function assignCarrierAction(shipmentId: number, carrierOrgId: number): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("customer", "admin");
    await db.transaction((tx) => assignCarrier(tx, actor, shipmentId, carrierOrgId));
    revalidatePath("/customer");
    revalidatePath("/admin");
    revalidatePath("/carrier");
    return { message: "Carrier assigned. They have been sent the booking link." };
  });
}

export async function updateShipmentAction(shipmentId: number, input: Partial<ShipmentInput>): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("customer", "admin");
    const [existing] = await db.select().from(shipments).where(eq(shipments.id, shipmentId));
    if (!existing) throw new ActionError("Shipment not found.");
    if (actor.role === "customer" && existing.customerOrgId !== actor.organisationId) throw new ActionError("This shipment does not belong to your organisation.");
    const parsed = shipmentSchema.partial().safeParse(input);
    if (!parsed.success) throw new ActionError(firstZodError(parsed.error));
    const { customValues, customerOrgId: _c, carrierOrgId: _k, direction: _d, ...rest } = parsed.data;
    void _c; void _k; void _d;
    await db.transaction(async (tx) => {
      await tx.update(shipments).set({ ...rest, updatedAt: new Date() }).where(eq(shipments.id, shipmentId));
      if (customValues) await saveCustomValues(tx, "shipment", shipmentId, Object.fromEntries(Object.entries(customValues).map(([k, v]) => [Number(k), v])));
      await writeAudit(tx, { entityType: "shipment", entityId: shipmentId, action: "SHIPMENT_UPDATED", actorUserId: actor.id, before: { cargoDescription: existing.cargoDescription, expectedDate: existing.expectedDate, quantity: existing.quantity }, after: rest });
    });
    revalidatePath("/customer");
    revalidatePath("/admin");
    return { message: "Shipment updated." };
  });
}

export async function cancelShipmentAction(shipmentId: number, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("customer", "admin", "carrier");
    if (!reason.trim()) throw new ActionError("Give a reason for the cancellation.");
    const [b] = await db.select().from(bookings).where(eq(bookings.shipmentId, shipmentId));
    if (!b) throw new ActionError("Booking not found.");
    const cfg = await loadConfig();
    await db.transaction((tx) => cancelBooking(tx, actor, cfg, b.id, reason.trim()));
    revalidatePath("/customer");
    revalidatePath("/admin");
    revalidatePath("/carrier");
    return { message: "Shipment cancelled." };
  });
}
