import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { ListFilters } from "@/components/app/list-filters";
import { Button } from "@/components/ui/button";
import { listBookings } from "@/lib/queries/bookings";
import { param, dateParam, type SearchParams } from "@/lib/params";
import { SHIPMENT_STATUS_META } from "@/lib/status";
import type { BookingStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments" };

const STATUS_SETS: Record<string, BookingStatus[]> = {
  AWAITING_CARRIER: ["DRAFT"],
  AWAITING_TRUCK_DETAILS: ["AWAITING_TRUCK_DETAILS"],
  PENDING_APPROVAL: ["PENDING_APPROVAL"],
  BOOKED: ["BOOKED"],
  IN_PROGRESS: ["ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING", "COMPLETED"],
  COMPLETED: ["GATE_OUT"],
  CANCELLED: ["CANCELLED"],
  REJECTED: ["REJECTED"],
  NO_SHOW: ["NO_SHOW"],
  EXCEPTION: ["EXCEPTION"],
};

export default async function CustomerShipments({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole("customer");
  const sp = await searchParams;
  const status = param(sp, "status");
  const rows = await listBookings({
    customerOrgId: user.organisationId,
    statuses: status ? STATUS_SETS[status] : undefined,
    direction: param(sp, "direction") as "inbound" | "outbound" | undefined,
    dateFrom: dateParam(sp, "from"),
    dateTo: dateParam(sp, "to"),
    search: param(sp, "q"),
    order: "slot_desc",
    limit: 300,
  });
  return (
    <>
      <PageHeader title="Shipments" description="Every request raised by your business unit." crumbs={[{ label: "Customer", href: "/customer" }, { label: "Shipments" }]} actions={<Button asChild><Link href="/customer/shipments/new">New shipment request</Link></Button>} />
      <ListFilters
        fields={[
          { key: "status", label: "Status", type: "select", options: Object.keys(STATUS_SETS).map((k) => ({ value: k, label: SHIPMENT_STATUS_META[k as keyof typeof SHIPMENT_STATUS_META].label })) },
          { key: "direction", label: "Direction", type: "select", options: [{ value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }] },
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "q", label: "Search", type: "text", placeholder: "Reference, cargo, carrier, plate" },
        ]}
      />
      <TableSection title={`${rows.length} shipments`} description={rows.length >= 300 ? "Showing the latest 300. Narrow the filters to see older shipments." : undefined}>
        <BookingsTable rows={rows} columns={["expected", "reference", "direction", "cargo", "quantity", "docs", "carrier", "slot", "plate", "shipmentStatus", "priority"]} linkFor={(r) => `/customer/shipments/${r.shipment.id}`} emptyTitle="No shipments match these filters." emptyDescription="Raise a new shipment request to get started." />
      </TableSection>
    </>
  );
}
