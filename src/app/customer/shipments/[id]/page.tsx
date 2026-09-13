import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { getBookingRowByShipment, bookingEvents, bookingAudit, customValuesFor, customFieldsFor, allCargoTypes, allOrganisations } from "@/lib/queries/bookings";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Section } from "@/components/app/description-list";
import { BookingStatusBadge, DirectionBadge, PriorityBadge, TonePill } from "@/components/app/status-badge";
import { BookingTimeline } from "@/components/app/booking-timeline";
import { StatusStepper } from "@/components/app/status-stepper";
import { RescheduleAlert } from "@/components/app/reschedule-alert";
import { GATE_EVENT_LABEL, EXCEPTION_LABEL, BOOKING_STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime, fmtDateTimeSeconds, fmtTime, siteDateKey } from "@/lib/time";
import { ShipmentActions } from "./shipment-actions";

export const dynamic = "force-dynamic";

export default async function CustomerShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("customer");
  const { id } = await params;
  const row = await getBookingRowByShipment(Number(id));
  if (!row || row.shipment.customerOrgId !== user.organisationId) notFound();
  const { booking: b, shipment: s, carrier, dock, cargoType } = row;
  const [cfg, events, audit, values, fields, cargoTypes, carriers] = await Promise.all([getConfig(), bookingEvents(b.id), bookingAudit(b.id, s.id), customValuesFor("shipment", s.id), customFieldsFor("shipment", "customer"), allCargoTypes(), allOrganisations("carrier")]);
  const status = b.status;
  const canAssign = ["DRAFT", "AWAITING_TRUCK_DETAILS"].includes(status);
  const canEdit = ["DRAFT", "AWAITING_TRUCK_DETAILS", "PENDING_APPROVAL"].includes(status);
  const canCancel = ["DRAFT", "AWAITING_TRUCK_DETAILS", "PENDING_APPROVAL", "BOOKED"].includes(status);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const bookingLink = s.carrierOrgId ? `${base}/book/${b.bookingLinkToken}` : null;
  const notices = b.rescheduledBySystem && !b.rescheduleAcknowledged ? [{ bookingId: b.id, reference: s.reference, title: "", body: `now ${dock?.code ?? ""} at ${fmtDateTime(b.slotStart)}${b.originalSlotStart ? `, was ${fmtDateTime(b.originalSlotStart)}` : ""}. ${b.rescheduleReason ?? ""}`, href: `/customer/shipments/${s.id}`, notificationIds: [] }] : [];
  const customItems = values.map((v) => ({ label: v.field.label, value: v.field.fieldType === "checkbox" ? (v.value === "true" ? "Yes" : "No") : v.value }));
  const customValues: Record<string, string> = {};
  for (const v of values) customValues[String(v.field.id)] = v.value ?? "";

  return (
    <>
      <PageHeader
        title={s.reference}
        description={BOOKING_STATUS_META[status].description}
        crumbs={[{ label: "Customer", href: "/customer" }, { label: "Shipments", href: "/customer/shipments" }, { label: s.reference }]}
        actions={
          <ShipmentActions
            shipmentId={s.id}
            canAssign={canAssign}
            canEdit={canEdit}
            canCancel={canCancel}
            carriers={carriers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
            currentCarrierId={s.carrierOrgId}
            bookingLink={bookingLink}
            editProps={{
              today: siteDateKey(),
              cargoTypes: cargoTypes.map((c) => ({ id: c.id, name: c.name, handlingMinutes: c.handlingMinutes })),
              carriers: [],
              uomOptions: cfg.uomOptions,
              customFields: fields.map((f) => ({ id: f.id, label: f.label, fieldKey: f.fieldKey, fieldType: f.fieldType, optionsJson: f.optionsJson, required: f.required, helpText: f.helpText })),
              initial: { direction: s.direction, expectedDate: s.expectedDate, priority: s.priority, cargoTypeId: s.cargoTypeId, cargoDescription: s.cargoDescription, quantity: s.quantity, uom: s.uom, handlingMinutes: s.handlingMinutes, blNumber: s.blNumber, containerNumber: s.containerNumber, sealNumber: s.sealNumber, poNumber: s.poNumber, invoiceNumber: s.invoiceNumber, notes: s.notes, customValues },
            }}
          />
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={status} />
        <DirectionBadge direction={s.direction} />
        <PriorityBadge priority={s.priority} />
        {b.earlyArrivalPromoted && <TonePill tone="progress">Early arrival promoted</TonePill>}
        {b.rescheduledBySystem && <TonePill tone="waiting">Rescheduled by system</TonePill>}
      </div>
      <RescheduleAlert notices={notices} />
      <div className="mb-4">
        <StatusStepper status={status} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4">
          <Section title="Shipment">
            <DescriptionList
              columns={3}
              items={[
                { label: "Cargo", value: s.cargoDescription },
                { label: "Cargo type", value: cargoType?.name ?? null },
                { label: "Quantity", value: s.quantity != null ? `${s.quantity} ${s.uom ?? ""}` : null },
                { label: "Expected date", value: fmtDate(s.expectedDate) },
                { label: "Handling time", value: s.handlingMinutes ? `${s.handlingMinutes} min (override)` : cargoType ? `${cargoType.handlingMinutes} min` : `${cfg.defaultHandlingMinutes} min` },
                { label: "Raised on", value: fmtDateTime(s.createdAt) },
                { label: "BL number", value: s.blNumber, mono: true },
                { label: "Container", value: s.containerNumber, mono: true },
                { label: "Seal", value: s.sealNumber, mono: true },
                { label: "PO number", value: s.poNumber, mono: true },
                { label: "Invoice", value: s.invoiceNumber, mono: true },
                { label: "Notes", value: s.notes },
                ...customItems,
              ]}
            />
          </Section>
          <Section title="Booking" description={carrier ? `Carrier: ${carrier.name}` : "No carrier assigned yet"}>
            {b.truckPlate ? (
              <DescriptionList
                columns={3}
                items={[
                  { label: "Carrier", value: carrier?.name },
                  { label: "Dock", value: dock ? `${dock.code}, ${dock.name}` : "Assigned on arrival" },
                  { label: "Slot", value: b.slotStart ? `${fmtDate(b.originalSlotStart ?? b.slotStart)}, ${fmtTime(b.originalSlotStart ?? b.slotStart)}` : null },
                  { label: "Gate pass", value: b.gatePassNumber, mono: true },
                  { label: "Truck plate", value: b.truckPlate, mono: true },
                  { label: "Trailer", value: b.trailerPlate, mono: true },
                  { label: "Driver", value: b.driverName },
                  { label: "Driver mobile", value: b.driverMobile, mono: true },
                  { label: "Truck type", value: `${b.truckType ?? ""}${b.capacity ? `, ${b.capacity}` : ""}` },
                  { label: "Arrived", value: b.arrivedAt ? fmtDateTime(b.arrivedAt) : null },
                  { label: "At dock", value: b.dockInAt ? fmtDateTime(b.dockInAt) : null },
                  { label: "Gated out", value: b.gateOutAt ? fmtDateTime(b.gateOutAt) : null },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{carrier ? "Carrier has not added truck details yet." : "Assign a carrier to start the booking."}</p>
            )}
            {bookingLink && (
              <div className="mt-4 rounded border bg-muted/50 px-3 py-2 text-xs">
                <div className="font-medium">Booking link for the carrier</div>
                <div className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{bookingLink}</div>
              </div>
            )}
          </Section>
        </div>
        <div className="grid content-start gap-4">
          <Section title="Gate events">
            <BookingTimeline items={events.map((e) => ({ at: fmtDateTimeSeconds(e.event.occurredAt), label: GATE_EVENT_LABEL[e.event.eventType] + (e.dock?.code ? `, ${e.dock.code}` : ""), detail: e.event.exceptionType ? `${EXCEPTION_LABEL[e.event.exceptionType]}. ${e.event.note ?? ""}` : e.event.note, by: e.recordedBy?.name, tone: e.event.eventType === "exception" ? "exception" : e.event.eventType === "gate_out" ? "done" : e.event.eventType === "yard_in" ? "waiting" : "progress" }))} emptyText="Truck has not arrived yet." />
          </Section>
          <Section title="History">
            <BookingTimeline items={audit.slice(0, 20).map((a) => ({ at: fmtDateTime(a.entry.occurredAt), label: a.entry.action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), detail: a.entry.reason, by: a.actor?.name ?? a.entry.actorLabel ?? "system", tone: "neutral" as const }))} />
          </Section>
        </div>
      </div>
    </>
  );
}
