import { and, asc, desc, eq, gte, lt, inArray, or, sql, ilike, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { bookings, shipments, organisations, docks, cargoTypes, gateEvents, auditLog, users, customFields, customFieldValues, yardQueue, type BookingStatus } from "@/lib/db/schema";
import { siteDateTime, addDaysKey } from "@/lib/time";

export const customerOrg = alias(organisations, "customer_org");
export const carrierOrg = alias(organisations, "carrier_org");

/** The standard joined row used by every list and board. */
export const bookingRowSelect = {
  booking: bookings,
  shipment: shipments,
  customer: { id: customerOrg.id, name: customerOrg.name, code: customerOrg.code },
  carrier: { id: carrierOrg.id, name: carrierOrg.name, code: carrierOrg.code },
  dock: { id: docks.id, code: docks.code, name: docks.name, type: docks.type, status: docks.status },
  cargoType: { id: cargoTypes.id, name: cargoTypes.name, handlingMinutes: cargoTypes.handlingMinutes },
};

export type BookingRow = {
  booking: typeof bookings.$inferSelect;
  shipment: typeof shipments.$inferSelect;
  customer: { id: number; name: string; code: string };
  carrier: { id: number; name: string; code: string } | null;
  dock: { id: number; code: string; name: string; type: "inbound" | "outbound" | "both"; status: string } | null;
  cargoType: { id: number; name: string; handlingMinutes: number } | null;
};

function baseQuery() {
  return db
    .select(bookingRowSelect)
    .from(bookings)
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .innerJoin(customerOrg, eq(customerOrg.id, shipments.customerOrgId))
    .leftJoin(carrierOrg, eq(carrierOrg.id, shipments.carrierOrgId))
    .leftJoin(docks, eq(docks.id, bookings.dockId))
    .leftJoin(cargoTypes, eq(cargoTypes.id, shipments.cargoTypeId));
}

export type BookingFilters = {
  statuses?: BookingStatus[];
  customerOrgId?: number;
  carrierOrgId?: number;
  dockId?: number;
  direction?: "inbound" | "outbound";
  /** yyyy-MM-dd, filters on slot date (or expected date when no slot) */
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  order?: "slot_asc" | "slot_desc" | "created_desc";
};

export async function listBookings(f: BookingFilters = {}): Promise<BookingRow[]> {
  const where: SQL[] = [];
  if (f.statuses?.length) where.push(inArray(bookings.status, f.statuses));
  if (f.customerOrgId) where.push(eq(shipments.customerOrgId, f.customerOrgId));
  if (f.carrierOrgId) where.push(eq(shipments.carrierOrgId, f.carrierOrgId));
  if (f.dockId) where.push(eq(bookings.dockId, f.dockId));
  if (f.direction) where.push(eq(shipments.direction, f.direction));
  const dateFrom = f.date ?? f.dateFrom;
  const dateTo = f.date ? addDaysKey(f.date, 1) : f.dateTo ? addDaysKey(f.dateTo, 1) : undefined;
  if (dateFrom) {
    const from = siteDateTime(dateFrom, "00:00");
    where.push(or(gte(bookings.slotStart, from), and(sql`${bookings.slotStart} IS NULL`, gte(shipments.expectedDate, dateFrom)))!);
  }
  if (dateTo) {
    const to = siteDateTime(dateTo, "00:00");
    where.push(or(lt(bookings.slotStart, to), and(sql`${bookings.slotStart} IS NULL`, lt(shipments.expectedDate, dateTo)))!);
  }
  if (f.search?.trim()) {
    const s = `%${f.search.trim()}%`;
    where.push(or(ilike(shipments.reference, s), ilike(bookings.truckPlate, s), ilike(bookings.driverName, s), ilike(bookings.gatePassNumber, s), ilike(shipments.cargoDescription, s), ilike(carrierOrg.name, s), ilike(customerOrg.name, s), ilike(shipments.containerNumber, s))!);
  }
  const order =
    f.order === "slot_desc"
      ? [desc(sql`coalesce(${bookings.slotStart}, ${shipments.expectedDate}::timestamptz)`), desc(bookings.id)]
      : f.order === "created_desc"
        ? [desc(bookings.createdAt)]
        : [asc(sql`coalesce(${bookings.slotStart}, ${shipments.expectedDate}::timestamptz)`), asc(bookings.id)];
  const q = baseQuery()
    .where(where.length ? and(...where) : undefined)
    .orderBy(...order)
    .limit(f.limit ?? 500);
  return (await q) as BookingRow[];
}

export async function getBookingRow(id: number): Promise<BookingRow | null> {
  const [row] = await baseQuery().where(eq(bookings.id, id));
  return (row as BookingRow) ?? null;
}

export async function getBookingRowByShipment(shipmentId: number): Promise<BookingRow | null> {
  const [row] = await baseQuery().where(eq(bookings.shipmentId, shipmentId)).orderBy(desc(bookings.id));
  return (row as BookingRow) ?? null;
}

export async function getBookingRowByToken(qrToken: string): Promise<BookingRow | null> {
  const [row] = await baseQuery().where(eq(bookings.qrToken, qrToken));
  return (row as BookingRow) ?? null;
}

export async function getBookingRowByLinkToken(token: string): Promise<BookingRow | null> {
  const [row] = await baseQuery().where(eq(bookings.bookingLinkToken, token));
  return (row as BookingRow) ?? null;
}

export async function bookingEvents(bookingId: number) {
  return db
    .select({ event: gateEvents, recordedBy: { name: users.name }, dock: { code: docks.code } })
    .from(gateEvents)
    .leftJoin(users, eq(users.id, gateEvents.recordedByUserId))
    .leftJoin(docks, eq(docks.id, gateEvents.dockId))
    .where(eq(gateEvents.bookingId, bookingId))
    .orderBy(asc(gateEvents.occurredAt), asc(gateEvents.id));
}

export async function bookingAudit(bookingId: number, shipmentId: number) {
  return db
    .select({ entry: auditLog, actor: { name: users.name } })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(or(and(eq(auditLog.entityType, "booking"), eq(auditLog.entityId, bookingId)), and(eq(auditLog.entityType, "shipment"), eq(auditLog.entityId, shipmentId))))
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id));
}

export async function customFieldsFor(appliesTo: "shipment" | "booking" | "carrier" | "customer", role?: string) {
  const rows = await db.select().from(customFields).where(and(eq(customFields.appliesTo, appliesTo), eq(customFields.active, true))).orderBy(asc(customFields.sortOrder), asc(customFields.id));
  return role ? rows.filter((r) => (r.visibleToRoles ?? []).includes(role)) : rows;
}

export async function customValuesFor(entityType: "shipment" | "booking", entityId: number) {
  const rows = await db
    .select({ field: customFields, value: customFieldValues.value })
    .from(customFieldValues)
    .innerJoin(customFields, eq(customFields.id, customFieldValues.fieldId))
    .where(and(eq(customFieldValues.entityType, entityType), eq(customFieldValues.entityId, entityId)))
    .orderBy(asc(customFields.sortOrder));
  return rows;
}

export async function yardEntries() {
  return db
    .select({ entry: yardQueue, ...bookingRowSelect })
    .from(yardQueue)
    .innerJoin(bookings, eq(bookings.id, yardQueue.bookingId))
    .innerJoin(shipments, eq(shipments.id, bookings.shipmentId))
    .innerJoin(customerOrg, eq(customerOrg.id, shipments.customerOrgId))
    .leftJoin(carrierOrg, eq(carrierOrg.id, shipments.carrierOrgId))
    .leftJoin(docks, eq(docks.id, bookings.dockId))
    .leftJoin(cargoTypes, eq(cargoTypes.id, shipments.cargoTypeId))
    .where(sql`${yardQueue.leftAt} IS NULL`)
    .orderBy(asc(yardQueue.position));
}

export async function allDocks() {
  return db.select().from(docks).orderBy(asc(docks.sortOrder), asc(docks.code));
}

export async function allOrganisations(type?: "customer" | "carrier" | "internal") {
  return db
    .select()
    .from(organisations)
    .where(type ? eq(organisations.type, type) : undefined)
    .orderBy(asc(organisations.name));
}

export async function allCargoTypes(activeOnly = true) {
  return db
    .select()
    .from(cargoTypes)
    .where(activeOnly ? eq(cargoTypes.active, true) : undefined)
    .orderBy(asc(cargoTypes.sortOrder), asc(cargoTypes.name));
}

/** Handling minutes for a row, mirroring the engine's rule. */
export function rowHandlingMinutes(row: BookingRow, defaultMinutes: number) {
  return row.shipment.handlingMinutes ?? row.cargoType?.handlingMinutes ?? defaultMinutes;
}
