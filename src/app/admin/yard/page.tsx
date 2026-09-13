import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { TableSection } from "@/components/app/description-list";
import { EmptyState } from "@/components/app/empty-state";
import { DirectionBadge } from "@/components/app/status-badge";
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
  return (
    <>
      <PageHeader title="Yard" description={`${yard.length} of ${cfg.yardCapacity} yard spaces used.`} actions={<AutoRefresh seconds={15} />} />
      <TableSection title="Waiting in yard" description="Trucks gated in with no dock free, in queue order.">
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
                <TableHead>Truck</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Booked slot</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yard.map((y) => {
                const compatible = freeDocks.filter((d) => d.type === "both" || d.type === y.shipment.direction).map((d) => ({ id: d.id, code: d.code, name: d.name }));
                return (
                  <TableRow key={y.entry.id}>
                    <TableCell className="font-semibold tabular">{y.entry.position}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtTime(y.entry.enteredAt)} <span className="text-muted-foreground">({humanDuration(minutesBetween(y.entry.enteredAt, now))})</span></TableCell>
                    <TableCell><Link href={`/admin/bookings/${y.booking.id}`} className="font-mono text-[13px] font-medium hover:underline">{y.shipment.reference}</Link></TableCell>
                    <TableCell><DirectionBadge direction={y.shipment.direction} /></TableCell>
                    <TableCell className="font-mono text-[13px]">{y.booking.truckPlate}</TableCell>
                    <TableCell>{y.booking.driverName}</TableCell>
                    <TableCell>{y.carrier?.name}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{y.shipment.cargoDescription}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(y.booking.originalSlotStart ?? y.booking.slotStart)}{y.dock ? `, ${y.dock.code}` : ""}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{y.entry.reason}</TableCell>
                    <TableCell className="text-right"><CallToDockButton bookingId={y.booking.id} reference={y.shipment.reference} docks={compatible} /></TableCell>
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
