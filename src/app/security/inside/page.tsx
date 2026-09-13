import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { EmptyState } from "@/components/app/empty-state";
import { BookingStatusBadge, DirectionBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { listBookings } from "@/lib/queries/bookings";
import { INSIDE_STATUSES } from "@/lib/status";
import { fmtTime, humanDuration, minutesBetween } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inside now" };

export default async function InsidePage() {
  await requireRole("security");
  const rows = (await listBookings({ statuses: INSIDE_STATUSES })).sort((a, b) => (a.booking.arrivedAt?.getTime() ?? 0) - (b.booking.arrivedAt?.getTime() ?? 0));
  const now = new Date();
  return (
    <>
      <PageHeader title={`${rows.length} truck${rows.length === 1 ? "" : "s"} inside`} description="Every truck that has gated in and not yet gated out." actions={<AutoRefresh seconds={20} />} />
      {rows.length === 0 ? (
        <EmptyState title="No trucks inside right now." />
      ) : (
        <ul className="grid gap-2">
          {rows.map(({ booking, shipment, carrier, dock }) => {
            const location = booking.status === "IN_YARD" ? "Yard" : booking.status === "ARRIVED" || booking.status === "EXCEPTION" ? "Gate" : dock?.code ?? "Dock";
            return (
              <li key={booking.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-semibold">{booking.truckPlate}</span>
                    <DirectionBadge direction={shipment.direction} />
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-mono">{shipment.reference}</span>, {carrier?.name ?? "No carrier"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{location}</span>, inside since {fmtTime(booking.arrivedAt)} ({humanDuration(booking.arrivedAt ? minutesBetween(booking.arrivedAt, now) : 0)})
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
