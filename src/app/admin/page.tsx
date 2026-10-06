import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { KpiRow, KpiTile } from "@/components/app/kpi";
import { Section, TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { BookingStatusBadge } from "@/components/app/status-badge";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { listBookings, yardEntries } from "@/lib/queries/bookings";
import { recentAudit } from "@/lib/queries/audit";
import { INSIDE_STATUSES } from "@/lib/status";
import { siteDateKey, fmtTime, fmtDateTime } from "@/lib/time";
import { arrivalClass } from "@/lib/engine/gate";
import { SweepButton } from "./_components/sweep-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireRole("admin");
  const today = siteDateKey();
  const now = new Date();
  const [todayRows, inside, pending, yard, recent, cfg] = await Promise.all([
    listBookings({ date: today }),
    listBookings({ statuses: INSIDE_STATUSES }),
    listBookings({ statuses: ["PENDING_APPROVAL", "EXCEPTION"] }),
    yardEntries(),
    recentAudit(12),
    getConfig(),
  ]);
  const count = (s: string[]) => todayRows.filter((r) => s.includes(r.booking.status)).length;
  const overdue = todayRows.filter((r) => r.booking.status === "BOOKED" && r.booking.slotEnd && r.booking.slotEnd < now);
  const expected = todayRows.filter((r) => !["CANCELLED", "REJECTED", "DRAFT", "AWAITING_TRUCK_DETAILS"].includes(r.booking.status));
  const arrived = todayRows.filter((r) => r.booking.arrivedAt);
  const late = arrived.filter((r) => arrivalClass({ slotStart: r.booking.originalSlotStart ?? r.booking.slotStart, slotEnd: r.booking.slotEnd }, cfg, r.booking.arrivedAt!) === "late");
  const atDock = inside.filter((r) => ["AT_DOCK", "HANDLING"].includes(r.booking.status)).length;
  const exceptions = inside.filter((r) => r.booking.status === "EXCEPTION").length;
  const nextUp = todayRows.filter((r) => r.booking.status === "BOOKED" && r.booking.slotStart).sort((a, b) => a.booking.slotStart!.getTime() - b.booking.slotStart!.getTime()).slice(0, 6);
  const attention = [...pending, ...yard.map((y) => ({ booking: y.booking, shipment: y.shipment, customer: y.customer, carrier: y.carrier, dock: y.dock, cargoType: y.cargoType })), ...overdue];
  return (
    <>
      <PageHeader title="Overview" description={`${cfg.siteName}, ${fmtDateTime(now).split(",")[0]}`} actions={<><SweepButton /><AutoRefresh seconds={30} /></>} />
      <KpiRow>
        <KpiTile label="Expected today" value={expected.length} hint={`${count(["BOOKED", "PENDING_APPROVAL"])} still to arrive`} />
        <KpiTile label="Arrived" value={arrived.length} tone={late.length ? "waiting" : "progress"} hint={late.length ? `${late.length} late` : "None late"} />
        <KpiTile label="At dock now" value={atDock} tone="progress" hint={`${yard.length} waiting in yard`} />
        <KpiTile label="Gated out" value={count(["GATE_OUT"])} tone="done" hint={`${count(["COMPLETED"])} done, still inside`} />
        <KpiTile label="Exceptions" value={exceptions} tone={exceptions ? "exception" : "neutral"} hint={pending.filter((r) => r.booking.status === "PENDING_APPROVAL").length ? `${pending.filter((r) => r.booking.status === "PENDING_APPROVAL").length} awaiting approval` : undefined} />
        <KpiTile label="No shows" value={count(["NO_SHOW"])} tone={count(["NO_SHOW"]) ? "exception" : "neutral"} hint={overdue.length ? `${overdue.length} overdue, not yet marked` : undefined} />
      </KpiRow>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <TableSection title="Today's schedule" description={`${todayRows.length} bookings`} actions={<Link href="/admin/bookings" className="text-xs text-primary-deep hover:underline">All bookings</Link>}>
          <BookingsTable rows={todayRows} columns={["slot", "reference", "direction", "customer", "carrier", "plate", "dock", "status", "flags"]} linkFor={(r) => `/admin/bookings/${r.booking.id}`} emptyTitle="No bookings today." />
        </TableSection>
        <div className="grid content-start gap-4">
          <Section title="Next arrivals" description="Booked for today, not yet at the gate">
            {nextUp.length === 0 ? (
              <p className="text-sm text-muted-foreground">No more trucks expected today.</p>
            ) : (
              <ul className="grid gap-1.5">
                {nextUp.map((r) => (
                  <li key={r.booking.id} className="flex items-center gap-2 text-sm">
                    <span className={`shrink-0 font-mono text-[13px] ${r.booking.slotEnd && r.booking.slotEnd < now ? "text-status-exception" : ""}`}>{fmtTime(r.booking.slotStart!)}</span>
                    <Link href={`/admin/bookings/${r.booking.id}`} className="font-mono text-[13px] hover:underline">{r.shipment.reference}</Link>
                    <span className="min-w-0 truncate text-xs text-muted-foreground">{r.carrier?.name ?? "No carrier"}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{r.dock?.code ?? ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Needs attention" description="Approvals, exceptions, yard and overdue arrivals">
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
            ) : (
              <ul className="grid gap-1.5">
                {attention.map((r) => (
                  <li key={r.booking.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/bookings/${r.booking.id}`} className="font-mono text-[13px] hover:underline">
                      {r.shipment.reference}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">{r.booking.truckPlate ?? r.shipment.cargoDescription}</span>
                    <BookingStatusBadge status={r.booking.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Recent activity" actions={<Link href="/admin/audit" className="text-xs text-primary-deep hover:underline">Audit log</Link>}>
            <ul className="grid gap-1.5 text-xs">
              {recent.map(({ entry, actor }) => (
                <li key={entry.id} className="flex gap-2">
                  <span className="shrink-0 font-mono text-muted-foreground">{fmtTime(entry.occurredAt)}</span>
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{entry.action.replaceAll("_", " ").toLowerCase()}</span>
                    <span className="text-muted-foreground"> {entry.entityType} {entry.entityId}, {actor?.name ?? entry.actorLabel ?? "system"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
