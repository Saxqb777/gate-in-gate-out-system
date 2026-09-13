import { notifications } from "@/lib/db/schema";
import type { Tx, Db } from "@/lib/db";

export type NotifyInput = {
  organisationId?: number | null;
  userId?: number | null;
  role?: "admin" | "carrier" | "customer" | "security" | null;
  level?: "info" | "warning" | "critical";
  title: string;
  body: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: number | null;
};

export async function notify(tx: Tx | Db, input: NotifyInput) {
  await tx.insert(notifications).values({
    organisationId: input.organisationId ?? null,
    userId: input.userId ?? null,
    role: input.role ?? null,
    level: input.level ?? "info",
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });
}
