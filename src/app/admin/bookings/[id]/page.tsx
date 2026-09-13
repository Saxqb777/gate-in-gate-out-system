import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { getBookingRow, bookingEvents, bookingAudit, customValuesFor, listBookings, allDocks, rowHandlingMinutes } from "@/lib/queries/bookings";
import { diffSummary } from "@/lib/queries/audit";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Section, TableSection } from "@/components/app/description-list";
import { BookingStatusBadge, DirectionBadge, PriorityBadge, TonePill } from "@/components/app/status-badge";
import { BookingTimeline } from "@/components/app/booking-timeline";
import { StatusStepper } from "@/components/app/status-stepper";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { arrivalClass } from "@/lib/engine/gate";
import { GATE_EVENT_LABEL, EXCEPTION_LABEL, BOOKING_STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime, fmtDateTimeSeconds, fmtTime, humanDuration, minutesBetween, siteDateKey, addDaysKey } from "@/lib/time";
import { BookingActions } from "./booking-actions";

export const dynamic = "force-dynamic";

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const row = await getBookingRow(Number(id));
  if (!row) notFound();
  const { booking: b, shipment: s, customer, carrier, dock, cargoType } = row;
  const [cfg, events, audit, shipValues, bookValues, onDock, docks] = await Promise.all([getConfig(), bookingEvents(b.id), bookingAudit(b.id, s.id), customValuesFor("shipment", s.id), customValuesFor("booking", b.id), listBookings({ statuses: ["AT_DOCK", "HANDLING", "COMPLETED"] }), allDocks()]);
  const occupied = new Set(onDock.map((x) => x.booking.dockId));
  const freeDocks = docks.filter((d) => d.status === "active" && !occupied.has(d.id) && (d.type === "both" || d.type === s.direction)).map((d) => ({ id: d.id, code: d.code, name: d.name }));
  const arrival = b.arrivedAt && b.originalSlotStart ? arrivalClass({ slotStart: b.originalSlotStart, slotEnd: b.slotEnd }, cfg, b.arrivedAt) : null;
  const fmtCustom = (v: { field: { label: string; fieldType: string }; value: string | null }) => ({ label: v.field.label, value: v.field.fieldType === "checkbox" ? (v.value === "true" ? "Yes" : "No") : v.value });
  const today = siteDateKey();
  const turnaround = b.arrivedAt && b.gateOutAt ? minutesBetween(b.arrivedAt, b.gateOutAt) : null;
  const dockTime = b.dockInAt && b.handlingEndAt ? minutesBetween(b.dockInAt, b.handlingEndAt) : null;
  const handlingTime = b.handlingStartAt && b.handlingEndAt ? minutesBetween(b.handlingStartAt, b.handlingEndAt) : null;

  return (
    <>
      <PageHeader
        title={s.reference}
        description={BOOKING_STATUS_META[b.status].description}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Bookings", href: "/admin/bookings" }, { label: s.reference }]}
        actions={b.gatePassNumber ? <Button asChild variant="outline" size="sm"><Link href={`/api/gate-pass/${b.qrToken}/pdf`} target="_blank">Gate pass PDF</Link></Button> : undefined}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={b.status} />
        <DirectionBadge direction={s.direction} />
        <PriorityBadge priority={s.priority} />
        {b.earlyArrivalPromoted && <TonePill tone="progress">Early arrival promoted</TonePill>}
        {b.rescheduledBySystem && <TonePill tone="waiting">Rescheduled by system{b.rescheduleAcknowledged ? ", acknowledged" : ""}</TonePill>}
        {arrival && <TonePill tone={arrival === "late" ? "exception" : arrival === "early" ? "waiting" : "done"} dot={false}>Arrived {arrival.replace("_", " ")}</TonePill>}
      </div>
      <div className="mb-4 grid gap-3">
        <StatusStepper status={b.status} />
        <Section title="Actions">
          <BookingActions bookingId={b.id} reference={s.reference} status={b.status} initialDate={b.slotStart ? fmtDateKey(b.slotStart) : s.expectedDate < today ? today : s.expectedDate} minDate={today} maxDate={addDaysKey(today, cfg.bookingHorizonDays)} freeDocks={freeDocks} />
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="grid gap-4">
          <Section title="Booking">
            <DescriptionList
              columns={3}
              items={[
                { label: "Dock", value: dock ? `${dock.code}, ${dock.name}` : null },
                { label: "Slot", value: b.slotStart ? `${fmtDate(b.slotStart)}, ${fmtTime(b.slotStart)} to ${fmtTime(b.slotEnd)}` : null },
                { label: "Original slot", value: b.originalSlotStart && b.originalSlotStart.getTime() !== b.slotStart?.getTime() ? `${fmtDateTime(b.originalSlotStart)}${b.originalDockId && b.originalDockId !== b.dockId ? `, ${docks.find((d) => d.id === b.originalDockId)?.code ?? ""}` : ""}` : null },
                { label: "Gate pass", value: b.gatePassNumber, mono: true },
                { label: "Truck plate", value: b.truckPlate, mono: true },
                { label: "Trailer", value: b.trailerPlate, mono: true },
                { label: "Driver", value: b.driverName },
                { label: "Driver mobile", value: b.driverMobile, mono: true },
                { label: "Driver ID", value: b.driverIdNumber, mono: true },
                { label: "Truck type", value: b.truckType ? `${b.truckType}${b.capacity ? `, ${b.capacity}` : ""}` : null },
                { label: "Handling time", value: `${rowHandlingMinutes(row, cfg.defaultHandlingMinutes)} min` },
                { label: "Booked at", value: b.bookedAt ? fmtDateTime(b.bookedAt) : null },
                { label: "Arrived", value: b.arrivedAt ? fmtDateTime(b.arrivedAt) : null },
                { label: "Docked", value: b.dockInAt ? fmtDateTime(b.dockInAt) : null },
                { label: "Handling", value: b.handlingStartAt ? `${fmtTime(b.handlingStartAt)}${b.handlingEndAt ? ` to ${fmtTime(b.handlingEndAt)}` : ", in progress"}` : null },
                { label: "Gated out", value: b.gateOutAt ? fmtDateTime(b.gateOutAt) : null },
                { label: "Reschedule reason", value: b.rescheduleReason },
                { label: "Cancel reason", value: b.cancelReason ?? b.rejectionReason },
                ...bookValues.map(fmtCustom),
              ].filter((i) => i.value)}
            />
            {turnaround != null && (
              <div className="mt-4 grid grid-cols-3 gap-3 rounded border bg-muted/40 px-3 py-2 text-sm">
                <div><div className="text-[11px] uppercase text-muted-foreground">Gate to gate</div><div className="font-medium">{humanDuration(turnaround)}</div></div>
                <div><div className="text-[11px] uppercase text-muted-foreground">Dock time</div><div className="font-medium">{dockTime != null ? humanDuration(dockTime) : "n/a"}</div></div>
                <div><div className="text-[11px] uppercase text-muted-foreground">Handling</div><div className="font-medium">{handlingTime != null ? humanDuration(handlingTime) : "n/a"}</div></div>
              </div>
            )}
          </Section>
          <Section title="Shipment">
            <DescriptionList
              columns={3}
              items={[
                { label: "Customer", value: customer.name },
                { label: "Carrier", value: carrier?.name ?? "Not assigned" },
                { label: "Cargo", value: s.cargoDescription },
                { label: "Cargo type", value: cargoType?.name },
                { label: "Quantity", value: s.quantity != null ? `${s.quantity} ${s.uom ?? ""}` : null },
                { label: "Expected date", value: fmtDate(s.expectedDate) },
                { label: "BL number", value: s.blNumber, mono: true },
                { label: "Container", value: s.containerNumber, mono: true },
                { label: "Seal", value: s.sealNumber, mono: true },
                { label: "PO number", value: s.poNumber, mono: true },
                { label: "Invoice", value: s.invoiceNumber, mono: true },
                { label: "Notes", value: s.notes },
                { label: "Raised", value: fmtDateTime(s.createdAt) },
                ...shipValues.map(fmtCustom),
              ].filter((i) => i.value)}
            />
          </Section>
          <TableSection title="Audit trail" description="Every change to this booking and its shipment">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map(({ entry, actor }) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{fmtDateTimeSeconds(entry.occurredAt)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{entry.action}</TableCell>
                    <TableCell className="whitespace-nowrap">{actor?.name ?? entry.actorLabel ?? "system"}</TableCell>
                    <TableCell className="max-w-[240px] text-xs text-muted-foreground">{entry.reason}</TableCell>
                    <TableCell className="max-w-[300px] text-xs">{diffSummary(entry.beforeJson, entry.afterJson).map((d, i) => <div key={i} className="break-all font-mono text-[11px]">{d}</div>)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableSection>
        </div>
        <div className="grid content-start gap-4">
          <Section title="Gate events">
            <BookingTimeline items={events.map((e) => ({ at: fmtDateTimeSeconds(e.event.occurredAt), label: GATE_EVENT_LABEL[e.event.eventType] + (e.dock?.code ? `, ${e.dock.code}` : ""), detail: e.event.exceptionType ? `${EXCEPTION_LABEL[e.event.exceptionType]}. ${e.event.note ?? ""}` : e.event.note, by: e.recordedBy?.name, tone: e.event.eventType === "exception" ? "exception" : e.event.eventType === "gate_out" ? "done" : e.event.eventType === "yard_in" ? "waiting" : "progress" }))} emptyText="Truck has not arrived yet." />
          </Section>
        </div>
      </div>
    </>
  );
}

function fmtDateKey(d: Date) {
  return siteDateKey(d);
}
