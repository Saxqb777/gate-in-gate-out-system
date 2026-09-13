import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { listBookings } from "./bookings";
import type { SessionUser } from "@/lib/auth/roles";
import type { RescheduleNotice } from "@/components/app/reschedule-alert";
import { fmtDateTime } from "@/lib/time";

/** Unacknowledged system reschedules for the user's organisation, for the highlighted dashboard block. */
export async function pendingReschedules(user: SessionUser, linkBase: string): Promise<RescheduleNotice[]> {
  const rows = await listBookings({
    ...(user.role === "carrier" ? { carrierOrgId: user.organisationId } : user.role === "customer" ? { customerOrgId: user.organisationId } : {}),
    statuses: ["PENDING_APPROVAL", "BOOKED", "ARRIVED", "IN_YARD"],
    order: "slot_asc",
  });
  const pending = rows.filter((r) => r.booking.rescheduledBySystem && !r.booking.rescheduleAcknowledged);
  if (!pending.length) return [];
  const notes = await db
    .select({ id: notifications.id, entityId: notifications.entityId })
    .from(notifications)
    .where(and(eq(notifications.organisationId, user.organisationId), isNull(notifications.readAt), inArray(notifications.entityId, pending.map((p) => p.booking.id))));
  return pending.map((r) => ({
    bookingId: r.booking.id,
    reference: r.shipment.reference,
    title: `${r.shipment.reference} rescheduled by the system`,
    body: `now ${r.dock?.code ?? "unassigned"} at ${fmtDateTime(r.booking.slotStart)}${r.booking.originalSlotStart ? `, was ${fmtDateTime(r.booking.originalSlotStart)}` : ""}. ${r.booking.rescheduleReason ?? ""}`,
    href: `${linkBase}/${user.role === "customer" ? r.shipment.id : r.booking.id}`,
    notificationIds: notes.filter((n) => n.entityId === r.booking.id).map((n) => n.id),
  }));
}
