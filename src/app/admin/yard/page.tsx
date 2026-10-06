import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { TableSection } from "@/components/app/description-list";
import { EmptyState } from "@/components/app/empty-state";
import { DirectionBadge, PriorityBadge } from "@/components/app/status-badge";
import { KpiRow, KpiTile } from "@/components/app/kpi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { yardEntries, allDocks, listBookings } from "@/lib/queries/bookings";
import { fmtTime, fmtDateTime, humanDuration, minutesBetween } from "@/lib/time";
import { CallToDockButton } from "../_components/call-to-dock-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yard" };

export default async function YardPage() {
  await requireRole("admin");
  const now = new Date();
  const [yard, docks, onDock, cfg] = await Promise.all([yardEntries(), allDocks(), listBookings({ statuses: ["AT_DOCK", "HANDLING", "COMPLETED"] }), getConfig()]);
  const occupied = new Set(onDock.map((b) => b.booking.dockId));
  const freeDocks = docks.filter((d) => d.status === "active" && !occupied.has(d.id));
  const waits = yard.map((y) => minutesBetween(y.entry.enteredAt, now));
  const longest = waits.length ? Math.max(...waits) : 0;
  const freeInbound = freeDocks.filter((d) => d.type !== "outbound").length;
  const freeOutbound = freeDocks.filter((d) => d.type !== "inbound").length;
  const callable = yard.filter((y) => freeDocks.some((d) => d.type === "both" || d.type === y.shipment.direction)).length;
  return (
    <>
      <PageHeader title="Yard" description="Trucks inside the gate waiting for a dock, in queue order. Call the first one whose direction matches a free dock." actions={<AutoRefresh seconds={15} />} />
      <KpiRow>
        <KpiTile label="Waiting" value={yard.length} tone={yard.length ? "waiting" : "neutral"} hint={`${cfg.yardCapacity - yard.length} of ${cfg.yardCapacity} spaces free`} />
        <KpiTile label="Longest wait" value={longest ? humanDuration(longest) : "0 min"} tone={longest >= 60 ? "exception" : longest >= 30 ? "waiting" : "neutral"} />
        <KpiTile label="Free docks" value={freeDocks.length} tone={freeDocks.length ? "done" : "neutral"} hint={`${freeInbound} inbound, ${freeOutbound} outbound`} />
        <KpiTile label="Ready to call" value={callable} tone={callable ? "progress" : "neutral"} hint={callable ? "A matching dock is free" : "No matching dock free"} />
      </KpiRow>
      <div className="h-4" />
      <TableSection title="Waiting in yard" description="Position 1 is called first. Trucks waiting more than 30 minutes are marked.">
        {yard.length === 0 ? (
          <div className="p-3"><EmptyState title="Yard is empty." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pos</TableHead>
                <TableHead>Waiting since</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Booked slot</TableHead>
                <TableHead>Free dock</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yard.map((y) => {
                const compatible = freeDocks.filter((d) => d.type === "both" || d.type === y.shipment.direction).map((d) => ({ id: d.id, code: d.code, name: d.name }));
                const wait = minutesBetween(y.entry.enteredAt, now);
                return (
                  <TableRow key={y.entry.id} className={wait >= 30 ? "bg-status-waiting-bg/40" : undefined}>
                    <TableCell className="font-semibold tabular">{y.entry.position}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtTime(y.entry.enteredAt)} <span className={wait >= 60 ? "font-medium text-status-exception" : wait >= 30 ? "font-medium text-status-waiting" : "text-muted-foreground"}>({humanDuration(wait)})</span></TableCell>
                    <TableCell><Link href={`/admin/bookings/${y.booking.id}`} className="font-mono text-[13px] font-medium hover:underline">{y.shipment.reference}</Link></TableCell>
                    <TableCell><DirectionBadge direction={y.shipment.direction} /></TableCell>
                    <TableCell><PriorityBadge priority={y.shipment.priority} /></TableCell>
                    <TableCell className="font-mono text-[13px]">{y.booking.truckPlate}</TableCell>
                    <TableCell>{y.booking.driverName}</TableCell>
                    <TableCell>{y.carrier?.name}</TableCell>
                    <TableCell className="max-w-[160px] truncate" title={y.shipment.cargoDescription}>{y.shipment.cargoDescription}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(y.booking.originalSlotStart ?? y.booking.slotStart)}{y.dock ? `, ${y.dock.code}` : ""}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{compatible.length ? <span className="font-mono text-status-done">{compatible.map((d) => d.code).join(", ")}</span> : <span className="text-muted-foreground">None free</span>}</TableCell>
                    <TableCell className="text-right"><CallToDockButton bookingId={y.booking.id} reference={y.shipment.reference} docks={compatible} variant={compatible.length ? "default" : "outline"} /></TableCell>
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
