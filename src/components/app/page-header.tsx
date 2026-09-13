import { Breadcrumbs, type Crumb } from "./shell";

export function PageHeader({ title, description, actions, crumbs }: { title: string; description?: string; actions?: React.ReactNode; crumbs?: Crumb[] }) {
  return (
    <div className="mb-4">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
