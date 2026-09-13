"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { actionSession, runAction, ActionError, type ActionResult } from "@/lib/auth/guard";
import { configSettings, docks, organisations, users, customFields, cargoTypes, slots, notifications, bookings } from "@/lib/db/schema";
import { CONFIG_DEFS, loadConfig } from "@/lib/config";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { purgeOpenFutureSlots } from "@/lib/engine/slots";
import { siteDateKey } from "@/lib/time";
import { ACTIVE_STATUSES } from "@/lib/status";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/carrier");
  revalidatePath("/customer");
  revalidatePath("/security");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function saveConfigAction(values: Record<string, string>): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    const before = await loadConfig();
    const slotKeys = ["operating_start", "operating_end", "slot_minutes", "buffer_minutes", "operating_days", "site_timezone"];
    let slotGridChanged = false;
    await db.transaction(async (tx) => {
      for (const def of CONFIG_DEFS) {
        if (!(def.key in values)) continue;
        let v = String(values[def.key] ?? "").trim();
        if (def.type === "number") {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) throw new ActionError(`${def.label} must be a number.`);
          v = String(n);
        } else if (def.type === "boolean") {
          v = v === "true" ? "true" : "false";
        } else if (def.type === "time") {
          if (!/^\d{2}:\d{2}$/.test(v)) throw new ActionError(`${def.label} must be in HH:mm format.`);
        } else if (def.type === "select") {
          if (def.options && !def.options.includes(v)) throw new ActionError(`${def.label} must be one of ${def.options.join(", ")}.`);
        } else if (def.type === "json") {
          try {
            JSON.parse(v);
          } catch {
            throw new ActionError(`${def.label} must be valid JSON.`);
          }
        }
        if (before.raw[def.key] === v) continue;
        if (slotKeys.includes(def.key)) slotGridChanged = true;
        await tx
          .insert(configSettings)
          .values({ key: def.key, value: v, valueType: def.type, group: def.group, label: def.label, description: def.description, sortOrder: def.sortOrder, updatedBy: actor.id, updatedAt: new Date() })
          .onConflictDoUpdate({ target: configSettings.key, set: { value: v, updatedBy: actor.id, updatedAt: new Date() } });
        await writeAudit(tx, { entityType: "config", entityId: 0, action: "CONFIG_CHANGED", actorUserId: actor.id, before: { [def.key]: before.raw[def.key] ?? def.default }, after: { [def.key]: v } });
      }
      const start = timeToMinutes(values.operating_start ?? before.operatingStart);
      const end = timeToMinutes(values.operating_end ?? before.operatingEnd);
      if (start >= end) throw new ActionError("Operating hours end must be after the start.");
      if (slotGridChanged) {
        await purgeOpenFutureSlots(tx, siteDateKey());
      }
    });
    revalidateAdmin();
    return { message: slotGridChanged ? "Settings saved. Open future slots have been regenerated from the new grid. Existing bookings are unchanged." : "Settings saved." };
  });
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ---------------------------------------------------------------------------
// Docks
// ---------------------------------------------------------------------------

const dockSchema = z.object({
  code: z.string().trim().min(2).max(20).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2).max(60),
  type: z.enum(["inbound", "outbound", "both"]),
  status: z.enum(["active", "maintenance", "blocked"]),
  notes: z.string().trim().max(300).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type DockInput = z.input<typeof dockSchema>;

export async function saveDockAction(id: number | null, input: DockInput): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    const parsed = dockSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the dock details.");
    const data = parsed.data;
    await db.transaction(async (tx) => {
      if (id) {
        const [before] = await tx.select().from(docks).where(eq(docks.id, id));
        if (!before) throw new ActionError("Dock not found.");
        await tx.update(docks).set({ ...data, updatedAt: new Date() }).where(eq(docks.id, id));
        if (before.status === "active" && data.status !== "active") {
          const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.dockId, id), sql`${bookings.status} = ANY(${ACTIVE_STATUSES})`, gte(bookings.slotStart, new Date())));
          if (count > 0) {
            await tx.insert(notifications).values({ role: "admin", level: "warning", title: `${data.code} taken out of service with ${count} upcoming booking(s)`, body: "Move those bookings to another dock from the bookings list.", href: `/admin/bookings?dock=${id}` });
          }
          await tx.delete(slots).where(and(eq(slots.dockId, id), eq(slots.status, "open"), gte(slots.slotDate, siteDateKey())));
        }
        await writeAudit(tx, { entityType: "dock", entityId: id, action: "DOCK_UPDATED", actorUserId: actor.id, before: { code: before.code, type: before.type, status: before.status }, after: data });
      } else {
        const [row] = await tx.insert(docks).values(data).returning();
        await writeAudit(tx, { entityType: "dock", entityId: row.id, action: "DOCK_CREATED", actorUserId: actor.id, after: data });
      }
    });
    revalidateAdmin();
    return { message: id ? "Dock updated." : "Dock added." };
  });
}

export async function blockSlotAction(slotId: number, block: boolean, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    await db.transaction(async (tx) => {
      const [s] = await tx.select().from(slots).where(eq(slots.id, slotId)).for("update");
      if (!s) throw new ActionError("Slot not found.");
      if (block && s.status !== "open") throw new ActionError("Only open slots can be blocked.");
      if (!block && s.status !== "blocked") throw new ActionError("That slot is not blocked.");
      await tx.update(slots).set({ status: block ? "blocked" : "open", blockedReason: block ? reason?.trim() || "Blocked by admin" : null }).where(eq(slots.id, slotId));
      await writeAudit(tx, { entityType: "slot", entityId: slotId, action: block ? "SLOT_BLOCKED" : "SLOT_UNBLOCKED", actorUserId: actor.id, reason: reason ?? null, after: { dockId: s.dockId, startsAt: s.startsAt.toISOString() } });
    });
    revalidateAdmin();
    return { message: block ? "Slot blocked." : "Slot reopened." };
  });
}

// ---------------------------------------------------------------------------
// Organisations and users
// ---------------------------------------------------------------------------

const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20).transform((s) => s.toUpperCase()),
  type: z.enum(["customer", "carrier", "internal"]),
  contactName: z.string().trim().max(80).nullable().optional(),
  contactEmail: z.string().trim().email().max(120).nullable().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  tradeLicence: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().default(true),
});
export type OrgInput = z.input<typeof orgSchema>;

export async function saveOrganisationAction(id: number | null, input: OrgInput): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    const parsed = orgSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the organisation details.");
    const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || null };
    await db.transaction(async (tx) => {
      if (id) {
        await tx.update(organisations).set({ ...data, updatedAt: new Date() }).where(eq(organisations.id, id));
        await writeAudit(tx, { entityType: "organisation", entityId: id, action: "ORGANISATION_UPDATED", actorUserId: actor.id, after: data });
      } else {
        const [row] = await tx.insert(organisations).values(data).returning();
        await writeAudit(tx, { entityType: "organisation", entityId: row.id, action: "ORGANISATION_CREATED", actorUserId: actor.id, after: data });
      }
    });
    revalidateAdmin();
    return { message: id ? "Organisation updated." : "Organisation added." };
  });
}

const userSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  role: z.enum(["admin", "carrier", "customer", "security"]),
  organisationId: z.number().int().positive(),
  title: z.string().trim().max(80).nullable().optional(),
  password: z.string().min(8, "Password must be at least 8 characters.").optional().or(z.literal("")),
  active: z.boolean().default(true),
  warehouseOpsView: z.boolean().default(false),
});
export type UserInput = z.input<typeof userSchema>;

export async function saveUserAction(id: number | null, input: UserInput): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    const parsed = userSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the user details.");
    const { password, ...data } = parsed.data;
    const [org] = await db.select().from(organisations).where(eq(organisations.id, data.organisationId));
    if (!org) throw new ActionError("Choose an organisation.");
    if ((data.role === "carrier" && org.type !== "carrier") || (data.role === "customer" && org.type !== "customer") || ((data.role === "admin" || data.role === "security") && org.type !== "internal")) {
      throw new ActionError(`A ${data.role} user must belong to a ${data.role === "admin" || data.role === "security" ? "internal" : data.role} organisation.`);
    }
    await db.transaction(async (tx) => {
      if (id) {
        if (id === actor.id && !data.active) throw new ActionError("You cannot disable your own account.");
        const set: Partial<typeof users.$inferInsert> = { ...data, updatedAt: new Date() };
        if (password) set.passwordHash = await hashPassword(password);
        await tx.update(users).set(set).where(eq(users.id, id));
        await writeAudit(tx, { entityType: "user", entityId: id, action: "USER_UPDATED", actorUserId: actor.id, after: { ...data, passwordChanged: !!password } });
      } else {
        if (!password) throw new ActionError("Set a password for the new user.");
        const [row] = await tx.insert(users).values({ ...data, passwordHash: await hashPassword(password) }).returning();
        await writeAudit(tx, { entityType: "user", entityId: row.id, action: "USER_CREATED", actorUserId: actor.id, after: data });
      }
    });
    revalidateAdmin();
    return { message: id ? "User updated." : "User added." };
  });
}

// ---------------------------------------------------------------------------
// Custom fields and cargo types
// ---------------------------------------------------------------------------

const customFieldSchema = z.object({
  appliesTo: z.enum(["shipment", "booking", "carrier", "customer"]),
  label: z.string().trim().min(2).max(80),
  fieldKey: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, "Field key may only contain lowercase letters, numbers and underscores."),
  fieldType: z.enum(["text", "number", "date", "dropdown", "checkbox", "file"]),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.boolean().default(false),
  visibleToRoles: z.array(z.enum(["admin", "carrier", "customer", "security"])).min(1, "Choose at least one role."),
  helpText: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});
export type CustomFieldInput = z.input<typeof customFieldSchema>;

export async function saveCustomFieldAction(id: number | null, input: CustomFieldInput): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    const parsed = customFieldSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the field details.");
    const { options, ...rest } = parsed.data;
    if (rest.fieldType === "dropdown" && (!options || options.length < 1)) throw new ActionError("Add at least one option for a dropdown field.");
    const data = { ...rest, optionsJson: rest.fieldType === "dropdown" ? options ?? [] : null };
    await db.transaction(async (tx) => {
      if (id) {
        await tx.update(customFields).set(data).where(eq(customFields.id, id));
        await writeAudit(tx, { entityType: "custom_field", entityId: id, action: "CUSTOM_FIELD_UPDATED", actorUserId: actor.id, after: data });
      } else {
        const [row] = await tx.insert(customFields).values(data).returning();
        await writeAudit(tx, { entityType: "custom_field", entityId: row.id, action: "CUSTOM_FIELD_CREATED", actorUserId: actor.id, after: data });
      }
    });
    revalidateAdmin();
    return { message: id ? "Field updated." : "Field added. It now appears on the form." };
  });
}

const cargoTypeSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_]+$/, "Code may only contain capital letters, numbers and underscores."),
  name: z.string().trim().min(2).max(80),
  handlingMinutes: z.number().int().min(5).max(600),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CargoTypeInput = z.input<typeof cargoTypeSchema>;

export async function saveCargoTypeAction(id: number | null, input: CargoTypeInput): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession("admin");
    const parsed = cargoTypeSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the cargo type details.");
    await db.transaction(async (tx) => {
      if (id) {
        await tx.update(cargoTypes).set(parsed.data).where(eq(cargoTypes.id, id));
        await writeAudit(tx, { entityType: "cargo_type", entityId: id, action: "CARGO_TYPE_UPDATED", actorUserId: actor.id, after: parsed.data });
      } else {
        const [row] = await tx.insert(cargoTypes).values(parsed.data).returning();
        await writeAudit(tx, { entityType: "cargo_type", entityId: row.id, action: "CARGO_TYPE_CREATED", actorUserId: actor.id, after: parsed.data });
      }
    });
    revalidateAdmin();
    return { message: id ? "Cargo type updated." : "Cargo type added." };
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationsReadAction(ids: number[]): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await actionSession();
    if (!ids.length) return {};
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(sql`${notifications.id} = ANY(${ids})`, sql`(${notifications.organisationId} = ${actor.organisationId} OR ${notifications.userId} = ${actor.id} OR ${notifications.role} = ${actor.role})`));
    revalidateAdmin();
    return {};
  });
}
