import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { KpiRow, KpiTile } from "@/components/app/kpi";
import { TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { RescheduleAlert } from "@/components/app/reschedule-alert";
import { Button } from "@/components/ui/button";
import { listBookings } from "@/lib/queries/bookings";
import { pendingReschedules } from "@/lib/queries/reschedules";
import { INSIDE_STATUSES } from "@/lib/status";
import { siteDateKey, addDaysKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carrier overview" };

export default async function CarrierOverview() {
  const user = await requireRole("carrier");
  const today = siteDateKey();
  const org = { carrierOrgId: user.organisationId };
  const [needs, todayRows, upcoming, inside, done7, noShow30, reschedules] = await Promise.all([
    listBookings({ ...org, statuses: ["AWAITING_TRUCK_DETAILS"] }),
    listBookings({ ...org, date: today, statuses: ["PENDING_APPROVAL", "BOOKED", ...INSIDE_STATUSES, "GATE_OUT", "NO_SHOW"] }),
    listBookings({ ...org, dateFrom: addDaysKey(today, 1), dateTo: addDaysKey(today, 7), statuses: ["PENDING_APPROVAL", "BOOKED"] }),
    listBookings({ ...org, statuses: INSIDE_STATUSES }),
    listBookings({ ...org, dateFrom: addDaysKey(today, -7), dateTo: today, statuses: ["GATE_OUT"] }),
    listBookings({ ...org, dateFrom: addDaysKey(today, -30), dateTo: today, statuses: ["NO_SHOW"] }),
    pendingReschedules(user, "/carrier/bookings"),
  ]);
  const bookedUpcoming = upcoming.length + todayRows.filter((r) => ["BOOKED", "PENDING_APPROVAL"].includes(r.booking.status)).length;
  return (
    <>
      <PageHeader title={user.organisationName} description="Bookings assigned to you by Agthia business units." actions={<Button asChild variant="outline"><Link href="/carrier/passes">Gate passes</Link></Button>} />
      <RescheduleAlert notices={reschedules} />
      <KpiRow>
        <KpiTile label="Needs truck details" value={needs.length} tone={needs.length ? "waiting" : "neutral"} hint="Waiting on you" />
        <KpiTile label="Booked upcoming" value={bookedUpcoming} tone="progress" hint="Today and next 7 days" />
        <KpiTile label="Arriving today" value={todayRows.filter((r) => ["BOOKED", "PENDING_APPROVAL"].includes(r.booking.status)).length} tone="progress" />
        <KpiTile label="Inside now" value={inside.length} tone="progress" />
        <KpiTile label="Completed, 7 days" value={done7.length} tone="done" />
        <KpiTile label="No shows, 30 days" value={noShow30.length} tone={noShow30.length ? "exception" : "neutral"} />
      </KpiRow>
      <div className="mt-4 grid gap-4">
        <TableSection title="Needs truck details" description="Add the truck, driver and pick a slot to receive the gate pass.">
          <BookingsTable rows={needs} columns={["expected", "reference", "direction", "customer", "cargo", "quantity", "priority", "status"]} linkFor={(r) => `/carrier/bookings/${r.booking.id}`} emptyTitle="Nothing waiting on you." />
        </TableSection>
        <TableSection title="Today" description={`${todayRows.length} bookings today`}>
          <BookingsTable rows={todayRows} columns={["slot", "reference", "direction", "customer", "plate", "driver", "dock", "pass", "status", "flags"]} linkFor={(r) => `/carrier/bookings/${r.booking.id}`} emptyTitle="No bookings today." />
        </TableSection>
        <TableSection title="Upcoming 7 days">
          <BookingsTable rows={upcoming} columns={["slot", "reference", "direction", "customer", "cargo", "plate", "dock", "pass", "status", "flags"]} linkFor={(r) => `/carrier/bookings/${r.booking.id}`} emptyTitle="No upcoming bookings." />
        </TableSection>
      </div>
    </>
  );
}
