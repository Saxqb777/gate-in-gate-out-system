import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { ListFilters } from "@/components/app/list-filters";
import { listBookings, allOrganisations } from "@/lib/queries/bookings";
import { param, dateParam, numParam, type SearchParams } from "@/lib/params";
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

export default async function AdminShipments({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const status = param(sp, "status");
  const [rows, customers] = await Promise.all([
    listBookings({ statuses: status ? STATUS_SETS[status] : undefined, customerOrgId: numParam(sp, "customer"), direction: param(sp, "direction") as "inbound" | "outbound" | undefined, dateFrom: dateParam(sp, "from"), dateTo: dateParam(sp, "to"), search: param(sp, "q"), order: "slot_desc", limit: 300 }),
    allOrganisations("customer"),
  ]);
  return (
    <>
      <PageHeader title="Shipments" description="Requests raised by every business unit." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Shipments" }]} />
      <ListFilters
        fields={[
          { key: "customer", label: "Customer", type: "select", options: customers.map((c) => ({ value: String(c.id), label: c.name })) },
          { key: "status", label: "Status", type: "select", options: Object.keys(STATUS_SETS).map((k) => ({ value: k, label: SHIPMENT_STATUS_META[k as keyof typeof SHIPMENT_STATUS_META].label })) },
          { key: "direction", label: "Direction", type: "select", options: [{ value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }] },
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "q", label: "Search", type: "text", placeholder: "Reference, cargo, container" },
        ]}
      />
      <TableSection title={`${rows.length} shipments`}>
        <BookingsTable rows={rows} columns={["expected", "reference", "direction", "customer", "carrier", "cargo", "quantity", "docs", "priority", "shipmentStatus"]} linkFor={(r) => `/admin/bookings/${r.booking.id}`} emptyTitle="No shipments match these filters." />
      </TableSection>
    </>
  );
}
