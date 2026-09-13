import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Tx, Db } from "@/lib/db";
import { docks, slots, bookings, type Dock, type Slot } from "@/lib/db/schema";
import type { SiteConfig } from "@/lib/config";
import { siteDateTime, timeToMinutes, minutesToTime, addDaysKey, siteDateKey } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/status";
import { ActionError } from "@/lib/auth/guard";

type Direction = "inbound" | "outbound";

export function dockAcceptsDirection(dockType: Dock["type"], direction: Direction) {
  return dockType === "both" || dockType === direction;
}

/** The slot grid for one day, from config: 06:00 to 22:00, 60 minute slots, 15 minute buffer by default. */
export function slotTemplate(cfg: SiteConfig): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const dayStart = timeToMinutes(cfg.operatingStart);
  const dayEnd = timeToMinutes(cfg.operatingEnd);
  const step = cfg.slotMinutes + cfg.bufferMinutes;
  if (cfg.slotMinutes <= 0 || step <= 0) return out;
  for (let t = dayStart; t + cfg.slotMinutes <= dayEnd; t += step) {
    out.push({ start: minutesToTime(t), end: minutesToTime(t + cfg.slotMinutes) });
  }
  return out;
}

/** ISO weekday 1..7 for a yyyy-MM-dd key. */
export function isoWeekday(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Materialises slot rows for every active dock on a date. Idempotent. */
export async function ensureSlotsForDate(tx: Tx | Db, dateKey: string, cfg: SiteConfig) {
  if (!cfg.operatingDays.includes(isoWeekday(dateKey))) return;
  const dockRows = await tx.select().from(docks).where(eq(docks.status, "active"));
  const template = slotTemplate(cfg);
  if (!dockRows.length || !template.length) return;
  const values = dockRows.flatMap((d) =>
    template.map((t) => ({
      dockId: d.id,
      slotDate: dateKey,
      startTime: t.start,
      endTime: t.end,
      startsAt: siteDateTime(dateKey, t.start, cfg.siteTimezone),
      endsAt: siteDateTime(dateKey, t.end, cfg.siteTimezone),
      status: "open" as const,
    })),
  );
  await tx.insert(slots).values(values).onConflictDoNothing({ target: [slots.dockId, slots.startsAt] });
}

export type AvailabilityDock = {
  dock: Dock;
  slots: (Slot & { available: boolean; reason: string | null })[];
};

export type AvailabilityResult = {
  date: string;
  operatingDay: boolean;
  docks: AvailabilityDock[];
  handlingMinutes: number;
};

/**
 * Lists slots for a date and direction, marking each as available only when the
 * dock type matches, the dock is active, the slot and every slot covered by the
 * handling duration are open, the site wide concurrency cap is not reached and
 * the slot starts after the minimum lead time.
 */
export async function getAvailability(
  tx: Tx | Db,
  cfg: SiteConfig,
  params: { date: string; direction: Direction; handlingMinutes: number; now?: Date; excludeBookingId?: number },
): Promise<AvailabilityResult> {
  const now = params.now ?? new Date();
  const operatingDay = cfg.operatingDays.includes(isoWeekday(params.date));
  if (operatingDay) await ensureSlotsForDate(tx, params.date, cfg);

  const dockRows = await tx.select().from(docks).orderBy(asc(docks.sortOrder), asc(docks.code));
  const slotRows = await tx
    .select()
    .from(slots)
    .where(eq(slots.slotDate, params.date))
    .orderBy(asc(slots.startsAt));

  const dayStart = siteDateTime(params.date, "00:00", cfg.siteTimezone);
  const dayEnd = siteDateTime(addDaysKey(params.date, 1), "00:00", cfg.siteTimezone);
  const activeBookings = await tx
    .select({ id: bookings.id, dockId: bookings.dockId, slotStart: bookings.slotStart, slotEnd: bookings.slotEnd })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ACTIVE_STATUSES),
        lt(bookings.slotStart, dayEnd),
        gte(bookings.slotEnd, dayStart),
      ),
    );

  const minStart = new Date(now.getTime() + cfg.minLeadMinutes * 60_000);
  const result: AvailabilityDock[] = [];

  for (const dock of dockRows) {
    const dockSlots = slotRows.filter((s) => s.dockId === dock.id);
    const compatible = dockAcceptsDirection(dock.type, params.direction);
    const enriched = dockSlots.map((s) => {
      let reason: string | null = null;
      if (!compatible) reason = "Dock does not handle this direction";
      else if (dock.status !== "active") reason = dock.status === "maintenance" ? "Dock under maintenance" : "Dock blocked";
      else if (s.status === "blocked") reason = s.blockedReason ? `Blocked: ${s.blockedReason}` : "Blocked";
      else if (s.status !== "open") reason = "Booked";
      else if (s.startsAt < minStart) reason = s.startsAt < now ? "Past" : "Too close to start";
      else {
        const windowEnd = new Date(s.startsAt.getTime() + params.handlingMinutes * 60_000);
        const covered = dockSlots.filter((c) => c.startsAt >= s.startsAt && c.startsAt < windowEnd);
        if (covered.some((c) => c.status !== "open")) reason = "Not enough free time for handling";
        else if (covered.length && covered[covered.length - 1].endsAt < windowEnd && s.endsAt < windowEnd && !dockSlots.some((c) => c.startsAt >= windowEnd)) {
          // handling window runs past the last slot of the day
          reason = "Handling would run past operating hours";
        } else {
          const concurrent = activeBookings.filter(
            (b) => b.id !== params.excludeBookingId && b.slotStart! < windowEnd && b.slotEnd! > s.startsAt,
          ).length;
          if (concurrent >= cfg.maxConcurrentTrucks) reason = "Site is at maximum trucks for this time";
        }
      }
      return { ...s, available: reason === null, reason };
    });
    result.push({ dock, slots: enriched });
  }

  return { date: params.date, operatingDay, docks: result, handlingMinutes: params.handlingMinutes };
}

export type Window = { slotStart: Date; slotEnd: Date; slotIds: number[]; dockId: number; anchorSlotId: number };

/**
 * Locks the anchor slot and every slot it covers for the handling duration.
 * Throws when any of them is not open. Must be called inside a transaction.
 */
export async function lockWindow(tx: Tx, params: { slotId: number; handlingMinutes: number; direction: Direction }): Promise<Window> {
  const [anchor] = await tx
    .select()
    .from(slots)
    .where(eq(slots.id, params.slotId))
    .for("update");
  if (!anchor) throw new ActionError("That slot no longer exists. Please pick another slot.");

  const [dock] = await tx.select().from(docks).where(eq(docks.id, anchor.dockId));
  if (!dock || dock.status !== "active") throw new ActionError("That dock is not available.");
  if (!dockAcceptsDirection(dock.type, params.direction)) throw new ActionError("That dock does not handle this direction.");

  const windowEnd = new Date(anchor.startsAt.getTime() + params.handlingMinutes * 60_000);
  const covered = await tx
    .select()
    .from(slots)
    .where(and(eq(slots.dockId, anchor.dockId), gte(slots.startsAt, anchor.startsAt), lt(slots.startsAt, windowEnd)))
    .orderBy(asc(slots.startsAt))
    .for("update");

  if (covered.some((c) => c.status !== "open")) {
    throw new ActionError("That slot was taken a moment ago by another booking. Please pick another slot.");
  }
  const lastEnd = covered[covered.length - 1]?.endsAt ?? anchor.endsAt;
  const slotEnd = lastEnd > windowEnd ? lastEnd : windowEnd;
  return { slotStart: anchor.startsAt, slotEnd, slotIds: covered.map((c) => c.id), dockId: anchor.dockId, anchorSlotId: anchor.id };
}

/** Marks the window's slot rows as booked. The conditional update guarantees nobody else took them between lock and write. */
export async function bookWindow(tx: Tx, window: Window, bookingId: number) {
  const res = await tx
    .update(slots)
    .set({ status: "booked", bookingId })
    .where(and(inArray(slots.id, window.slotIds), eq(slots.status, "open")));
  if ((res.rowCount ?? 0) !== window.slotIds.length) {
    throw new ActionError("That slot was taken a moment ago by another booking. Please pick another slot.");
  }
}

export async function releaseSlotsForBooking(tx: Tx | Db, bookingId: number) {
  await tx.update(slots).set({ status: "open", bookingId: null }).where(eq(slots.bookingId, bookingId));
}

/** Throws when the site wide concurrency cap would be exceeded for a window. */
export async function assertConcurrency(tx: Tx, cfg: SiteConfig, window: { slotStart: Date; slotEnd: Date }, excludeBookingId?: number) {
  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ACTIVE_STATUSES),
        lt(bookings.slotStart, window.slotEnd),
        sql`${bookings.slotEnd} > ${window.slotStart}`,
        excludeBookingId ? sql`${bookings.id} <> ${excludeBookingId}` : sql`true`,
      ),
    );
  if ((rows[0]?.count ?? 0) >= cfg.maxConcurrentTrucks) {
    throw new ActionError("The site is already at its maximum number of trucks for that time.");
  }
}

/**
 * Finds the first bookable window on any compatible dock at or after `from`.
 * Used when the system has to push a booking to the next available slot.
 * `avoid` is a list of intervals per dock that must not be overlapped
 * (for example the window an early truck has just been promoted into).
 */
export async function nextAvailableWindow(
  tx: Tx,
  cfg: SiteConfig,
  params: {
    direction: Direction;
    handlingMinutes: number;
    from: Date;
    excludeBookingId?: number;
    preferDockId?: number | null;
    avoid?: { dockId: number; start: Date; end: Date }[];
    maxDays?: number;
  },
): Promise<Window | null> {
  const maxDays = params.maxDays ?? Math.max(cfg.bookingHorizonDays, 7);
  let dateKey = siteDateKey(params.from, cfg.siteTimezone);
  for (let i = 0; i < maxDays; i++) {
    const availability = await getAvailability(tx, cfg, {
      date: dateKey,
      direction: params.direction,
      handlingMinutes: params.handlingMinutes,
      now: new Date(params.from.getTime() - cfg.minLeadMinutes * 60_000),
      excludeBookingId: params.excludeBookingId,
    });
    const candidates: { slot: Slot; dockId: number; sortOrder: number }[] = [];
    for (const d of availability.docks) {
      for (const s of d.slots) {
        if (!s.available) continue;
        if (s.startsAt < params.from) continue;
        const windowEnd = new Date(s.startsAt.getTime() + params.handlingMinutes * 60_000);
        const clash = (params.avoid ?? []).some((a) => a.dockId === d.dock.id && a.start < windowEnd && a.end > s.startsAt);
        if (clash) continue;
        candidates.push({ slot: s, dockId: d.dock.id, sortOrder: d.dock.sortOrder });
      }
    }
    candidates.sort((a, b) => {
      const t = a.slot.startsAt.getTime() - b.slot.startsAt.getTime();
      if (t !== 0) return t;
      if (params.preferDockId) {
        if (a.dockId === params.preferDockId) return -1;
        if (b.dockId === params.preferDockId) return 1;
      }
      return a.sortOrder - b.sortOrder;
    });
    for (const c of candidates) {
      try {
        return await lockWindow(tx, { slotId: c.slot.id, handlingMinutes: params.handlingMinutes, direction: params.direction });
      } catch {
        continue;
      }
    }
    dateKey = addDaysKey(dateKey, 1);
  }
  return null;
}

/** Removes open, unbooked future slots so they regenerate from the new config on next use. */
export async function purgeOpenFutureSlots(tx: Tx | Db, fromDateKey: string) {
  await tx.delete(slots).where(and(gte(slots.slotDate, fromDateKey), eq(slots.status, "open")));
}
