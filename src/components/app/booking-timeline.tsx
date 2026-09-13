import { cn } from "@/lib/utils";

export type TimelineItem = { at: string; label: string; detail?: string | null; by?: string | null; tone?: "waiting" | "progress" | "done" | "exception" | "neutral" };

const DOT: Record<NonNullable<TimelineItem["tone"]>, string> = {
  waiting: "bg-status-waiting",
  progress: "bg-status-progress",
  done: "bg-status-done",
  exception: "bg-status-exception",
  neutral: "bg-status-neutral",
};

/** Vertical list of dated events. Pass preformatted `at` strings. */
export function BookingTimeline({ items, emptyText = "No events yet." }: { items: TimelineItem[]; emptyText?: string }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{emptyText}</div>;
  return (
    <ol className="relative ml-2 border-l pl-4">
      {items.map((it, i) => (
        <li key={i} className="relative pb-3 last:pb-0">
          <span className={cn("absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-card", DOT[it.tone ?? "neutral"])} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium">{it.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{it.at}</span>
            {it.by && <span className="text-[11px] text-muted-foreground">by {it.by}</span>}
          </div>
          {it.detail && <div className="mt-0.5 text-xs text-muted-foreground">{it.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
