import { desc, or, eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/time";

export async function notificationsForUser(user: SessionUser, limit = 30) {
  const rows = await db
    .select()
    .from(notifications)
    .where(or(eq(notifications.organisationId, user.organisationId), eq(notifications.userId, user.id), eq(notifications.role, user.role)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    level: n.level,
    createdAt: fmtDateTime(n.createdAt),
    readAt: n.readAt ? n.readAt.toISOString() : null,
  }));
}

export async function unreadRescheduleNotices(user: SessionUser) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.organisationId, user.organisationId), isNull(notifications.readAt), sql`${notifications.title} ILIKE '%rescheduled%'`))
    .orderBy(desc(notifications.createdAt))
    .limit(5);
}
