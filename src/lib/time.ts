import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { addMinutes, differenceInMinutes } from "date-fns";

export const SITE_TZ = process.env.SITE_TIMEZONE || "Asia/Dubai";

/** Build a UTC Date from a site-local date (yyyy-MM-dd) and time (HH:mm). */
export function siteDateTime(dateStr: string, timeStr: string, tz = SITE_TZ): Date {
  return fromZonedTime(`${dateStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`, tz);
}

export function fmtDate(d: Date | string | null | undefined, tz = SITE_TZ) {
  if (!d) return "";
  return formatInTimeZone(new Date(d), tz, "dd MMM yyyy");
}

export function fmtTime(d: Date | string | null | undefined, tz = SITE_TZ) {
  if (!d) return "";
  return formatInTimeZone(new Date(d), tz, "HH:mm");
}

export function fmtDateTime(d: Date | string | null | undefined, tz = SITE_TZ) {
  if (!d) return "";
  return formatInTimeZone(new Date(d), tz, "dd MMM yyyy, HH:mm");
}

export function fmtDateTimeSeconds(d: Date | string | null | undefined, tz = SITE_TZ) {
  if (!d) return "";
  return formatInTimeZone(new Date(d), tz, "dd MMM yyyy, HH:mm:ss");
}

/** yyyy-MM-dd for a date in site time. */
export function siteDateKey(d: Date = new Date(), tz = SITE_TZ) {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

/** HH:mm for a date in site time. */
export function siteTimeKey(d: Date = new Date(), tz = SITE_TZ) {
  return formatInTimeZone(d, tz, "HH:mm");
}

export function toSiteZone(d: Date, tz = SITE_TZ) {
  return toZonedTime(d, tz);
}

export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function minutesBetween(a: Date | string, b: Date | string) {
  return differenceInMinutes(new Date(b), new Date(a));
}

export function plusMinutes(d: Date, m: number) {
  return addMinutes(d, m);
}

export function humanDuration(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return "";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number) {
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
