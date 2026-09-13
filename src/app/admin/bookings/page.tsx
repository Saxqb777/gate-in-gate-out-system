import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { ListFilters } from "@/components/app/list-filters";
import { listBookings, allDocks, allOrganisations } from "@/lib/queries/bookings";
import { param, dateParam, numParam, type SearchParams } from "@/lib/params";
import { BOOKING_STATUS_META, ACTIVE_STATUSES } from "@/lib/status";
import type { BookingStatus } from "@/lib/db/schema";
import { siteDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

export default async function AdminBookings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const status = param(sp, "status") ?? "active";
  const statuses: BookingStatus[] | undefined = status === "active" ? [...ACTIVE_STATUSES, "DRAFT", "AWAITING_TRUCK_DETAILS", "COMPLETED", "EXCEPTION"] : status === "all" ? undefined : [status as BookingStatus];
  const [rows, docks, carriers, customers] = await Promise.all([
    listBookings({
      statuses,
      direction: param(sp, "direction") as "inbound" | "outbound" | undefined,
      dockId: numParam(sp, "dock"),
      carrierOrgId: numParam(sp, "carrier"),
      customerOrgId: numParam(sp, "customer"),
      dateFrom: dateParam(sp, "from") ?? (status === "active" && !dateParam(sp, "to") ? siteDateKey() : undefined),
      dateTo: dateParam(sp, "to"),
      search: param(sp, "q"),
      order: status === "active" ? "slot_asc" : "slot_desc",
      limit: 300,
    }),
    allDocks(),
    allOrganisations("carrier"),
    allOrganisations("customer"),
  ]);
  return (
    <>
      <PageHeader title="Bookings" description="Every booking across all customers and carriers." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Bookings" }]} />
      <ListFilters
        fields={[
          { key: "status", label: "Status", type: "select", defaultValue: "active", options: [{ value: "active", label: "All active" }, { value: "all", label: "All" }, ...Object.entries(BOOKING_STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))] },
          { key: "direction", label: "Direction", type: "select", options: [{ value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }] },
          { key: "dock", label: "Dock", type: "select", options: docks.map((d) => ({ value: String(d.id), label: d.code })) },
          { key: "carrier", label: "Carrier", type: "select", options: carriers.map((c) => ({ value: String(c.id), label: c.name })) },
          { key: "customer", label: "Customer", type: "select", options: customers.map((c) => ({ value: String(c.id), label: c.name })) },
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "q", label: "Search", type: "text", placeholder: "Reference, plate, driver, pass" },
        ]}
      />
      <TableSection title={`${rows.length} bookings`} description={rows.length >= 300 ? "Showing 300. Narrow the filters to see more." : undefined}>
        <BookingsTable rows={rows} columns={["slot", "reference", "direction", "customer", "carrier", "plate", "driver", "dock", "pass", "status", "flags"]} linkFor={(r) => `/admin/bookings/${r.booking.id}`} emptyTitle="No bookings match these filters." />
      </TableSection>
    </>
  );
}
