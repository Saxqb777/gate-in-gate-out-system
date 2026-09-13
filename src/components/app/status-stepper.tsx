import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/db/schema";
import { BOOKING_STATUS_META } from "@/lib/status";

const STEPS: { label: string; reached: BookingStatus[] }[] = [
  { label: "Requested", reached: ["DRAFT"] },
  { label: "Carrier assigned", reached: ["AWAITING_TRUCK_DETAILS"] },
  { label: "Booked", reached: ["PENDING_APPROVAL", "BOOKED"] },
  { label: "Arrived", reached: ["ARRIVED", "IN_YARD"] },
  { label: "At dock", reached: ["AT_DOCK", "HANDLING"] },
  { label: "Completed", reached: ["COMPLETED"] },
  { label: "Gated out", reached: ["GATE_OUT"] },
];

/** Horizontal lifecycle for a booking. Terminal side states show a note instead of a step. */
export function StatusStepper({ status }: { status: BookingStatus }) {
  const terminal = ["CANCELLED", "REJECTED", "NO_SHOW", "EXCEPTION"].includes(status);
  const idx = STEPS.findIndex((s) => s.reached.includes(status));
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <ol className="flex flex-wrap items-center gap-y-2">
        {STEPS.map((s, i) => {
          const done = !terminal && i < idx;
          const current = !terminal && i === idx;
          return (
            <li key={s.label} className="flex items-center">
              <div className="flex items-center gap-2">
                <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold", done && "border-status-done bg-status-done text-white", current && "border-primary bg-primary text-white", !done && !current && "border-border text-muted-foreground")}>{i + 1}</span>
                <span className={cn("text-xs", current ? "font-semibold" : done ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className={cn("mx-3 h-px w-6 sm:w-10", done ? "bg-status-done" : "bg-border")} />}
            </li>
          );
        })}
      </ol>
      {terminal && <div className="mt-2 text-xs font-medium text-status-exception">{BOOKING_STATUS_META[status].label}: {BOOKING_STATUS_META[status].description}</div>}
    </div>
  );
}
