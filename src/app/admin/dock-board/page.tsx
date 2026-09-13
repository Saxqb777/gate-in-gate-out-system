import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { BookingStatusBadge, DirectionBadge, TonePill } from "@/components/app/status-badge";
import { listBookings, allDocks, yardEntries, rowHandlingMinutes } from "@/lib/queries/bookings";
import { fmtTime, humanDuration, minutesBetween } from "@/lib/time";
import { cn } from "@/lib/utils";
import { DockActions } from "./dock-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dock board" };

export default async function DockBoard() {
  await requireRole("admin");
  const now = new Date();
  const [docks, onDock, upcoming, yard, cfg] = await Promise.all([
    allDocks(),
    listBookings({ statuses: ["AT_DOCK", "HANDLING", "COMPLETED"] }),
    listBookings({ statuses: ["BOOKED", "PENDING_APPROVAL"], dateFrom: undefined, order: "slot_asc", limit: 400 }),
    yardEntries(),
    getConfig(),
  ]);
  const active = docks.filter((d) => d.status === "active");
  const occupied = active.filter((d) => onDock.some((b) => b.booking.dockId === d.id)).length;
  return (
    <>
      <PageHeader title="Dock board" description={`${occupied} of ${active.length} active docks occupied, ${yard.length} truck${yard.length === 1 ? "" : "s"} in yard.`} actions={<AutoRefresh seconds={15} />} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {docks.map((d) => {
          const current = onDock.find((b) => b.booking.dockId === d.id);
          const next = upcoming.filter((b) => b.booking.dockId === d.id && b.booking.slotStart && b.booking.slotStart >= now).slice(0, 3);
          const inactive = d.status !== "active";
          return (
            <div key={d.id} className={cn("flex flex-col rounded-md border bg-card", inactive && "opacity-70")}>
              <div className={cn("flex items-center justify-between border-b px-3 py-2", current ? "bg-status-progress-bg" : inactive ? "bg-muted" : "bg-status-done-bg")}>
                <div>
                  <div className="font-mono text-sm font-semibold">{d.code}</div>
                  <div className="text-[11px] text-muted-foreground">{d.name}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <TonePill tone="neutral" dot={false}>{d.type === "both" ? "In and out" : d.type === "inbound" ? "Inbound" : "Outbound"}</TonePill>
                  {inactive ? <TonePill tone="exception" dot={false}>{d.status === "maintenance" ? "Maintenance" : "Blocked"}</TonePill> : current ? <TonePill tone="progress">Occupied</TonePill> : <TonePill tone="done">Free</TonePill>}
                </div>
              </div>
              <div className="flex-1 px-3 py-2.5">
                {current ? (
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/bookings/${current.booking.id}`} className="font-mono text-[13px] font-medium hover:underline">{current.shipment.reference}</Link>
                      <BookingStatusBadge status={current.booking.status} />
                    </div>
                    <div className="font-mono text-lg font-semibold">{current.booking.truckPlate}</div>
                    <div className="text-xs text-muted-foreground">{current.carrier?.name}, <DirectionBadge direction={current.shipment.direction} /></div>
                    <div className="truncate text-xs" title={current.shipment.cargoDescription}>{current.shipment.cargoDescription}</div>
                    <div className="text-xs">
                      Docked {fmtTime(current.booking.dockInAt)}, {humanDuration(current.booking.dockInAt ? minutesBetween(current.booking.dockInAt, now) : 0)} on dock. Expected {rowHandlingMinutes(current, cfg.defaultHandlingMinutes)} min.
                    </div>
                    <DockActions bookingId={current.booking.id} status={current.booking.status} />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{inactive ? d.notes || "Out of service" : next.length ? `Free until ${fmtTime(next[0].booking.slotStart)}` : "Free, nothing booked"}</div>
                )}
              </div>
              {next.length > 0 && (
                <div className="border-t px-3 py-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Next up</div>
                  <ul className="grid gap-1 text-xs">
                    {next.map((b) => (
                      <li key={b.booking.id} className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{fmtTime(b.booking.slotStart)}</span>
                        <Link href={`/admin/bookings/${b.booking.id}`} className="font-mono hover:underline">{b.shipment.reference}</Link>
                        <span className="ml-auto font-mono">{b.booking.truckPlate}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
