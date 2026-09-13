/** Helpers for reading Next 15 page searchParams (already awaited) safely. */
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : undefined;
}

export function numParam(sp: SearchParams, key: string): number | undefined {
  const n = Number(param(sp, key));
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateParam(sp: SearchParams, key: string): string | undefined {
  const v = param(sp, key);
  return v && DATE_RE.test(v) ? v : undefined;
}

/** Rebuilds a query string from the current params with some keys replaced. Empty values drop the key. */
export function withParams(sp: SearchParams, updates: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) params.set(k, s);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v == null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
