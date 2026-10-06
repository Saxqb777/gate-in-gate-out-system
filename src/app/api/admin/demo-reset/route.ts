import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { reloadDemoData } from "@/lib/seed";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Admin only. Reloads the demo bookings, keeping master data. Used by the Demo data box on the Configuration page. */
export async function POST() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ ok: false, error: "Admin sign in required." }, { status: 403 });
  try {
    const log: string[] = [];
    const r = await reloadDemoData(db, (m) => log.push(m));
    await writeAudit(db, { entityType: "config", entityId: 0, action: "DEMO_DATA_RELOADED", actorUserId: user.id, after: { bookings: r.bookings } });
    return NextResponse.json({ ok: true, bookings: r.bookings, log });
  } catch (err) {
    console.error("Demo reset failed", err);
    const msg = err instanceof Error ? err.message : "Demo reset failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
