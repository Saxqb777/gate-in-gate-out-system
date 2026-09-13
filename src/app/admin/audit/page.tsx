import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { ListFilters } from "@/components/app/list-filters";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAudit, diffSummary } from "@/lib/queries/audit";
import { param, dateParam, numParam, withParams, type SearchParams } from "@/lib/params";
import { fmtDateTimeSeconds } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const ENTITY_TYPES = ["booking", "shipment", "dock", "slot", "config", "user", "organisation", "custom_field", "cargo_type"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const { rows, count, page, pageSize } = await listAudit({ entityType: param(sp, "entity"), action: param(sp, "action"), actor: param(sp, "actor"), from: dateParam(sp, "from"), to: dateParam(sp, "to"), search: param(sp, "q"), page: numParam(sp, "page") ?? 1 });
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <>
      <PageHeader title="Audit log" description="Every change with who made it and when. Nothing here can be edited or deleted." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit log" }]} />
      <ListFilters
        fields={[
          { key: "entity", label: "Entity", type: "select", options: ENTITY_TYPES.map((e) => ({ value: e, label: e.replaceAll("_", " ") })) },
          { key: "action", label: "Action", type: "text", placeholder: "GATE_IN, RESCHEDULED" },
          { key: "actor", label: "Actor", type: "text", placeholder: "Name or system" },
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "q", label: "Search", type: "text", placeholder: "Reason or value" },
        ]}
      />
      <TableSection
        title={`${count} entries`}
        description={`Page ${page} of ${pages}`}
        actions={
          <div className="flex gap-1">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}><Link href={`/admin/audit${withParams(sp, { page: page - 1 })}`} aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>Previous</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href={`/admin/audit${withParams(sp, { page: page + 1 })}`} className={page >= pages ? "pointer-events-none opacity-50" : ""}>Next</Link></Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="p-3"><EmptyState title="No audit entries match." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ entry, actor }) => {
                const diff = diffSummary(entry.beforeJson, entry.afterJson);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{fmtDateTimeSeconds(entry.occurredAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {entry.entityType === "booking" ? (
                        <Link href={`/admin/bookings/${entry.entityId}`} className="hover:underline">booking {entry.entityId}</Link>
                      ) : (
                        <span>{entry.entityType.replaceAll("_", " ")} {entry.entityId || ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{entry.action}</TableCell>
                    <TableCell className="whitespace-nowrap">{actor?.name ?? entry.actorLabel ?? "system"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={entry.reason ?? ""}>{entry.reason}</TableCell>
                    <TableCell className="max-w-[360px] text-xs">
                      {diff.length === 0 ? "" : diff.length <= 3 ? diff.map((d, i) => <div key={i} className="truncate font-mono text-[11px]" title={d}>{d}</div>) : (
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">{diff.length} fields changed</summary>
                          {diff.map((d, i) => <div key={i} className="font-mono text-[11px]">{d}</div>)}
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableSection>
    </>
  );
}
