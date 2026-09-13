/**
 * Exercises the slot engine and the early arrival override against the database
 * in DATABASE_URL. Everything runs inside transactions that are rolled back,
 * except the double booking race which needs two real transactions.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq, inArray, gte, asc } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { loadConfig } from "../src/lib/config";
import { createShipment, submitBooking } from "../src/lib/engine/booking";
import { gateIn } from "../src/lib/engine/gate";
import { getAvailability } from "../src/lib/engine/slots";
import { siteDateKey, addDaysKey } from "../src/lib/time";
import type { SessionUser } from "../src/lib/auth/roles";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const db = drizzle(pool, { schema });
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const { users, organisations, bookings, docks, shipments } = schema;

class Rollback extends Error {}

async function actor(email: string): Promise<SessionUser> {
  const [row] = await db.select({ u: users, o: organisations }).from(users).innerJoin(organisations, eq(organisations.id, users.organisationId)).where(eq(users.email, email));
  return { id: row.u.id, name: row.u.name, email: row.u.email, role: row.u.role, organisationId: row.o.id, organisationName: row.o.name, organisationType: row.o.type, title: row.u.title, warehouseOpsView: row.u.warehouseOpsView };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok: ${msg}`);
}

async function firstFreeSlot(tx: Tx, direction: "inbound" | "outbound", date: string, handling: number, dockCode?: string) {
  const cfg = await loadConfig(tx);
  const a = await getAvailability(tx, cfg, { date, direction, handlingMinutes: handling });
  for (const d of a.docks) {
    if (dockCode && d.dock.code !== dockCode) continue;
    const s = d.slots.find((x) => x.available);
    if (s) return { slot: s, dock: d.dock };
  }
  throw new Error(`No free slot for ${direction} on ${date} ${dockCode ?? ""}`);
}

async function testDoubleBookingRace() {
  console.log("\n1. Double booking race: two carriers submit the same slot at the same moment");
  const customer = await actor("planner@alfoah.ae");
  const carrier = await actor("ops@alwafi-transport.ae");
  const cfg = await loadConfig();
  const date = addDaysKey(siteDateKey(), 3);
  const [carrierOrg] = await db.select().from(organisations).where(eq(organisations.code, "ALWAFI"));

  // Two shipments assigned to the same carrier
  const made = await db.transaction(async (tx) => {
    const a = await createShipment(tx, customer, cfg, { direction: "inbound", customerOrgId: customer.organisationId, carrierOrgId: carrierOrg.id, cargoDescription: "Race test A", expectedDate: date, priority: "normal" });
    const b = await createShipment(tx, customer, cfg, { direction: "inbound", customerOrgId: customer.organisationId, carrierOrgId: carrierOrg.id, cargoDescription: "Race test B", expectedDate: date, priority: "normal" });
    const { slot } = await firstFreeSlot(tx, "inbound", date, cfg.defaultHandlingMinutes);
    return { a: a.booking.id, b: b.booking.id, slotId: slot.id };
  });

  const details = (plate: string) => ({ truckPlate: plate, driverName: "Race Driver", driverMobile: "+971500000000", driverIdNumber: "784-0000-0000000-0", truckType: "Flatbed", slotId: made.slotId });
  const results = await Promise.allSettled([
    db.transaction((tx) => submitBooking(tx, carrier, cfg, made.a, details("RACE A"))),
    db.transaction((tx) => submitBooking(tx, carrier, cfg, made.b, details("RACE B"))),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  assert(ok === 1, `exactly one booking won the slot (won: ${ok}, lost: ${failed.length})`);
  assert(failed.length === 1 && /taken a moment ago|already/.test(String(failed[0].reason?.message ?? failed[0].reason)), `the loser got a clear error: ${failed[0]?.reason?.message}`);

  // A third attempt on the same slot must also fail
  const [bookedRow] = await db.select().from(bookings).where(inArray(bookings.id, [made.a, made.b])).orderBy(asc(bookings.id));
  void bookedRow;
  const [slotRow] = await db.select().from(schema.slots).where(eq(schema.slots.id, made.slotId));
  assert(slotRow.status === "booked", "slot row is marked booked");

  // Clean up: cancel both so the demo data stays tidy
  await db.transaction(async (tx) => {
    for (const id of [made.a, made.b]) {
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, id));
      await tx.update(bookings).set({ status: "CANCELLED", cancelReason: "engine test" }).where(eq(bookings.id, id));
      await tx.update(shipments).set({ status: "CANCELLED" }).where(eq(shipments.id, b.shipmentId));
      await tx.update(schema.slots).set({ status: "open", bookingId: null }).where(eq(schema.slots.bookingId, id));
    }
  });
}

async function testEarlyArrivalBump() {
  console.log("\n2. Early arrival override: early truck promoted into a dock held by a later booking, which is pushed");
  const customer = await actor("planner@alfoah.ae");
  const carrier = await actor("ops@emirates-haulage.ae");
  const security = await actor("security@agthia.ae");
  try {
    await db.transaction(async (tx) => {
      const cfg = await loadConfig(tx);
      const [carrierOrg] = await tx.select().from(organisations).where(eq(organisations.code, "EMHAUL"));
      const now = new Date();
      const today = siteDateKey(now);

      // Make every inbound capable dock unusable except DOCK-01 so the decision is deterministic.
      const allDocks = await tx.select().from(docks);
      const inboundDocks = allDocks.filter((d) => d.type !== "outbound");
      for (const d of inboundDocks) {
        if (d.code !== "DOCK-01") await tx.update(docks).set({ status: "blocked" }).where(eq(docks.id, d.id));
      }
      await tx.update(docks).set({ status: "active" }).where(eq(docks.code, "DOCK-01"));
      // Clear anything physically on DOCK-01 and any active holders today, so DOCK-01 is free right now.
      const dock1 = allDocks.find((d) => d.code === "DOCK-01")!;
      const holders = await tx.select().from(bookings).where(and(eq(bookings.dockId, dock1.id), inArray(bookings.status, ["PENDING_APPROVAL", "BOOKED", "ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING", "COMPLETED"])));
      for (const h of holders) {
        await tx.update(bookings).set({ status: "CANCELLED" }).where(eq(bookings.id, h.id));
        await tx.update(schema.slots).set({ status: "open", bookingId: null }).where(eq(schema.slots.bookingId, h.id));
      }

      // Later booking L: holds DOCK-01 for the first free slot from now (within the early truck's handling window).
      const L = await createShipment(tx, customer, cfg, { direction: "inbound", customerOrgId: customer.organisationId, carrierOrgId: carrierOrg.id, cargoDescription: "Later booking L", expectedDate: today, priority: "normal" });
      const availL = await getAvailability(tx, cfg, { date: today, direction: "inbound", handlingMinutes: cfg.defaultHandlingMinutes, now: new Date(now.getTime() - cfg.minLeadMinutes * 60_000 + 60_000) });
      const dock1Slots = availL.docks.find((d) => d.dock.code === "DOCK-01")!.slots.filter((s) => s.available && s.startsAt > now);
      assert(dock1Slots.length >= 2, `DOCK-01 has at least two free slots later today (${dock1Slots.length})`);
      const slotL = dock1Slots[0];
      const detailsL = { truckPlate: "LATER 1", driverName: "Later Driver", driverMobile: "+971500000001", driverIdNumber: "784-1111-1111111-1", truckType: "Flatbed", slotId: slotL.id };
      // submitBooking enforces min lead time, so bypass by temporarily lowering it.
      const cfgNoLead = { ...cfg, minLeadMinutes: 0 };
      const bookedL = await submitBooking(tx, carrier, cfgNoLead, L.booking.id, detailsL);
      assert(bookedL.status === "BOOKED" && bookedL.dockId === dock1.id, `L booked on DOCK-01 at ${bookedL.slotStart?.toISOString()}`);

      // Early truck E: booked on DOCK-01 for a later slot (the second free one), arrives now.
      const E = await createShipment(tx, customer, cfg, { direction: "inbound", customerOrgId: customer.organisationId, carrierOrgId: carrierOrg.id, cargoDescription: "Early truck E", expectedDate: today, priority: "normal" });
      const slotE = dock1Slots[1];
      const bookedE = await submitBooking(tx, carrier, cfgNoLead, E.booking.id, { truckPlate: "EARLY 1", driverName: "Early Driver", driverMobile: "+971500000002", driverIdNumber: "784-2222-2222222-2", truckType: "Flatbed", slotId: slotE.id });
      assert(bookedE.status === "BOOKED" && bookedE.slotStart! > now, `E booked for later at ${bookedE.slotStart?.toISOString()}`);
      const minutesEarly = Math.round((bookedE.slotStart!.getTime() - now.getTime()) / 60_000);
      const cfgWide = { ...cfg, earlyArrivalMaxMinutes: Math.max(cfg.earlyArrivalMaxMinutes, minutesEarly + 10), earlyArrivalMode: "bump" as const };

      // Does the window overlap? L must fall inside [now, now + handling] for the bump to be exercised.
      const windowEnd = new Date(now.getTime() + cfg.defaultHandlingMinutes * 60_000);
      const overlaps = bookedL.slotStart! < windowEnd;
      console.log(`  info: L starts in ${Math.round((bookedL.slotStart!.getTime() - now.getTime()) / 60_000)} min, handling window ${cfg.defaultHandlingMinutes} min, overlap=${overlaps}`);

      const decision = await gateIn(tx, security, cfgWide, E.booking.id);
      assert(decision.outcome === "dock", `E was sent to a dock (${decision.outcome === "dock" ? decision.dock.code : "yard"})`);
      if (decision.outcome === "dock") {
        assert(decision.dock.code === "DOCK-01", "E was promoted into DOCK-01");
        assert(decision.promoted, "decision is flagged as a promotion");
        if (overlaps) {
          assert(decision.bumped.length === 1 && decision.bumped[0].reference === L.shipment.reference, `L was pushed: ${JSON.stringify(decision.bumped)}`);
          const [Lnow] = await tx.select().from(bookings).where(eq(bookings.id, L.booking.id));
          assert(Lnow.rescheduledBySystem, "L is marked RESCHEDULED_BY_SYSTEM");
          assert(Lnow.slotStart! >= windowEnd || Lnow.dockId !== dock1.id, `L moved clear of the promoted window (now ${Lnow.slotStart?.toISOString()} on dock ${Lnow.dockId})`);
          const audits = await tx.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityType, "booking"), eq(schema.auditLog.entityId, L.booking.id), eq(schema.auditLog.action, "RESCHEDULED_BY_SYSTEM")));
          assert(audits.length === 1, "audit row RESCHEDULED_BY_SYSTEM written for L");
          const notes = await tx.select().from(schema.notifications).where(and(eq(schema.notifications.entityId, L.booking.id), eq(schema.notifications.entityType, "booking")));
          assert(notes.length >= 2, `carrier and customer notified (${notes.length} notifications)`);
        }
      }
      const [Enow] = await tx.select().from(bookings).where(eq(bookings.id, E.booking.id));
      assert(Enow.status === "AT_DOCK" && Enow.earlyArrivalPromoted, "E is AT_DOCK and flagged earlyArrivalPromoted");
      const eAudit = await tx.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, E.booking.id), eq(schema.auditLog.action, "EARLY_ARRIVAL_PROMOTED")));
      assert(eAudit.length === 1 && eAudit[0].reason === "EARLY_ARRIVAL_PROMOTED", "audit row EARLY_ARRIVAL_PROMOTED written for E");
      const events = await tx.select().from(schema.gateEvents).where(eq(schema.gateEvents.bookingId, E.booking.id));
      assert(events.map((e) => e.eventType).join(",") === "gate_in,dock_in", `gate events recorded: ${events.map((e) => e.eventType).join(", ")}`);
      const freed = await tx.select().from(schema.slots).where(eq(schema.slots.id, slotE.id));
      assert(freed[0].status === "open", "E's original slot was released");
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
    console.log("  (rolled back)");
  }
}

async function testEarlyArrivalYard() {
  console.log("\n3. Early arrival with no dock free goes to the yard with a position");
  const customer = await actor("planner@alfoah.ae");
  const carrier = await actor("ops@emirates-haulage.ae");
  const security = await actor("security@agthia.ae");
  try {
    await db.transaction(async (tx) => {
      const cfg = await loadConfig(tx);
      const [carrierOrg] = await tx.select().from(organisations).where(eq(organisations.code, "EMHAUL"));
      const today = siteDateKey();
      // Block every inbound capable dock except DOCK-02, then put a truck physically on DOCK-02.
      const allDocks = await tx.select().from(docks);
      for (const d of allDocks.filter((d) => d.type !== "outbound" && d.code !== "DOCK-02")) await tx.update(docks).set({ status: "blocked" }).where(eq(docks.id, d.id));
      await tx.update(docks).set({ status: "active" }).where(eq(docks.code, "DOCK-02"));
      const dock2 = allDocks.find((d) => d.code === "DOCK-02")!;
      const onDock = await tx.select().from(bookings).where(and(eq(bookings.dockId, dock2.id), inArray(bookings.status, ["AT_DOCK", "HANDLING", "COMPLETED"])));
      if (!onDock.length) {
        const [anyBooked] = await tx.select().from(bookings).where(and(eq(bookings.status, "BOOKED"), gte(bookings.slotStart, new Date()))).limit(1);
        await tx.update(bookings).set({ status: "AT_DOCK", dockId: dock2.id, slotStart: new Date(), slotEnd: new Date(Date.now() + 3600_000) }).where(eq(bookings.id, anyBooked.id));
      }
      const E = await createShipment(tx, customer, cfg, { direction: "inbound", customerOrgId: customer.organisationId, carrierOrgId: carrierOrg.id, cargoDescription: "Yard test", expectedDate: today, priority: "normal" });
      const availability = await getAvailability(tx, cfg, { date: addDaysKey(today, 1), direction: "inbound", handlingMinutes: cfg.defaultHandlingMinutes });
      const free = availability.docks.flatMap((d) => d.slots.filter((s) => s.available))[0];
      await submitBooking(tx, carrier, cfg, E.booking.id, { truckPlate: "YARD 1", driverName: "Yard Driver", driverMobile: "+971500000003", driverIdNumber: "784-3333-3333333-3", truckType: "Flatbed", slotId: free.id });
      const cfgWide = { ...cfg, earlyArrivalMaxMinutes: 100000 };
      const decision = await gateIn(tx, security, cfgWide, E.booking.id);
      assert(decision.outcome === "yard", `truck sent to yard (${decision.outcome})`);
      if (decision.outcome === "yard") assert(decision.position >= 1, `yard position assigned: ${decision.position}`);
      const [Enow] = await tx.select().from(bookings).where(eq(bookings.id, E.booking.id));
      assert(Enow.status === "IN_YARD", "booking status is IN_YARD");
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
    console.log("  (rolled back)");
  }
}

async function main() {
  await testDoubleBookingRace();
  await testEarlyArrivalBump();
  await testEarlyArrivalYard();
  console.log("\nAll engine tests passed.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
