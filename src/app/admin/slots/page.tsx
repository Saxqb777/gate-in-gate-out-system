import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { getAvailability } from "@/lib/engine/slots";
import { listBookings } from "@/lib/queries/bookings";
import { dateParam, type SearchParams } from "@/lib/params";
import { siteDateKey, fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { DateNav } from "./date-nav";
import { BlockSlotButton } from "./slot-cell-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Slot planner" };

export default async function SlotPlanner({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const date = dateParam(sp, "date") ?? siteDateKey();
  const cfg = await getConfig();
  const [inb, outb, bookings] = await Promise.all([
    getAvailability(db, cfg, { date, direction: "inbound", handlingMinutes: cfg.slotMinutes }),
    getAvailability(db, cfg, { date, direction: "outbound", handlingMinutes: cfg.slotMinutes }),
    listBookings({ date, statuses: ["PENDING_APPROVAL", "BOOKED", "ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING"] }),
  ]);
  const docks = inb.docks.map((d) => ({ dock: d.dock, slots: d.dock.type === "outbound" ? outb.docks.find((o) => o.dock.id === d.dock.id)!.slots : d.slots }));
  const times = [...new Map(docks.flatMap((d) => d.slots).map((s) => [s.startTime.slice(0, 5), s.endTime.slice(0, 5)])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const byBooking = new Map(bookings.map((b) => [b.booking.id, b]));
  const booked = docks.reduce((n, d) => n + d.slots.filter((s) => s.status === "booked").length, 0);
  const total = docks.filter((d) => d.dock.status === "active").reduce((n, d) => n + d.slots.length, 0);
  return (
    <>
      <PageHeader title="Slot planner" description={`${fmtDate(date)}: ${booked} of ${total} slots booked. Grid ${cfg.operatingStart} to ${cfg.operatingEnd}, ${cfg.slotMinutes} min slots, ${cfg.bufferMinutes} min buffer.`} actions={<DateNav date={date} base="/admin/slots" />} />
      {!inb.operatingDay ? (
        <div className="rounded-md border bg-card px-4 py-8 text-center text-sm text-muted-foreground">The site does not operate on this day.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-2 py-2 text-left font-medium text-muted-foreground">Slot</th>
                {docks.map(({ dock }) => (
                  <th key={dock.id} className={cn("min-w-[120px] px-1 py-2 text-center font-medium", dock.status !== "active" && "text-muted-foreground")}>
                    <div className="font-mono">{dock.code}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">{dock.status === "active" ? (dock.type === "both" ? "In and out" : dock.type) : dock.status}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map(([start, end]) => (
                <tr key={start} className="border-t">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground">{start} to {end}</td>
                  {docks.map(({ dock, slots }) => {
                    const s = slots.find((x) => x.startTime.slice(0, 5) === start);
                    if (!s) return <td key={dock.id} className="px-1 py-1" />;
                    const b = s.bookingId ? byBooking.get(s.bookingId) : null;
                    return (
                      <td key={dock.id} className="px-1 py-1 align-top">
                        {s.status === "booked" ? (
                          <div className="rounded border border-status-progress/30 bg-status-progress-bg px-1.5 py-1 text-status-progress">
                            {b ? (
                              <>
                                <Link href={`/admin/bookings/${b.booking.id}`} className="block truncate font-mono text-[11px] font-medium hover:underline">{b.shipment.reference}</Link>
                                <div className="truncate font-mono text-[10px]">{b.booking.truckPlate ?? "No truck yet"}</div>
                              </>
                            ) : (
                              <span className="text-[10px]">Booked</span>
                            )}
                          </div>
                        ) : s.status === "blocked" ? (
                          <div className="rounded border bg-muted px-1.5 py-1 text-muted-foreground">
                            <div className="truncate text-[10px]" title={s.blockedReason ?? ""}>Blocked{s.blockedReason ? `: ${s.blockedReason}` : ""}</div>
                            <BlockSlotButton slotId={s.id} blocked />
                          </div>
                        ) : dock.status !== "active" ? (
                          <div className="rounded border border-dashed px-1.5 py-1 text-[10px] text-muted-foreground">Out of service</div>
                        ) : (
                          <div className="flex items-center justify-between rounded border border-status-done/30 bg-status-done-bg px-1.5 py-1 text-status-done">
                            <span className="text-[10px]">Open</span>
                            <BlockSlotButton slotId={s.id} blocked={false} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
