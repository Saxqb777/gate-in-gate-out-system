import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { randomBytes } from "crypto";

/** Atomically increments a named counter and returns the new value. Safe under concurrency. */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const res = await tx.execute(
    sql`INSERT INTO reference_sequences ("key", "last_value") VALUES (${key}, 1)
        ON CONFLICT ("key") DO UPDATE SET "last_value" = reference_sequences."last_value" + 1
        RETURNING "last_value"`,
  );
  const row = (res.rows?.[0] ?? (res as unknown as { last_value: number }[])[0]) as { last_value: number };
  return Number(row.last_value);
}

export function pad(n: number, width = 5) {
  return n.toString().padStart(width, "0");
}

/** ALF-INB-2026-00142 */
export async function nextShipmentReference(tx: Tx, siteCode: string, direction: "inbound" | "outbound", year: number) {
  const dir = direction === "inbound" ? "INB" : "OUT";
  const n = await nextSequence(tx, `shipment:${siteCode}:${dir}:${year}`);
  return `${siteCode}-${dir}-${year}-${pad(n)}`;
}

/** GP-2026-00142 */
export async function nextGatePassNumber(tx: Tx, year: number) {
  const n = await nextSequence(tx, `gatepass:${year}`);
  return `GP-${year}-${pad(n)}`;
}

/** Opaque, unguessable token for QR codes and booking links. */
export function opaqueToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}
