import { cn } from "@/lib/utils";
import { BOOKING_STATUS_META, SHIPMENT_STATUS_META, type StatusTone } from "@/lib/status";
import type { BookingStatus, ShipmentStatus } from "@/lib/db/schema";

const TONE_CLASS: Record<StatusTone, string> = {
  waiting: "bg-status-waiting-bg text-status-waiting border-status-waiting/30",
  progress: "bg-status-progress-bg text-status-progress border-status-progress/30",
  done: "bg-status-done-bg text-status-done border-status-done/30",
  exception: "bg-status-exception-bg text-status-exception border-status-exception/30",
  neutral: "bg-status-neutral-bg text-status-neutral border-status-neutral/30",
};

export function TonePill({ tone, children, className, dot = true }: { tone: StatusTone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4", TONE_CLASS[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const m = BOOKING_STATUS_META[status];
  return (
    <TonePill tone={m.tone} className={className}>
      {m.label}
    </TonePill>
  );
}

export function ShipmentStatusBadge({ status, className }: { status: ShipmentStatus; className?: string }) {
  const m = SHIPMENT_STATUS_META[status];
  return (
    <TonePill tone={m.tone} className={className}>
      {m.label}
    </TonePill>
  );
}

export function DirectionBadge({ direction }: { direction: "inbound" | "outbound" }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium", direction === "inbound" ? "border-status-progress/30 bg-status-progress-bg text-status-progress" : "border-primary/30 bg-accent text-primary-deep")}>
      {direction === "inbound" ? "Inbound" : "Outbound"}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "normal" || priority === "low") return <span className="text-xs text-muted-foreground capitalize">{priority}</span>;
  return (
    <TonePill tone={priority === "urgent" ? "exception" : "waiting"} dot={false}>
      {priority === "urgent" ? "Urgent" : "High"}
    </TonePill>
  );
}
