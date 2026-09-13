import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { EmptyState } from "@/components/app/empty-state";
import { BookingStatusBadge, DirectionBadge, TonePill } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { listBookings } from "@/lib/queries/bookings";
import { fmtTime, siteDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Expected today" };

export default async function ExpectedPage() {
  await requireRole("security");
  const today = siteDateKey();
  const rows = await listBookings({ statuses: ["BOOKED", "PENDING_APPROVAL"], date: today });
  const noShows = await listBookings({ statuses: ["NO_SHOW"], date: today });
  const now = new Date();
  return (
    <>
      <PageHeader title={`${rows.length} expected today`} description={noShows.length ? `${noShows.length} no show${noShows.length === 1 ? "" : "s"} so far today.` : "Booked trucks that have not arrived yet."} actions={<AutoRefresh seconds={60} />} />
      {rows.length === 0 ? (
        <EmptyState title="Nothing else expected today." />
      ) : (
        <ul className="grid gap-2">
          {rows.map(({ booking, shipment, carrier, dock }) => {
            const overdue = booking.slotEnd ? booking.slotEnd < now : false;
            return (
              <li key={booking.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
                <div className="w-14 shrink-0 text-center">
                  <div className="font-mono text-lg font-semibold">{fmtTime(booking.slotStart)}</div>
                  <div className="text-[11px] text-muted-foreground">{dock?.code ?? "No dock"}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-semibold">{booking.truckPlate}</span>
                    <DirectionBadge direction={shipment.direction} />
                    <BookingStatusBadge status={booking.status} />
                    {booking.rescheduledBySystem && <TonePill tone="waiting">Rescheduled</TonePill>}
                    {overdue && <TonePill tone="exception">Slot passed</TonePill>}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {booking.driverName}, {carrier?.name ?? "No carrier"}
                  </div>
                </div>
                <Button asChild size="lg" className="h-11">
                  <Link href={`/security?q=${encodeURIComponent(booking.gatePassNumber ?? shipment.reference)}`}>Open</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
