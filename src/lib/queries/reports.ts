import { and, eq, gte, lt, sql, isNotNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, shipments, organisations, docks, gateEvents } from "@/lib/db/schema";
import type { SiteConfig } from "@/lib/config";
import { siteDateTime, addDaysKey, siteDateKey, timeToMinutes } from "@/lib/time";

export type Range = { from: string; to: string };

function bounds(r: Range) {
  return { start: siteDateTime(r.from, "00:00"), end: siteDateTime(addDaysKey(r.to, 1), "00:00") };
}

export async function trucksPerDay(r: Range) {
  const { start, end } = bounds(r);
  const rows = await db
    .select({ day: sql<string>`to_char(${bookings.arrivedAt} AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')`, direction: shipments.direction, count: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .where(and(isNotNull(bookings.arrivedAt), gte(bookings.arrivedAt, start), lt(bookings.arrivedAt, end)))
    .groupBy(sql`1`, shipments.direction)
    .orderBy(sql`1`);
  const days: Record<string, { day: string; inbound: number; outbound: number }> = {};
  for (let d = r.from; d <= r.to; d = addDaysKey(d, 1)) days[d] = { day: d, inbound: 0, outbound: 0 };
  for (const row of rows) if (days[row.day]) days[row.day][row.direction] = row.count;
  return Object.values(days);
}

export async function turnaroundPerDay(r: Range) {
  const { start, end } = bounds(r);
  const rows = await db
    .select({
      day: sql<string>`to_char(${bookings.gateOutAt} AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')`,
      trucks: sql<number>`count(*)::int`,
      avgGate: sql<number>`round(avg(extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60))::int`,
      avgDock: sql<number>`round(avg(extract(epoch from (${bookings.handlingEndAt} - ${bookings.dockInAt})) / 60))::int`,
      avgHandling: sql<number>`round(avg(extract(epoch from (${bookings.handlingEndAt} - ${bookings.handlingStartAt})) / 60))::int`,
      best: sql<number>`round(min(extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60))::int`,
      worst: sql<number>`round(max(extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60))::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.status, "GATE_OUT"), isNotNull(bookings.arrivedAt), gte(bookings.gateOutAt, start), lt(bookings.gateOutAt, end)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const [overall] = await db
    .select({
      trucks: sql<number>`count(*)::int`,
      avgGate: sql<number>`coalesce(round(avg(extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60)), 0)::int`,
      median: sql<number>`coalesce(round(percentile_cont(0.5) within group (order by extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60)), 0)::int`,
      best: sql<number>`coalesce(round(min(extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60)), 0)::int`,
      worst: sql<number>`coalesce(round(max(extract(epoch from (${bookings.gateOutAt} - ${bookings.arrivedAt})) / 60)), 0)::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.status, "GATE_OUT"), isNotNull(bookings.arrivedAt), gte(bookings.gateOutAt, start), lt(bookings.gateOutAt, end)));
  return { rows, overall };
}

export async function dockUtilisation(r: Range, cfg: SiteConfig) {
  const { start, end } = bounds(r);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const operatingMinutes = (timeToMinutes(cfg.operatingEnd) - timeToMinutes(cfg.operatingStart)) * days;
  const rows = await db
    .select({
      dockId: docks.id,
      code: docks.code,
      name: docks.name,
      trucks: sql<number>`count(${bookings.id})::int`,
      minutes: sql<number>`coalesce(round(sum(extract(epoch from (coalesce(${bookings.handlingEndAt}, ${bookings.gateOutAt}) - ${bookings.dockInAt})) / 60)), 0)::int`,
    })
    .from(docks)
    .leftJoin(bookings, and(eq(bookings.dockId, docks.id), isNotNull(bookings.dockInAt), gte(bookings.dockInAt, start), lt(bookings.dockInAt, end), inArray(bookings.status, ["GATE_OUT", "COMPLETED", "HANDLING", "AT_DOCK"])))
    .groupBy(docks.id, docks.code, docks.name)
    .orderBy(docks.sortOrder);
  return rows.map((x) => ({ ...x, utilisation: operatingMinutes ? Math.min(100, Math.round((x.minutes / operatingMinutes) * 100)) : 0 }));
}

export async function punctuality(r: Range, cfg: SiteConfig) {
  const { start, end } = bounds(r);
  const rows = await db
    .select({ carrier: organisations.name, arrivedAt: bookings.arrivedAt, slotStart: sql<Date>`coalesce(${bookings.originalSlotStart}, ${bookings.slotStart})` })
    .from(bookings)
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .leftJoin(organisations, eq(organisations.id, shipments.carrierOrgId))
    .where(and(isNotNull(bookings.arrivedAt), gte(bookings.arrivedAt, start), lt(bookings.arrivedAt, end)));
  const classify = (arrived: Date, slot: Date) => {
    const diff = (arrived.getTime() - slot.getTime()) / 60_000;
    return diff < -5 ? "early" : diff > cfg.lateToleranceMinutes ? "late" : "on_time";
  };
  const totals = { early: 0, on_time: 0, late: 0 };
  const byCarrier: Record<string, { carrier: string; trucks: number; early: number; on_time: number; late: number; diffSum: number }> = {};
  for (const row of rows) {
    if (!row.arrivedAt || !row.slotStart) continue;
    const slot = new Date(row.slotStart);
    const c = classify(row.arrivedAt, slot);
    totals[c]++;
    const key = row.carrier ?? "Unknown";
    byCarrier[key] ??= { carrier: key, trucks: 0, early: 0, on_time: 0, late: 0, diffSum: 0 };
    byCarrier[key].trucks++;
    byCarrier[key][c]++;
    byCarrier[key].diffSum += (row.arrivedAt.getTime() - slot.getTime()) / 60_000;
  }
  const total = totals.early + totals.on_time + totals.late;
  return { totals, total, byCarrier: Object.values(byCarrier).map((c) => ({ ...c, avgDiff: c.trucks ? Math.round(c.diffSum / c.trucks) : 0 })).sort((a, b) => b.trucks - a.trucks) };
}

export async function noShowsAndCancellations(r: Range) {
  const { start, end } = bounds(r);
  const rows = await db
    .select({ status: bookings.status, carrier: organisations.name, count: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .leftJoin(organisations, eq(organisations.id, shipments.carrierOrgId))
    .where(and(inArray(bookings.status, ["NO_SHOW", "CANCELLED"]), gte(bookings.slotStart, start), lt(bookings.slotStart, end)))
    .groupBy(bookings.status, organisations.name);
  const perCarrier: Record<string, { carrier: string; noShows: number; cancellations: number }> = {};
  for (const row of rows) {
    const key = row.carrier ?? "Unknown";
    perCarrier[key] ??= { carrier: key, noShows: 0, cancellations: 0 };
    if (row.status === "NO_SHOW") perCarrier[key].noShows += row.count;
    else perCarrier[key].cancellations += row.count;
  }
  const totals = Object.values(perCarrier).reduce((a, c) => ({ noShows: a.noShows + c.noShows, cancellations: a.cancellations + c.cancellations }), { noShows: 0, cancellations: 0 });
  return { perCarrier: Object.values(perCarrier).sort((a, b) => b.noShows - a.noShows), totals };
}

export async function exceptionsByType(r: Range) {
  const { start, end } = bounds(r);
  return db
    .select({ type: gateEvents.exceptionType, count: sql<number>`count(*)::int` })
    .from(gateEvents)
    .where(and(eq(gateEvents.eventType, "exception"), gte(gateEvents.occurredAt, start), lt(gateEvents.occurredAt, end)))
    .groupBy(gateEvents.exceptionType);
}

export function defaultRange(): Range {
  const today = siteDateKey();
  return { from: addDaysKey(today, -13), to: today };
}
