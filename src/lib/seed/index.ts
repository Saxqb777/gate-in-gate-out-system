import { sql, eq, and, gte, lt, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as schema from "@/lib/db/schema";
import { CONFIG_DEFS, loadConfig } from "@/lib/config";
import { ensureSlotsForDate } from "@/lib/engine/slots";
import { siteDateKey, addDaysKey, siteDateTime, fmtDateTime } from "@/lib/time";
import type { Db } from "@/lib/db";

const { organisations, users, docks, cargoTypes, configSettings, customFields, customFieldValues, shipments, bookings, slots, gateEvents, yardQueue, auditLog, notifications, sequences } = schema;

// Deterministic pseudo random so the demo looks the same every run.
let seedState = 20260913;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function token() {
  return randomBytes(24).toString("base64url");
}
function pad(n: number) {
  return n.toString().padStart(5, "0");
}

const PASSWORD = "Foah@2026";

/** Go live reset: wipes operational data, keeps organisations, users, docks, cargo types, config and custom fields. */
export async function cleanTransactionalData(db: Db) {
  await db.execute(sql`TRUNCATE TABLE custom_field_values, notifications, audit_log, yard_queue, gate_events, slots, bookings, shipments, reference_sequences RESTART IDENTITY CASCADE`);
}

async function reset(db: Db) {
  await db.execute(sql`TRUNCATE TABLE custom_field_values, custom_fields, notifications, audit_log, yard_queue, gate_events, slots, bookings, shipments, cargo_types, users, docks, organisations, config_settings, reference_sequences RESTART IDENTITY CASCADE`);
}

async function seedStatic(db: Db) {
  const [agthia, alWafi, emirates, agthiaFleet, alFoah, grandMills] = await db
    .insert(organisations)
    .values([
      { name: "Agthia Group, Al Foah Warehouse", code: "AGTHIA", type: "internal", contactName: "Warehouse Control", contactEmail: "warehouse@agthia.ae", contactPhone: "+971 3 700 0000", address: "Al Foah, Al Ain, Abu Dhabi" },
      { name: "Al Wafi Transport LLC", code: "ALWAFI", type: "carrier", contactName: "Rashid Al Mansoori", contactEmail: "ops@alwafi-transport.ae", contactPhone: "+971 50 111 2233", address: "Industrial Area 2, Al Ain", tradeLicence: "CN-1187734" },
      { name: "Emirates Haulage", code: "EMHAUL", type: "carrier", contactName: "Priya Nair", contactEmail: "ops@emirates-haulage.ae", contactPhone: "+971 50 444 5566", address: "Mussafah M9, Abu Dhabi", tradeLicence: "CN-2231190" },
      { name: "Agthia Fleet", code: "AGFLEET", type: "carrier", contactName: "Fleet Desk", contactEmail: "fleet@agthia.ae", contactPhone: "+971 2 596 0000", address: "Al Foah, Al Ain" },
      { name: "Al Foah Dates", code: "ALFOAH", type: "customer", contactName: "Khalid Al Shamsi", contactEmail: "planner@alfoah.ae", contactPhone: "+971 3 700 1100", address: "Al Foah, Al Ain" },
      { name: "Grand Mills", code: "GRANDMILLS", type: "customer", contactName: "Fatima Al Hosani", contactEmail: "planner@grandmills.ae", contactPhone: "+971 2 596 1200", address: "Mina Zayed, Abu Dhabi" },
    ])
    .returning();

  const hash = await bcrypt.hash(PASSWORD, 10);
  await db.insert(users).values([
    { name: "Agthia Warehouse Admin", email: "admin@agthia.ae", passwordHash: hash, role: "admin", organisationId: agthia.id, title: "Warehouse Manager" },
    { name: "Warehouse Operations", email: "warehouse@agthia.ae", passwordHash: hash, role: "admin", organisationId: agthia.id, title: "Operations Supervisor", warehouseOpsView: true },
    { name: "Gate House 1", email: "security@agthia.ae", passwordHash: hash, role: "security", organisationId: agthia.id, title: "Security, Gate House 1" },
    { name: "Al Wafi Operations", email: "ops@alwafi-transport.ae", passwordHash: hash, role: "carrier", organisationId: alWafi.id, title: "Dispatch" },
    { name: "Emirates Haulage Operations", email: "ops@emirates-haulage.ae", passwordHash: hash, role: "carrier", organisationId: emirates.id, title: "Dispatch" },
    { name: "Al Foah Planner", email: "planner@alfoah.ae", passwordHash: hash, role: "customer", organisationId: alFoah.id, title: "Supply Planner" },
    { name: "Grand Mills Planner", email: "planner@grandmills.ae", passwordHash: hash, role: "customer", organisationId: grandMills.id, title: "Logistics Planner" },
  ]);

  await db.insert(docks).values([
    { code: "DOCK-01", name: "Inbound 1", type: "inbound", sortOrder: 1, notes: "Raw dates receiving, bulk bins" },
    { code: "DOCK-02", name: "Inbound 2", type: "inbound", sortOrder: 2, notes: "Raw dates receiving" },
    { code: "DOCK-03", name: "Inbound 3", type: "inbound", sortOrder: 3, notes: "Packaging and consumables" },
    { code: "DOCK-04", name: "Inbound 4", type: "inbound", sortOrder: 4, notes: "Leveller under service until further notice", status: "maintenance" },
    { code: "DOCK-05", name: "Outbound 1", type: "outbound", sortOrder: 5, notes: "Finished goods dispatch" },
    { code: "DOCK-06", name: "Outbound 2", type: "outbound", sortOrder: 6, notes: "Finished goods dispatch, reefer capable" },
    { code: "DOCK-07", name: "Flex 1", type: "both", sortOrder: 7, notes: "Container capable" },
    { code: "DOCK-08", name: "Flex 2", type: "both", sortOrder: 8, notes: "Container capable" },
  ]);

  await db.insert(cargoTypes).values([
    { code: "DATES_BULK", name: "Dates, bulk bins", handlingMinutes: 75, sortOrder: 1 },
    { code: "DATES_PACKED", name: "Dates, packed cartons", handlingMinutes: 60, sortOrder: 2 },
    { code: "FLOUR_BAGS", name: "Flour and grain, bags", handlingMinutes: 60, sortOrder: 3 },
    { code: "PALLET_FMCG", name: "Palletised FMCG", handlingMinutes: 45, sortOrder: 4 },
    { code: "PACKAGING", name: "Packaging materials", handlingMinutes: 45, sortOrder: 5 },
    { code: "CONTAINER", name: "Containerised cargo", handlingMinutes: 120, sortOrder: 6 },
    { code: "CHILLED", name: "Chilled or frozen", handlingMinutes: 60, sortOrder: 7 },
  ]);

  await db.insert(configSettings).values(
    CONFIG_DEFS.map((d) => ({ key: d.key, value: d.default, valueType: d.type, group: d.group, label: d.label, description: d.description, sortOrder: d.sortOrder })),
  );

  await db.insert(customFields).values([
    { appliesTo: "shipment", label: "Customs declaration number", fieldKey: "customs_declaration", fieldType: "text", required: false, visibleToRoles: ["admin", "customer", "carrier", "security"], helpText: "Required for imported cargo", sortOrder: 1 },
    { appliesTo: "shipment", label: "Temperature controlled", fieldKey: "temperature_controlled", fieldType: "checkbox", required: false, visibleToRoles: ["admin", "customer", "carrier", "security"], sortOrder: 2 },
    { appliesTo: "shipment", label: "Pallet type", fieldKey: "pallet_type", fieldType: "dropdown", optionsJson: ["Euro", "Standard", "Plastic", "None"], required: false, visibleToRoles: ["admin", "customer", "carrier"], sortOrder: 3 },
    { appliesTo: "booking", label: "Vehicle insurance expiry", fieldKey: "insurance_expiry", fieldType: "date", required: false, visibleToRoles: ["admin", "carrier", "security"], sortOrder: 1 },
    { appliesTo: "booking", label: "Tail lift available", fieldKey: "tail_lift", fieldType: "checkbox", required: false, visibleToRoles: ["admin", "carrier"], sortOrder: 2 },
  ]);

  return { agthia, alWafi, emirates, agthiaFleet, alFoah, grandMills };
}

export type Stage = "AWAITING_CARRIER" | "AWAITING_TRUCK_DETAILS" | "PENDING_APPROVAL" | "BOOKED" | "IN_YARD" | "AT_DOCK" | "HANDLING" | "COMPLETED" | "GATE_OUT" | "NO_SHOW" | "CANCELLED" | "EXCEPTION";

const CARGO: Record<"inbound" | "outbound", { desc: string; type: string; qty: number; uom: string }[]> = {
  inbound: [
    { desc: "Khalas dates, field bins", type: "DATES_BULK", qty: 42, uom: "Bins" },
    { desc: "Fard dates, field bins", type: "DATES_BULK", qty: 38, uom: "Bins" },
    { desc: "Corrugated cartons 5 kg", type: "PACKAGING", qty: 22, uom: "Pallets" },
    { desc: "Shrink film and labels", type: "PACKAGING", qty: 8, uom: "Pallets" },
    { desc: "Wheat flour 50 kg bags", type: "FLOUR_BAGS", qty: 600, uom: "Bags" },
    { desc: "40ft container, glass jars", type: "CONTAINER", qty: 1, uom: "Containers" },
    { desc: "Date syrup drums, returns", type: "PALLET_FMCG", qty: 12, uom: "Drums" },
  ],
  outbound: [
    { desc: "Packed dates 1 kg cartons, Carrefour", type: "DATES_PACKED", qty: 26, uom: "Pallets" },
    { desc: "Packed dates 5 kg, Lulu Al Ain", type: "DATES_PACKED", qty: 24, uom: "Pallets" },
    { desc: "Date paste 20 kg cartons, export", type: "DATES_PACKED", qty: 20, uom: "Pallets" },
    { desc: "Flour 25 kg bags, bakery accounts", type: "FLOUR_BAGS", qty: 480, uom: "Bags" },
    { desc: "20ft container, Saudi export", type: "CONTAINER", qty: 1, uom: "Containers" },
    { desc: "Chilled date products, Spinneys", type: "CHILLED", qty: 14, uom: "Pallets" },
  ],
};

const PLATES = ["AD 12345", "AD 88210", "DXB A 44120", "AUH 9 31877", "SHJ 2 55021", "AD 7 60432", "AUH 14 20981", "DXB Q 77310", "AD 3 91245", "AUH 11 54327", "AD 16 40021", "RAK B 13390"];
const DRIVERS = ["Mohammed Aslam", "Rajesh Kumar", "Imran Hussain", "Sunil Thomas", "Abdul Rahman", "Faisal Khan", "Naveed Iqbal", "Suresh Pillai", "Ali Hassan", "Bilal Ahmed", "Ramesh Yadav", "Tariq Mahmood"];
const TRUCK_TYPES = ["Flatbed", "Curtain sider", "Box truck", "Reefer", "Container chassis 40ft", "Container chassis 20ft"];

async function seedBooking(
  d: Db,
  orgs: Awaited<ReturnType<typeof seedStatic>>,
  input: {
    date: string;
    time?: string;
    dockCode?: string;
    direction: "inbound" | "outbound";
    customer: "alFoah" | "grandMills";
    carrier?: "alWafi" | "emirates" | "agthiaFleet" | null;
    stage: Stage;
    priority?: "low" | "normal" | "high" | "urgent";
    arrivalOffsetMin?: number; // minutes relative to slot start, negative means early
    rescheduled?: boolean;
    exceptionType?: "wrong_truck_plate" | "documents_missing" | "damaged_seal";
    idx: number;
    now: Date;
    adminId: number;
    securityId: number;
  },
) {
  const cfg = await loadConfig(d as never);
  const year = Number(input.date.slice(0, 4));
  const dirCode = input.direction === "inbound" ? "INB" : "OUT";
  const seqKey = `shipment:${cfg.siteCode}:${dirCode}:${year}`;
  const [seq] = await d.insert(sequences).values({ key: seqKey, lastValue: 1 }).onConflictDoUpdate({ target: sequences.key, set: { lastValue: sql`${sequences.lastValue} + 1` } }).returning();
  const reference = `${cfg.siteCode}-${dirCode}-${year}-${pad(seq.lastValue)}`;
  const cargo = pick(CARGO[input.direction]);
  const [ct] = await d.select().from(cargoTypes).where(eq(cargoTypes.code, cargo.type));
  const customerOrg = input.customer === "alFoah" ? orgs.alFoah : orgs.grandMills;
  const carrierOrg = input.carrier ? orgs[input.carrier] : null;
  const withCarrier = !!carrierOrg;

  const shipmentStatus: schema.ShipmentStatus = (() => {
    switch (input.stage) {
      case "AWAITING_CARRIER": return "AWAITING_CARRIER";
      case "AWAITING_TRUCK_DETAILS": return "AWAITING_TRUCK_DETAILS";
      case "PENDING_APPROVAL": return "PENDING_APPROVAL";
      case "BOOKED": return "BOOKED";
      case "IN_YARD": case "AT_DOCK": case "HANDLING": case "COMPLETED": return "IN_PROGRESS";
      case "GATE_OUT": return "COMPLETED";
      case "NO_SHOW": return "NO_SHOW";
      case "CANCELLED": return "CANCELLED";
      case "EXCEPTION": return "EXCEPTION";
    }
  })();

  const createdAt = new Date(siteDateTime(input.date, "08:00").getTime() - (2 + Math.floor(rnd() * 5)) * 86_400_000);
  const [shipment] = await d
    .insert(shipments)
    .values({
      reference,
      direction: input.direction,
      customerOrgId: customerOrg.id,
      carrierOrgId: carrierOrg?.id ?? null,
      cargoDescription: cargo.desc,
      cargoTypeId: ct.id,
      quantity: cargo.qty,
      uom: cargo.uom,
      blNumber: input.direction === "inbound" ? `BL-${year}-${7000 + input.idx}` : null,
      containerNumber: cargo.type === "CONTAINER" ? `MSCU${(4000000 + input.idx * 37).toString()}` : null,
      sealNumber: cargo.type === "CONTAINER" ? `SL${(880000 + input.idx * 13).toString()}` : null,
      poNumber: input.direction === "inbound" ? `PO-${45000 + input.idx}` : null,
      invoiceNumber: input.direction === "outbound" ? `INV-${year}-${11000 + input.idx}` : null,
      expectedDate: input.date,
      priority: input.priority ?? "normal",
      status: shipmentStatus,
      createdBy: input.adminId,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();

  await d.insert(auditLog).values({ entityType: "shipment", entityId: shipment.id, action: "SHIPMENT_CREATED", actorUserId: input.adminId, afterJson: { reference }, occurredAt: createdAt });

  const noSlotStages: Stage[] = ["AWAITING_CARRIER", "AWAITING_TRUCK_DETAILS"];
  if (noSlotStages.includes(input.stage)) {
    const [b] = await d.insert(bookings).values({ shipmentId: shipment.id, status: withCarrier ? "AWAITING_TRUCK_DETAILS" : "DRAFT", qrToken: token(), bookingLinkToken: token(), createdBy: input.adminId, createdAt }).returning();
    if (withCarrier) {
      await d.insert(notifications).values({ organisationId: carrierOrg!.id, title: `New booking request ${reference}`, body: `${customerOrg.name} has assigned you ${input.direction} cargo: ${cargo.desc}. Expected ${input.date}. Please add truck details and pick a slot.`, href: `/carrier/bookings/${b.id}`, entityType: "booking", entityId: b.id, createdAt });
    }
    return;
  }

  // Slot selection
  await ensureSlotsForDate(d, input.date, cfg);
  const dockRows = await d.select().from(docks).orderBy(asc(docks.sortOrder));
  const compatible = dockRows.filter((x) => x.status === "active" && (x.type === "both" || x.type === input.direction));
  const wantedDock = input.dockCode ? dockRows.find((x) => x.code === input.dockCode) : null;
  const handling = ct.handlingMinutes;

  const dayStart = siteDateTime(input.date, "00:00");
  const dayEnd = siteDateTime(addDaysKey(input.date, 1), "00:00");
  const daySlots = await d.select().from(slots).where(and(gte(slots.startsAt, dayStart), lt(slots.startsAt, dayEnd))).orderBy(asc(slots.startsAt));

  // Spread history across docks instead of always filling the first one.
  const rotated = [...compatible.slice(input.idx % Math.max(1, compatible.length)), ...compatible.slice(0, input.idx % Math.max(1, compatible.length))];
  const candidates = (wantedDock ? [wantedDock, ...rotated.filter((x) => x.id !== wantedDock.id)] : rotated);
  let chosen: { dock: schema.Dock; anchor: schema.Slot; covered: schema.Slot[] } | null = null;
  const timePref = input.time;
  for (const dock of candidates) {
    const ds = daySlots.filter((s) => s.dockId === dock.id);
    const wantedMin = timePref ? Number(timePref) * 60 : null;
    const ordered = wantedMin == null ? ds : [...ds].sort((a, b) => Math.abs(Number(a.startTime.slice(0, 2)) * 60 + Number(a.startTime.slice(3, 5)) - wantedMin) - Math.abs(Number(b.startTime.slice(0, 2)) * 60 + Number(b.startTime.slice(3, 5)) - wantedMin));
    for (const s of ordered) {
      if (s.status !== "open") continue;
      const end = new Date(s.startsAt.getTime() + handling * 60_000);
      const covered = ds.filter((c) => c.startsAt >= s.startsAt && c.startsAt < end);
      if (covered.every((c) => c.status === "open")) {
        chosen = { dock, anchor: s, covered };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    console.warn(`No slot for ${reference} on ${input.date}`);
    return;
  }
  const slotStart = chosen.anchor.startsAt;
  const lastEnd = chosen.covered[chosen.covered.length - 1].endsAt;
  const windowEnd = new Date(slotStart.getTime() + handling * 60_000);
  const slotEnd = lastEnd > windowEnd ? lastEnd : windowEnd;

  const gpKey = `gatepass:${year}`;
  const [gp] = await d.insert(sequences).values({ key: gpKey, lastValue: 1 }).onConflictDoUpdate({ target: sequences.key, set: { lastValue: sql`${sequences.lastValue} + 1` } }).returning();
  const gatePassNumber = `GP-${year}-${pad(gp.lastValue)}`;
  const bookedAt = new Date(Math.min(createdAt.getTime() + 3 * 3600_000, slotStart.getTime() - 4 * 3600_000));

  const plate = PLATES[input.idx % PLATES.length];
  const driver = DRIVERS[(input.idx * 7) % DRIVERS.length];
  const truckType = cargo.type === "CONTAINER" ? (cargo.desc.includes("40ft") ? "Container chassis 40ft" : "Container chassis 20ft") : cargo.type === "CHILLED" ? "Reefer" : pick(TRUCK_TYPES.slice(0, 3));

  const bookingStatus = input.stage as schema.BookingStatus;
  const holdsSlot = ["PENDING_APPROVAL", "BOOKED", "IN_YARD", "AT_DOCK", "HANDLING"].includes(bookingStatus);

  // Arrival timeline
  const arrivalAt = input.arrivalOffsetMin != null ? new Date(slotStart.getTime() + input.arrivalOffsetMin * 60_000) : new Date(slotStart.getTime() + (Math.floor(rnd() * 50) - 20) * 60_000);
  const dockInAt = new Date(arrivalAt.getTime() + (5 + Math.floor(rnd() * 12)) * 60_000);
  const handlingStartAt = new Date(dockInAt.getTime() + (3 + Math.floor(rnd() * 8)) * 60_000);
  const handlingEndAt = new Date(handlingStartAt.getTime() + Math.round(handling * (0.7 + rnd() * 0.6)) * 60_000);
  const gateOutAt = new Date(handlingEndAt.getTime() + (6 + Math.floor(rnd() * 15)) * 60_000);

  const arrivedStages: Stage[] = ["IN_YARD", "AT_DOCK", "HANDLING", "COMPLETED", "GATE_OUT", "EXCEPTION"];
  const arrived = arrivedStages.includes(input.stage);
  const atDockStages: Stage[] = ["AT_DOCK", "HANDLING", "COMPLETED", "GATE_OUT"];
  const reachedDock = atDockStages.includes(input.stage);

  const [b] = await d
    .insert(bookings)
    .values({
      shipmentId: shipment.id,
      dockId: chosen.dock.id,
      slotId: chosen.anchor.id,
      slotStart,
      slotEnd,
      originalSlotStart: slotStart,
      originalDockId: chosen.dock.id,
      truckPlate: plate,
      trailerPlate: truckType.startsWith("Container") || truckType === "Flatbed" ? `T ${10000 + input.idx * 3}` : null,
      driverName: driver,
      driverMobile: `+971 5${Math.floor(rnd() * 9)} ${100 + Math.floor(rnd() * 899)} ${1000 + Math.floor(rnd() * 8999)}`,
      driverIdNumber: `784-19${80 + (input.idx % 19)}-${1000000 + input.idx * 9173}-${input.idx % 9}`,
      truckType,
      capacity: truckType.startsWith("Container") ? "1 x TEU" : `${18 + Math.floor(rnd() * 8)} pallets`,
      status: bookingStatus,
      qrToken: token(),
      bookingLinkToken: token(),
      gatePassNumber,
      bookedAt,
      arrivedAt: arrived ? arrivalAt : null,
      dockInAt: reachedDock ? dockInAt : null,
      handlingStartAt: ["HANDLING", "COMPLETED", "GATE_OUT"].includes(input.stage) ? handlingStartAt : null,
      handlingEndAt: ["COMPLETED", "GATE_OUT"].includes(input.stage) ? handlingEndAt : null,
      gateOutAt: input.stage === "GATE_OUT" ? gateOutAt : null,
      earlyArrivalPromoted: reachedDock && (input.arrivalOffsetMin ?? 0) < -15,
      rescheduledBySystem: !!input.rescheduled,
      rescheduleReason: input.rescheduled ? "EARLY_ARRIVAL_PROMOTED: an earlier truck was moved into this dock" : null,
      cancelledAt: input.stage === "CANCELLED" ? new Date(bookedAt.getTime() + 3600_000) : null,
      cancelReason: input.stage === "CANCELLED" ? "Truck breakdown, will rebook" : null,
      createdBy: input.adminId,
      createdAt,
      updatedAt: bookedAt,
    })
    .returning();

  if (holdsSlot) {
    for (const c of chosen.covered) await d.update(slots).set({ status: "booked", bookingId: b.id }).where(eq(slots.id, c.id));
  }

  const ev: (typeof gateEvents.$inferInsert)[] = [];
  const sec = input.securityId;
  if (arrived) ev.push({ bookingId: b.id, eventType: "gate_in", occurredAt: arrivalAt, recordedByUserId: sec, note: (input.arrivalOffsetMin ?? 0) < 0 ? `Arrival: early, ${-(input.arrivalOffsetMin ?? 0)} min early` : "Arrival: on time" });
  if (input.stage === "IN_YARD") {
    ev.push({ bookingId: b.id, eventType: "yard_in", occurredAt: new Date(arrivalAt.getTime() + 2 * 60_000), recordedByUserId: sec, note: "No compatible dock free. Yard position 1" });
    const [pos] = await d.select({ max: sql<number>`coalesce(max(position),0)::int` }).from(yardQueue);
    await d.insert(yardQueue).values({ bookingId: b.id, position: (pos?.max ?? 0) + 1, enteredAt: new Date(arrivalAt.getTime() + 2 * 60_000), reason: "No compatible dock free" });
  }
  if (reachedDock) ev.push({ bookingId: b.id, eventType: "dock_in", occurredAt: dockInAt, recordedByUserId: sec, dockId: chosen.dock.id, note: `Proceed to ${chosen.dock.code}` });
  if (["HANDLING", "COMPLETED", "GATE_OUT"].includes(input.stage)) ev.push({ bookingId: b.id, eventType: "handling_start", occurredAt: handlingStartAt, recordedByUserId: input.adminId, dockId: chosen.dock.id });
  if (["COMPLETED", "GATE_OUT"].includes(input.stage)) {
    ev.push({ bookingId: b.id, eventType: "handling_end", occurredAt: handlingEndAt, recordedByUserId: input.adminId, dockId: chosen.dock.id });
    ev.push({ bookingId: b.id, eventType: "dock_out", occurredAt: handlingEndAt, recordedByUserId: input.adminId, dockId: chosen.dock.id });
  }
  if (input.stage === "GATE_OUT") ev.push({ bookingId: b.id, eventType: "gate_out", occurredAt: gateOutAt, recordedByUserId: sec });
  if (input.stage === "EXCEPTION") {
    ev.push({ bookingId: b.id, eventType: "exception", occurredAt: new Date(arrivalAt.getTime() + 4 * 60_000), recordedByUserId: sec, exceptionType: input.exceptionType ?? "documents_missing", note: input.exceptionType === "wrong_truck_plate" ? `Truck arrived with plate AD 55 90121, pass shows ${plate}` : "Driver has no delivery note. Called carrier dispatch." });
    await d.insert(notifications).values({ role: "admin", level: "critical", title: `Exception at gate: ${reference}`, body: `${(input.exceptionType ?? "documents_missing").replaceAll("_", " ")}. Needs a decision.`, href: `/admin/bookings/${b.id}`, entityType: "booking", entityId: b.id, createdAt: new Date(arrivalAt.getTime() + 4 * 60_000) });
  }
  if (ev.length) await d.insert(gateEvents).values(ev);

  const audits: (typeof auditLog.$inferInsert)[] = [
    { entityType: "booking", entityId: b.id, action: bookingStatus === "PENDING_APPROVAL" ? "BOOKING_SUBMITTED_FOR_APPROVAL" : "BOOKING_CONFIRMED", actorUserId: null, actorLabel: `${carrierOrg?.name ?? "Carrier"} (carrier)`, afterJson: { status: "BOOKED", dockId: chosen.dock.id, slotStart: slotStart.toISOString(), truckPlate: plate }, occurredAt: bookedAt },
  ];
  if (arrived) audits.push({ entityType: "booking", entityId: b.id, action: "GATE_IN", actorUserId: sec, afterJson: { status: "ARRIVED" }, occurredAt: arrivalAt });
  if (reachedDock && (input.arrivalOffsetMin ?? 0) < -15) audits.push({ entityType: "booking", entityId: b.id, action: "EARLY_ARRIVAL_PROMOTED", actorUserId: sec, reason: "EARLY_ARRIVAL_PROMOTED", afterJson: { status: "AT_DOCK", dockId: chosen.dock.id }, occurredAt: dockInAt });
  if (input.stage === "GATE_OUT") audits.push({ entityType: "booking", entityId: b.id, action: "GATE_OUT", actorUserId: sec, afterJson: { status: "GATE_OUT" }, occurredAt: gateOutAt });
  if (input.stage === "NO_SHOW") audits.push({ entityType: "booking", entityId: b.id, action: "MARKED_NO_SHOW", actorLabel: "system", afterJson: { status: "NO_SHOW" }, reason: "No gate in 60 minutes after slot end", occurredAt: new Date(slotEnd.getTime() + 60 * 60_000) });
  if (input.stage === "CANCELLED") audits.push({ entityType: "booking", entityId: b.id, action: "BOOKING_CANCELLED", actorLabel: `${carrierOrg?.name ?? "Carrier"} (carrier)`, reason: "Truck breakdown, will rebook", afterJson: { status: "CANCELLED" }, occurredAt: new Date(bookedAt.getTime() + 3600_000) });
  if (input.rescheduled) {
    audits.push({ entityType: "booking", entityId: b.id, action: "RESCHEDULED_BY_SYSTEM", actorLabel: "system", reason: "EARLY_ARRIVAL_PROMOTED: an earlier truck was moved into this dock", beforeJson: { dockId: chosen.dock.id, slotStart: new Date(slotStart.getTime() - 75 * 60_000).toISOString() }, afterJson: { dockId: chosen.dock.id, slotStart: slotStart.toISOString() }, occurredAt: new Date(input.now.getTime() - 40 * 60_000) });
    for (const orgId of [carrierOrg?.id, customerOrg.id]) {
      if (!orgId) continue;
      await d.insert(notifications).values({ organisationId: orgId, level: "warning", title: `${reference} rescheduled by the system`, body: `Moved to ${chosen.dock.code} at ${fmtDateTime(slotStart)} because an early truck was promoted into the dock. Reason: EARLY_ARRIVAL_PROMOTED`, href: orgId === customerOrg.id ? `/customer/shipments/${shipment.id}` : `/carrier/bookings/${b.id}`, entityType: "booking", entityId: b.id, createdAt: new Date(input.now.getTime() - 40 * 60_000) });
    }
  }
  await d.insert(auditLog).values(audits);

  // A couple of custom field values so the demo shows them.
  const cfRows = await d.select().from(customFields);
  const tc = cfRows.find((f) => f.fieldKey === "temperature_controlled");
  const cd = cfRows.find((f) => f.fieldKey === "customs_declaration");
  if (tc) await d.insert(customFieldValues).values({ entityType: "shipment", entityId: shipment.id, fieldId: tc.id, value: cargo.type === "CHILLED" ? "true" : "false" });
  if (cd && cargo.type === "CONTAINER") await d.insert(customFieldValues).values({ entityType: "shipment", entityId: shipment.id, fieldId: cd.id, value: `DEC-${year}-${300000 + input.idx}` });
}

export async function runSeed(db: Db, log: (m: string) => void = console.log) {
  log("Resetting database...");
  await reset(db);
  log("Seeding organisations, users, docks, config...");
  const orgs = await seedStatic(db);
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@agthia.ae"));
  const [security] = await db.select().from(users).where(eq(users.email, "security@agthia.ae"));

  const now = new Date();
  const today = siteDateKey(now);
  let idx = 1;
  const base = { now, adminId: admin.id, securityId: security.id };
  const carriers: ("alWafi" | "emirates" | "agthiaFleet")[] = ["alWafi", "emirates", "alWafi", "emirates", "agthiaFleet"];
  const customers: ("alFoah" | "grandMills")[] = ["alFoah", "alFoah", "grandMills"];

  // Past 12 days: completed history for reports.
  log("Seeding history...");
  for (let d = 12; d >= 1; d--) {
    const date = addDaysKey(today, -d);
    const count = 7 + Math.floor(rnd() * 6);
    for (let i = 0; i < count; i++) {
      const direction = rnd() < 0.55 ? "inbound" : "outbound";
      const roll = rnd();
      const stage: Stage = roll < 0.86 ? "GATE_OUT" : roll < 0.93 ? "NO_SHOW" : "CANCELLED";
      const arrivalOffsetMin = rnd() < 0.15 ? -(60 + Math.floor(rnd() * 90)) : rnd() < 0.2 ? 35 + Math.floor(rnd() * 60) : Math.floor(rnd() * 25) - 10;
      await seedBooking(db, orgs, { date, direction, customer: pick(customers), carrier: pick(carriers), stage, arrivalOffsetMin, idx: idx++, ...base });
    }
  }

  // Today: a live picture.
  log("Seeding today...");
  const hourNow = Number(now.toLocaleString("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", hour12: false }));
  const earlier = (h: number) => `${Math.max(6, Math.min(20, h)).toString().padStart(2, "0")}`;
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 4), direction: "inbound", customer: "alFoah", carrier: "alWafi", stage: "GATE_OUT", arrivalOffsetMin: -5, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 4), direction: "outbound", customer: "grandMills", carrier: "emirates", stage: "GATE_OUT", arrivalOffsetMin: 10, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 3), direction: "inbound", customer: "alFoah", carrier: "emirates", stage: "GATE_OUT", arrivalOffsetMin: -90, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 2), direction: "outbound", customer: "alFoah", carrier: "alWafi", stage: "COMPLETED", arrivalOffsetMin: 0, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 1), direction: "inbound", customer: "alFoah", carrier: "alWafi", dockCode: "DOCK-01", stage: "HANDLING", arrivalOffsetMin: -8, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 1), direction: "inbound", customer: "grandMills", carrier: "agthiaFleet", dockCode: "DOCK-02", stage: "HANDLING", arrivalOffsetMin: 12, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow), direction: "outbound", customer: "alFoah", carrier: "emirates", dockCode: "DOCK-05", stage: "AT_DOCK", arrivalOffsetMin: -70, priority: "high", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow), direction: "inbound", customer: "alFoah", carrier: "alWafi", dockCode: "DOCK-07", stage: "AT_DOCK", arrivalOffsetMin: -3, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow), direction: "inbound", customer: "grandMills", carrier: "emirates", dockCode: "DOCK-03", stage: "IN_YARD", arrivalOffsetMin: -40, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 1), direction: "outbound", customer: "grandMills", carrier: "alWafi", dockCode: "DOCK-06", stage: "IN_YARD", arrivalOffsetMin: -95, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow), direction: "inbound", customer: "alFoah", carrier: "emirates", dockCode: "DOCK-08", stage: "EXCEPTION", arrivalOffsetMin: 5, exceptionType: "wrong_truck_plate", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow - 3), direction: "outbound", customer: "alFoah", carrier: "agthiaFleet", stage: "NO_SHOW", idx: idx++, ...base });
  // Upcoming later today
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 1), direction: "inbound", customer: "alFoah", carrier: "alWafi", dockCode: "DOCK-01", stage: "BOOKED", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 2), direction: "inbound", customer: "grandMills", carrier: "emirates", dockCode: "DOCK-02", stage: "BOOKED", rescheduled: true, idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 2), direction: "outbound", customer: "alFoah", carrier: "alWafi", dockCode: "DOCK-05", stage: "BOOKED", priority: "urgent", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 3), direction: "outbound", customer: "grandMills", carrier: "agthiaFleet", dockCode: "DOCK-06", stage: "BOOKED", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 3), direction: "inbound", customer: "alFoah", carrier: "emirates", dockCode: "DOCK-07", stage: "BOOKED", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: today, time: earlier(hourNow + 4), direction: "inbound", customer: "alFoah", carrier: "alWafi", dockCode: "DOCK-03", stage: "BOOKED", idx: idx++, ...base });

  // Coming days
  log("Seeding upcoming...");
  for (let d = 1; d <= 6; d++) {
    const date = addDaysKey(today, d);
    const count = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i++) {
      const direction = rnd() < 0.55 ? "inbound" : "outbound";
      const roll = rnd();
      const stage: Stage = roll < 0.6 ? "BOOKED" : roll < 0.85 ? "AWAITING_TRUCK_DETAILS" : "AWAITING_CARRIER";
      await seedBooking(db, orgs, { date, direction, customer: pick(customers), carrier: stage === "AWAITING_CARRIER" ? null : pick(carriers), stage, priority: rnd() < 0.15 ? "high" : "normal", idx: idx++, ...base });
    }
  }
  // A couple of open requests for today too so carriers have work in the demo
  await seedBooking(db, orgs, { date: addDaysKey(today, 1), direction: "inbound", customer: "alFoah", carrier: "alWafi", stage: "AWAITING_TRUCK_DETAILS", priority: "high", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: addDaysKey(today, 1), direction: "outbound", customer: "grandMills", carrier: "emirates", stage: "AWAITING_TRUCK_DETAILS", idx: idx++, ...base });
  await seedBooking(db, orgs, { date: addDaysKey(today, 2), direction: "outbound", customer: "alFoah", carrier: null, stage: "AWAITING_CARRIER", idx: idx++, ...base });

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bookings);
  log(`Seed complete. ${count} bookings created. Password for all users: ${PASSWORD}`);
  return { bookings: count };
}

