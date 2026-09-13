import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { KpiRow, KpiTile } from "@/components/app/kpi";
import { TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { RescheduleAlert } from "@/components/app/reschedule-alert";
import { Button } from "@/components/ui/button";
import { listBookings, allOrganisations } from "@/lib/queries/bookings";
import { pendingReschedules } from "@/lib/queries/reschedules";
import { INSIDE_STATUSES } from "@/lib/status";
import { siteDateKey, addDaysKey, fmtDate } from "@/lib/time";
import { AssignCarrierInline } from "./shipments/[id]/assign-carrier";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer overview" };

export default async function CustomerOverview() {
  const user = await requireRole("customer");
  const today = siteDateKey();
  const org = { customerOrgId: user.organisationId };
  const [awaitingCarrier, awaitingTruck, upcoming, todayRows, done7, problems7, reschedules, carriers] = await Promise.all([
    listBookings({ ...org, statuses: ["DRAFT"] }),
    listBookings({ ...org, statuses: ["AWAITING_TRUCK_DETAILS"] }),
    listBookings({ ...org, dateFrom: addDaysKey(today, 1), dateTo: addDaysKey(today, 7), statuses: ["PENDING_APPROVAL", "BOOKED"] }),
    listBookings({ ...org, date: today, statuses: ["PENDING_APPROVAL", "BOOKED", ...INSIDE_STATUSES, "GATE_OUT", "NO_SHOW"] }),
    listBookings({ ...org, dateFrom: addDaysKey(today, -7), dateTo: today, statuses: ["GATE_OUT"] }),
    listBookings({ ...org, dateFrom: addDaysKey(today, -7), dateTo: today, statuses: ["EXCEPTION", "NO_SHOW"] }),
    pendingReschedules(user, "/customer/shipments"),
    allOrganisations("carrier"),
  ]);
  return (
    <>
      <PageHeader title={user.organisationName} description="Your shipment requests, from request to gate out." actions={<Button asChild><Link href="/customer/shipments/new">New shipment request</Link></Button>} />
      <RescheduleAlert notices={reschedules} />
      <KpiRow>
        <KpiTile label="Awaiting carrier" value={awaitingCarrier.length} tone={awaitingCarrier.length ? "waiting" : "neutral"} hint="Assign a carrier" />
        <KpiTile label="Awaiting truck details" value={awaitingTruck.length} tone="waiting" hint="With the carrier" />
        <KpiTile label="Booked upcoming" value={upcoming.length + todayRows.filter((r) => ["BOOKED", "PENDING_APPROVAL"].includes(r.booking.status)).length} tone="progress" />
        <KpiTile label="In progress today" value={todayRows.filter((r) => INSIDE_STATUSES.includes(r.booking.status)).length} tone="progress" />
        <KpiTile label="Completed, 7 days" value={done7.length} tone="done" />
        <KpiTile label="Exceptions or no shows, 7 days" value={problems7.length} tone={problems7.length ? "exception" : "neutral"} />
      </KpiRow>
      <div className="mt-4 grid gap-4">
        {awaitingCarrier.length > 0 && (
          <TableSection title="Needs your action" description="These requests have no carrier yet. Assign one to send the booking link.">
            <table className="w-full text-sm">
              <tbody>
                {awaitingCarrier.map((r) => (
                  <tr key={r.booking.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <Link href={`/customer/shipments/${r.shipment.id}`} className="font-mono text-[13px] font-medium hover:underline">{r.shipment.reference}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.shipment.cargoDescription}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.shipment.expectedDate)}</td>
                    <td className="px-3 py-2 text-right">
                      <AssignCarrierInline shipmentId={r.shipment.id} carriers={carriers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>
        )}
        <TableSection title="Today" description={`${todayRows.length} shipments moving today`}>
          <BookingsTable rows={todayRows} columns={["slot", "reference", "direction", "carrier", "plate", "dock", "status", "flags"]} linkFor={(r) => `/customer/shipments/${r.shipment.id}`} emptyTitle="Nothing scheduled today." />
        </TableSection>
        <TableSection title="Upcoming 7 days">
          <BookingsTable rows={[...awaitingTruck, ...upcoming]} columns={["slot", "reference", "direction", "cargo", "quantity", "carrier", "plate", "dock", "status", "flags"]} linkFor={(r) => `/customer/shipments/${r.shipment.id}`} emptyTitle="No upcoming shipments." />
        </TableSection>
      </div>
    </>
  );
}
