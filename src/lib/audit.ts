import { auditLog } from "@/lib/db/schema";
import type { Tx, Db } from "@/lib/db";

export type AuditInput = {
  entityType: "shipment" | "booking" | "dock" | "slot" | "config" | "user" | "organisation" | "custom_field" | "cargo_type";
  entityId: number;
  action: string;
  actorUserId?: number | null;
  actorLabel?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

export async function writeAudit(tx: Tx | Db, input: AuditInput) {
  await tx.insert(auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    actorLabel: input.actorLabel ?? (input.actorUserId ? null : "system"),
    beforeJson: input.before ?? null,
    afterJson: input.after ?? null,
    reason: input.reason ?? null,
  });
}

/** Picks the fields worth recording in before or after snapshots so audit rows stay readable. */
export function bookingSnapshot(b: {
  status?: string | null;
  dockId?: number | null;
  slotStart?: Date | null;
  slotEnd?: Date | null;
  truckPlate?: string | null;
  driverName?: string | null;
}) {
  return {
    status: b.status ?? null,
    dockId: b.dockId ?? null,
    slotStart: b.slotStart ? new Date(b.slotStart).toISOString() : null,
    slotEnd: b.slotEnd ? new Date(b.slotEnd).toISOString() : null,
    truckPlate: b.truckPlate ?? null,
    driverName: b.driverName ?? null,
  };
}
