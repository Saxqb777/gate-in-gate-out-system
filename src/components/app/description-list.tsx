import { cn } from "@/lib/utils";

export function DescriptionList({ items, columns = 2, className }: { items: { label: string; value: React.ReactNode; mono?: boolean }[]; columns?: 1 | 2 | 3 | 4; className?: string }) {
  const cols = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3", cols, className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{it.label}</dt>
          <dd className={cn("mt-0.5 text-sm", it.mono && "font-mono text-[13px]")}>{it.value ?? <span className="text-muted-foreground">Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, description, children, actions, className }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function TableSection({ title, description, children, actions, className }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-md border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
