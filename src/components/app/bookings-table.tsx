import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingStatusBadge, ShipmentStatusBadge, DirectionBadge, PriorityBadge, TonePill } from "./status-badge";
import { EmptyState } from "./empty-state";
import type { BookingRow } from "@/lib/queries/bookings";
import { fmtDate, fmtTime } from "@/lib/time";

export type BookingColumn = "slot" | "expected" | "reference" | "direction" | "customer" | "carrier" | "cargo" | "quantity" | "docs" | "plate" | "driver" | "dock" | "pass" | "status" | "shipmentStatus" | "priority" | "flags";

const HEAD: Record<BookingColumn, string> = {
  slot: "Slot",
  expected: "Expected",
  reference: "Reference",
  direction: "Direction",
  customer: "Customer",
  carrier: "Carrier",
  cargo: "Cargo",
  quantity: "Qty",
  docs: "BL / Invoice",
  plate: "Truck",
  driver: "Driver",
  dock: "Dock",
  pass: "Gate pass",
  status: "Status",
  shipmentStatus: "Status",
  priority: "Priority",
  flags: "",
};

/** One table for every list of bookings in the product. Pick the columns and the link target per role. */
export function BookingsTable({ rows, columns, linkFor, emptyTitle = "Nothing to show.", emptyDescription, footer }: { rows: BookingRow[]; columns: BookingColumn[]; linkFor: (row: BookingRow) => string; emptyTitle?: string; emptyDescription?: string; footer?: React.ReactNode }) {
  if (!rows.length) return <div className="p-3"><EmptyState title={emptyTitle} description={emptyDescription} /></div>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className={c === "quantity" ? "text-right" : undefined}>
                {HEAD[c]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { booking: b, shipment: s } = row;
            return (
              <TableRow key={b.id}>
                {columns.map((c) => (
                  <TableCell key={c} className={c === "quantity" ? "text-right tabular" : c === "cargo" ? "max-w-[260px] truncate" : undefined}>
                    {cell(c, row, linkFor)}
                  </TableCell>
                ))}
                {void s}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {footer}
    </>
  );
}

function cell(c: BookingColumn, row: BookingRow, linkFor: (row: BookingRow) => string) {
  const { booking: b, shipment: s, customer, carrier, dock } = row;
  switch (c) {
    case "slot":
      return b.slotStart ? (
        <span className="whitespace-nowrap">
          <span className="text-muted-foreground">{fmtDate(b.slotStart)}</span> <span className="font-mono">{fmtTime(b.slotStart)}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap text-muted-foreground">{fmtDate(s.expectedDate)}, no slot</span>
      );
    case "expected":
      return <span className="whitespace-nowrap">{fmtDate(s.expectedDate)}</span>;
    case "reference":
      return (
        <Link href={linkFor(row)} className="font-mono text-[13px] font-medium hover:underline">
          {s.reference}
        </Link>
      );
    case "direction":
      return <DirectionBadge direction={s.direction} />;
    case "customer":
      return customer.name;
    case "carrier":
      return carrier ? carrier.name : <span className="text-status-waiting">Not assigned</span>;
    case "cargo":
      return <span title={s.cargoDescription}>{s.cargoDescription}</span>;
    case "quantity":
      return s.quantity != null ? `${s.quantity} ${s.uom ?? ""}` : "";
    case "docs":
      return <span className="font-mono text-xs">{s.blNumber ?? s.invoiceNumber ?? s.containerNumber ?? ""}</span>;
    case "plate":
      return b.truckPlate ? <span className="font-mono text-[13px]">{b.truckPlate}</span> : <span className="text-muted-foreground">Pending</span>;
    case "driver":
      return b.driverName ?? "";
    case "dock":
      return dock ? <span className="font-mono text-[13px]">{dock.code}</span> : <span className="text-muted-foreground">None</span>;
    case "pass":
      return <span className="font-mono text-xs">{b.gatePassNumber ?? ""}</span>;
    case "status":
      return <BookingStatusBadge status={b.status} />;
    case "shipmentStatus":
      return <ShipmentStatusBadge status={s.status} />;
    case "priority":
      return <PriorityBadge priority={s.priority} />;
    case "flags":
      return (
        <span className="flex gap-1">
          {b.rescheduledBySystem && <TonePill tone="waiting" dot={false}>Rescheduled</TonePill>}
          {b.earlyArrivalPromoted && <TonePill tone="progress" dot={false}>Early promoted</TonePill>}
        </span>
      );
  }
}
