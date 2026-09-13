import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { BookingsTable } from "@/components/app/bookings-table";
import { ListFilters } from "@/components/app/list-filters";
import { listBookings } from "@/lib/queries/bookings";
import { param, dateParam, type SearchParams } from "@/lib/params";
import { INSIDE_STATUSES, ACTIVE_STATUSES } from "@/lib/status";
import type { BookingStatus } from "@/lib/db/schema";
import { siteDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

const STATUS_SETS: Record<string, BookingStatus[] | undefined> = {
  active: ACTIVE_STATUSES,
  needs: ["AWAITING_TRUCK_DETAILS"],
  booked: ["PENDING_APPROVAL", "BOOKED"],
  inside: INSIDE_STATUSES,
  completed: ["GATE_OUT"],
  closed: ["CANCELLED", "NO_SHOW", "REJECTED"],
  all: undefined,
};

export default async function CarrierBookings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole("carrier");
  const sp = await searchParams;
  const status = param(sp, "status") ?? "active";
  const rows = await listBookings({
    carrierOrgId: user.organisationId,
    statuses: STATUS_SETS[status] ?? ACTIVE_STATUSES,
    direction: param(sp, "direction") as "inbound" | "outbound" | undefined,
    dateFrom: dateParam(sp, "from") ?? (status === "active" ? siteDateKey() : undefined),
    dateTo: dateParam(sp, "to"),
    search: param(sp, "q"),
    order: status === "completed" || status === "closed" || status === "all" ? "slot_desc" : "slot_asc",
  });
  return (
    <>
      <PageHeader title="Bookings" description="Every shipment assigned to your company." crumbs={[{ label: "Carrier", href: "/carrier" }, { label: "Bookings" }]} />
      <ListFilters
        fields={[
          { key: "status", label: "Status", type: "select", defaultValue: "active", options: [{ value: "active", label: "Active" }, { value: "needs", label: "Needs truck details" }, { value: "booked", label: "Booked" }, { value: "inside", label: "Inside" }, { value: "completed", label: "Completed" }, { value: "closed", label: "Cancelled or no show" }, { value: "all", label: "All" }] },
          { key: "direction", label: "Direction", type: "select", options: [{ value: "inbound", label: "Inbound" }, { value: "outbound", label: "Outbound" }] },
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
          { key: "q", label: "Search", type: "text", placeholder: "Reference, plate, driver, cargo" },
        ]}
      />
      <TableSection title={`${rows.length} bookings`}>
        <BookingsTable rows={rows} columns={["slot", "reference", "direction", "customer", "cargo", "plate", "driver", "dock", "pass", "status", "flags"]} linkFor={(r) => `/carrier/bookings/${r.booking.id}`} emptyTitle="No bookings match these filters." />
      </TableSection>
    </>
  );
}
