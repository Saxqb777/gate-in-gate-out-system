import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { siteDateTime, addDaysKey } from "@/lib/time";

export type AuditFilters = { entityType?: string; action?: string; actor?: string; from?: string; to?: string; search?: string; page?: number; pageSize?: number };

export async function listAudit(f: AuditFilters) {
  const where: SQL[] = [];
  if (f.entityType) where.push(eq(auditLog.entityType, f.entityType));
  if (f.action) where.push(ilike(auditLog.action, `%${f.action}%`));
  if (f.actor) where.push(or(ilike(users.name, `%${f.actor}%`), ilike(auditLog.actorLabel, `%${f.actor}%`))!);
  if (f.from) where.push(gte(auditLog.occurredAt, siteDateTime(f.from, "00:00")));
  if (f.to) where.push(lt(auditLog.occurredAt, siteDateTime(addDaysKey(f.to, 1), "00:00")));
  if (f.search) where.push(or(ilike(auditLog.reason, `%${f.search}%`), sql`${auditLog.afterJson}::text ILIKE ${"%" + f.search + "%"}`)!);
  const pageSize = f.pageSize ?? 50;
  const page = Math.max(1, f.page ?? 1);
  const cond = where.length ? and(...where) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog).leftJoin(users, eq(users.id, auditLog.actorUserId)).where(cond);
  const rows = await db
    .select({ entry: auditLog, actor: { name: users.name } })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(cond)
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, count, page, pageSize };
}

export async function recentAudit(limit = 12) {
  return db.select({ entry: auditLog, actor: { name: users.name } }).from(auditLog).leftJoin(users, eq(users.id, auditLog.actorUserId)).orderBy(desc(auditLog.occurredAt), desc(auditLog.id)).limit(limit);
}

/** Compact "key: before to after" summary of an audit row. */
export function diffSummary(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const out: string[] = [];
  for (const k of keys) {
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    const fmt = (v: unknown) => (v == null ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v));
    out.push(k in b && k in a ? `${k}: ${fmt(bv)} to ${fmt(av)}` : `${k}: ${fmt(av ?? bv)}`);
  }
  return out;
}
