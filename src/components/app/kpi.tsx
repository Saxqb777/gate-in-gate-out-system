import { cn } from "@/lib/utils";

export function KpiTile({ label, value, hint, tone, className }: { label: string; value: React.ReactNode; hint?: string; tone?: "waiting" | "progress" | "done" | "exception" | "neutral"; className?: string }) {
  const bar = tone ? { waiting: "bg-status-waiting", progress: "bg-status-progress", done: "bg-status-done", exception: "bg-status-exception", neutral: "bg-status-neutral" }[tone] : "bg-primary";
  return (
    <div className={cn("relative overflow-hidden rounded-md border bg-card px-3.5 py-3", className)}>
      <div className={cn("absolute inset-y-0 left-0 w-0.75", bar)} />
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular leading-none">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}
