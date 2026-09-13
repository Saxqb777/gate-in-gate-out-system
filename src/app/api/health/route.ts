import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Reports which environment variables are missing and whether the database answers. */
export async function GET() {
  const required = ["DATABASE_URL", "AUTH_SECRET"];
  const optional = ["NEXT_PUBLIC_APP_URL", "CRON_SECRET", "SETUP_SECRET", "SITE_TIMEZONE"];
  const missing = required.filter((k) => !process.env[k]);
  const unset = optional.filter((k) => !process.env[k]);
  let database: "ok" | string = "not checked";
  if (!missing.includes("DATABASE_URL")) {
    try {
      const r = await db.execute(sql`select count(*)::int as users from users`);
      database = `ok, ${(r.rows[0] as { users: number }).users} users`;
    } catch (e) {
      database = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({ ok: missing.length === 0 && database.startsWith("ok"), missing, unset, database }, { status: missing.length ? 503 : 200 });
}
