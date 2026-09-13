import { NextResponse } from "next/server";
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/lib/db";
import { runSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One time setup for a fresh deployment: runs migrations and loads the demo data.
 * Protected by SETUP_SECRET. Calling it again resets the demo data.
 *   curl -X POST https://<app>/api/setup -H "Authorization: Bearer $SETUP_SECRET"
 *   or open https://<app>/api/setup?token=$SETUP_SECRET in a browser
 */
export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) return NextResponse.json({ error: "SETUP_SECRET is not configured" }, { status: 503 });
  const url = new URL(req.url);
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("token");
  if (provided !== secret) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const log: string[] = [];
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  log.push("Migrations applied.");
  if (url.searchParams.get("seed") !== "false") {
    const r = await runSeed(db, (m) => log.push(m));
    log.push(`Seeded ${r.bookings} bookings.`);
  }
  return NextResponse.json({ ok: true, log });
}
