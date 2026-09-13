import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { KpiRow, KpiTile } from "@/components/app/kpi";
import { Section } from "@/components/app/description-list";
import { ListFilters } from "@/components/app/list-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trucksPerDay, turnaroundPerDay, dockUtilisation, punctuality, noShowsAndCancellations, exceptionsByType, defaultRange } from "@/lib/queries/reports";
import { dateParam, type SearchParams } from "@/lib/params";
import { EXCEPTION_LABEL } from "@/lib/status";
import { fmtDate, humanDuration } from "@/lib/time";
import { TrucksPerDayChart, TurnaroundChart, UtilisationChart, PunctualityChart, DownloadCsv } from "./charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const d = defaultRange();
  const range = { from: dateParam(sp, "from") ?? d.from, to: dateParam(sp, "to") ?? d.to };
  const cfg = await getConfig();
  const [perDay, ta, util, punct, ns, exc] = await Promise.all([trucksPerDay(range), turnaroundPerDay(range), dockUtilisation(range, cfg), punctuality(range, cfg), noShowsAndCancellations(range), exceptionsByType(range)]);
  const totalTrucks = perDay.reduce((n, x) => n + x.inbound + x.outbound, 0);
  const pct = (n: number) => (punct.total ? `${Math.round((n / punct.total) * 100)}%` : "0%");
  return (
    <>
      <PageHeader title="Reports" description={`${fmtDate(range.from)} to ${fmtDate(range.to)}`} crumbs={[{ label: "Admin", href: "/admin" }, { label: "Reports" }]} />
      <ListFilters fields={[{ key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" }]} />
      <KpiRow>
        <KpiTile label="Trucks gated in" value={totalTrucks} hint={`${(totalTrucks / Math.max(1, perDay.length)).toFixed(1)} per day`} />
        <KpiTile label="Avg gate to gate" value={humanDuration(ta.overall.avgGate)} hint={`Median ${humanDuration(ta.overall.median)}`} tone="progress" />
        <KpiTile label="On time arrivals" value={pct(punct.totals.on_time)} tone="done" hint={`${punct.totals.on_time} of ${punct.total}`} />
        <KpiTile label="Late arrivals" value={pct(punct.totals.late)} tone={punct.totals.late ? "exception" : "neutral"} hint={`Over ${cfg.lateToleranceMinutes} min after slot`} />
        <KpiTile label="No shows" value={ns.totals.noShows} tone={ns.totals.noShows ? "exception" : "neutral"} hint={`${ns.totals.cancellations} cancellations`} />
        <KpiTile label="Exceptions" value={exc.reduce((n, e) => n + e.count, 0)} tone="waiting" />
      </KpiRow>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Section title="Trucks per day" description="Gated in, split by direction">
          <TrucksPerDayChart data={perDay} />
        </Section>
        <Section title="Turnaround per day" description="Average minutes from gate in to gate out, on dock, and handling" actions={<DownloadCsv filename={`turnaround-${range.from}-${range.to}.csv`} header={["Day", "Trucks", "Avg gate to gate (min)", "Avg dock time (min)", "Avg handling (min)", "Best", "Worst"]} rows={ta.rows.map((r) => [r.day, r.trucks, r.avgGate, r.avgDock, r.avgHandling, r.best, r.worst])} />}>
          <TurnaroundChart data={ta.rows} />
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Trucks</TableHead><TableHead className="text-right">Gate to gate</TableHead><TableHead className="text-right">Dock time</TableHead><TableHead className="text-right">Handling</TableHead><TableHead className="text-right">Best</TableHead><TableHead className="text-right">Worst</TableHead></TableRow></TableHeader>
              <TableBody>
                {ta.rows.map((r) => (
                  <TableRow key={r.day}><TableCell>{fmtDate(r.day)}</TableCell><TableCell className="text-right tabular">{r.trucks}</TableCell><TableCell className="text-right tabular">{humanDuration(r.avgGate)}</TableCell><TableCell className="text-right tabular">{humanDuration(r.avgDock)}</TableCell><TableCell className="text-right tabular">{humanDuration(r.avgHandling)}</TableCell><TableCell className="text-right tabular">{humanDuration(r.best)}</TableCell><TableCell className="text-right tabular">{humanDuration(r.worst)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
        <Section title="Dock utilisation" description={`Time with a truck on the dock as a share of operating hours (${cfg.operatingStart} to ${cfg.operatingEnd})`}>
          <UtilisationChart data={util} />
          <Table>
            <TableHeader><TableRow><TableHead>Dock</TableHead><TableHead className="text-right">Trucks</TableHead><TableHead className="text-right">Dock minutes</TableHead><TableHead className="text-right">Utilisation</TableHead></TableRow></TableHeader>
            <TableBody>
              {util.map((u) => (
                <TableRow key={u.dockId}><TableCell className="font-mono text-[13px]">{u.code} <span className="font-sans text-muted-foreground">{u.name}</span></TableCell><TableCell className="text-right tabular">{u.trucks}</TableCell><TableCell className="text-right tabular">{u.minutes}</TableCell><TableCell className="text-right tabular">{u.utilisation}%</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section title="On time, early and late arrivals" description={`Early is more than 5 minutes before the slot, late is more than ${cfg.lateToleranceMinutes} minutes after`}>
          <PunctualityChart data={punct.byCarrier} />
          <Table>
            <TableHeader><TableRow><TableHead>Carrier</TableHead><TableHead className="text-right">Trucks</TableHead><TableHead className="text-right">On time</TableHead><TableHead className="text-right">Early</TableHead><TableHead className="text-right">Late</TableHead><TableHead className="text-right">Avg vs slot</TableHead></TableRow></TableHeader>
            <TableBody>
              {punct.byCarrier.map((c) => (
                <TableRow key={c.carrier}><TableCell>{c.carrier}</TableCell><TableCell className="text-right tabular">{c.trucks}</TableCell><TableCell className="text-right tabular">{Math.round((c.on_time / c.trucks) * 100)}%</TableCell><TableCell className="text-right tabular">{Math.round((c.early / c.trucks) * 100)}%</TableCell><TableCell className="text-right tabular">{Math.round((c.late / c.trucks) * 100)}%</TableCell><TableCell className="text-right tabular">{c.avgDiff > 0 ? `+${c.avgDiff}` : c.avgDiff} min</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section title="No shows and cancellations" description="By carrier, for slots in the period">
          <Table>
            <TableHeader><TableRow><TableHead>Carrier</TableHead><TableHead className="text-right">No shows</TableHead><TableHead className="text-right">Cancellations</TableHead></TableRow></TableHeader>
            <TableBody>
              {ns.perCarrier.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">None in this period.</TableCell></TableRow>}
              {ns.perCarrier.map((c) => (
                <TableRow key={c.carrier}><TableCell>{c.carrier}</TableCell><TableCell className="text-right tabular">{c.noShows}</TableCell><TableCell className="text-right tabular">{c.cancellations}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section title="Exceptions by type" description="Flagged by security at the gate">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
            <TableBody>
              {exc.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground">None in this period.</TableCell></TableRow>}
              {exc.map((e) => (
                <TableRow key={e.type ?? "none"}><TableCell>{e.type ? EXCEPTION_LABEL[e.type] : "Unspecified"}</TableCell><TableCell className="text-right tabular">{e.count}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>
    </>
  );
}
