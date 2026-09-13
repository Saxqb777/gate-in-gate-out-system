"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAvailabilityAction } from "@/lib/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/time";

export type PickedSlot = { slotId: number; dockId: number; dockCode: string; dockName: string; date: string; startTime: string; endTime: string; startsAt: string; endsAt: string };

type SlotCell = { id: number; dockId: number; startTime: string; endTime: string; startsAt: string; endsAt: string; status: string; available: boolean; reason: string | null };
type DockCol = { id: number; code: string; name: string; type: string; status: string; slots: SlotCell[] };

/**
 * Availability grid for one day: rows are slot times, columns are docks.
 * Only docks that can take the shipment direction are shown. Cells explain why they are unavailable.
 */
export function SlotPicker({ bookingId, initialDate, minDate, maxDate, value, onChange, compact }: { bookingId: number; initialDate: string; minDate: string; maxDate: string; value: PickedSlot | null; onChange: (s: PickedSlot | null) => void; compact?: boolean }) {
  const [date, setDate] = useState(initialDate < minDate ? minDate : initialDate);
  const [docks, setDocks] = useState<DockCol[]>([]);
  const [operatingDay, setOperatingDay] = useState(true);
  const [handling, setHandling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    start(async () => {
      setError(null);
      const res = await getAvailabilityAction(bookingId, date);
      if (!res.ok) {
        setError(res.error);
        setDocks([]);
        return;
      }
      const a = res.data!;
      setOperatingDay(a.operatingDay);
      setHandling(a.handlingMinutes);
      setDocks(
        a.docks
          .filter((d) => d.slots.some((s) => s.reason !== "Dock does not handle this direction"))
          .map((d) => ({
            id: d.dock.id,
            code: d.dock.code,
            name: d.dock.name,
            type: d.dock.type,
            status: d.dock.status,
            slots: d.slots.map((s) => ({ id: s.id, dockId: s.dockId, startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5), startsAt: new Date(s.startsAt).toISOString(), endsAt: new Date(s.endsAt).toISOString(), status: s.status, available: s.available, reason: s.reason })),
          })),
      );
    });
  }, [bookingId, date]);

  const times = useMemo(() => {
    const set = new Map<string, string>();
    for (const d of docks) for (const s of d.slots) set.set(s.startTime, s.endTime);
    return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [docks]);

  const availableCount = docks.reduce((n, d) => n + d.slots.filter((s) => s.available).length, 0);

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button type="button" variant="outline" size="icon" onClick={() => setDate(addDaysKey(date, -1))} disabled={date <= minDate} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <Input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
        <Button type="button" variant="outline" size="icon" onClick={() => setDate(addDaysKey(date, 1))} disabled={date >= maxDate} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {pending ? "Loading slots..." : handling != null ? `${availableCount} slots free. Handling time ${handling} min.` : ""}
        </div>
      </div>
      {error && <div className="px-3 py-2 text-sm text-status-exception">{error}</div>}
      {!pending && !error && !operatingDay && <div className="px-3 py-6 text-center text-sm text-muted-foreground">The site does not operate on this day. Pick another date.</div>}
      {!pending && !error && operatingDay && docks.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-2 py-1.5 text-left font-medium text-muted-foreground">Slot</th>
                {docks.map((d) => (
                  <th key={d.id} className="px-1 py-1.5 text-center font-medium">
                    <div>{d.code}</div>
                    {!compact && <div className="text-[10px] font-normal text-muted-foreground">{d.name}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map(([start, end]) => (
                <tr key={start} className="border-t">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {start} to {end}
                  </td>
                  {docks.map((d) => {
                    const s = d.slots.find((x) => x.startTime === start);
                    if (!s) return <td key={d.id} className="px-1 py-1" />;
                    const selected = value?.slotId === s.id;
                    const cell = (
                      <button
                        type="button"
                        disabled={!s.available}
                        onClick={() => onChange(selected ? null : { slotId: s.id, dockId: d.id, dockCode: d.code, dockName: d.name, date, startTime: s.startTime, endTime: s.endTime, startsAt: s.startsAt, endsAt: s.endsAt })}
                        className={cn(
                          "h-7 w-full rounded border text-[11px] transition-colors",
                          s.available && !selected && "border-status-done/40 bg-status-done-bg text-status-done hover:bg-status-done hover:text-white",
                          selected && "border-primary-deep bg-primary text-white",
                          !s.available && "cursor-not-allowed border-border bg-muted text-muted-foreground/60",
                        )}
                      >
                        {selected ? "Selected" : s.available ? "Free" : s.status === "booked" ? "Booked" : s.status === "blocked" ? "Blocked" : "n/a"}
                      </button>
                    );
                    return (
                      <td key={d.id} className="px-1 py-1">
                        {s.available ? (
                          cell
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block">{cell}</span>
                            </TooltipTrigger>
                            <TooltipContent>{s.reason}</TooltipContent>
                          </Tooltip>
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
      {!pending && !error && operatingDay && docks.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No docks can take this shipment.</div>}
    </div>
  );
}
