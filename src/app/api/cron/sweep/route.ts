import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";
import { sweepNoShows } from "@/lib/engine/gate";

export const dynamic = "force-dynamic";

/** Hourly Vercel cron: marks overdue bookings as no shows. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret) {
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const cfg = await loadConfig();
  const marked = await db.transaction((tx) => sweepNoShows(tx, cfg));
  return NextResponse.json({ marked, at: new Date().toISOString() });
}
