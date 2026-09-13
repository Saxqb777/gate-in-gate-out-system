import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { getBookingRow, bookingEvents, bookingAudit, customFieldsFor, customValuesFor, rowHandlingMinutes } from "@/lib/queries/bookings";
import { PageHeader } from "@/components/app/page-header";
import { DescriptionList, Section } from "@/components/app/description-list";
import { BookingStatusBadge, DirectionBadge, PriorityBadge, TonePill } from "@/components/app/status-badge";
import { BookingTimeline } from "@/components/app/booking-timeline";
import { GatePass, qrDataUrl } from "@/components/app/gate-pass";
import { RescheduleAlert } from "@/components/app/reschedule-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CARRIER_CANCELLABLE, GATE_EVENT_LABEL, EXCEPTION_LABEL, BOOKING_STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime, fmtDateTimeSeconds, siteDateKey, addDaysKey } from "@/lib/time";
import { BookingForm } from "./booking-form";
import { PassActions } from "./pass-actions";

export const dynamic = "force-dynamic";

export default async function CarrierBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("carrier");
  const { id } = await params;
  const row = await getBookingRow(Number(id));
  if (!row || row.shipment.carrierOrgId !== user.organisationId) notFound();
  const cfg = await getConfig();
  const { booking: b, shipment: s, customer, dock, cargoType } = row;
  const shipmentValues = await customValuesFor("shipment", s.id);
  const handling = rowHandlingMinutes(row, cfg.defaultHandlingMinutes);
  const crumbs = [{ label: "Carrier", href: "/carrier" }, { label: "Bookings", href: "/carrier/bookings" }, { label: s.reference }];

  const shipmentItems = [
    { label: "Customer", value: customer.name },
    { label: "Direction", value: <DirectionBadge direction={s.direction} /> },
    { label: "Cargo", value: s.cargoDescription },
    { label: "Cargo type", value: cargoType?.name ?? "Not set" },
    { label: "Quantity", value: s.quantity != null ? `${s.quantity} ${s.uom ?? ""}` : null },
    { label: "Expected date", value: fmtDate(s.expectedDate) },
    { label: "Priority", value: <PriorityBadge priority={s.priority} /> },
    { label: "Handling time", value: `${handling} min` },
    { label: "BL number", value: s.blNumber, mono: true },
    { label: "Container", value: s.containerNumber, mono: true },
    { label: "Seal", value: s.sealNumber, mono: true },
    { label: "PO number", value: s.poNumber, mono: true },
    { label: "Invoice", value: s.invoiceNumber, mono: true },
    { label: "Notes", value: s.notes },
    ...shipmentValues.filter((v) => (v.field.visibleToRoles ?? []).includes("carrier")).map((v) => ({ label: v.field.label, value: v.field.fieldType === "checkbox" ? (v.value === "true" ? "Yes" : "No") : v.value })),
  ];

  if (b.status === "AWAITING_TRUCK_DETAILS") {
    const fields = await customFieldsFor("booking", "carrier");
    const today = siteDateKey();
    return (
      <>
        <PageHeader title={s.reference} description="Add truck and driver details, then pick a slot to receive the gate pass." crumbs={crumbs} />
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Section title="Shipment" description="Raised by the customer">
            <DescriptionList columns={1} items={shipmentItems.filter((i) => i.value)} />
          </Section>
          <BookingForm bookingId={b.id} truckTypes={cfg.truckTypes} customFields={fields.map((f) => ({ id: f.id, label: f.label, fieldKey: f.fieldKey, fieldType: f.fieldType, optionsJson: f.optionsJson, required: f.required, helpText: f.helpText }))} initialDate={s.expectedDate < today ? today : s.expectedDate} minDate={today} maxDate={addDaysKey(today, cfg.bookingHorizonDays)} handlingMinutes={handling} />
        </div>
      </>
    );
  }

  const [events, audit, bookingValues] = await Promise.all([bookingEvents(b.id), bookingAudit(b.id, s.id), customValuesFor("booking", b.id)]);
  const qr = b.gatePassNumber ? await qrDataUrl(b.qrToken) : null;
  const notices = b.rescheduledBySystem && !b.rescheduleAcknowledged ? [{ bookingId: b.id, reference: s.reference, title: "", body: `now ${dock?.code ?? ""} at ${fmtDateTime(b.slotStart)}${b.originalSlotStart ? `, was ${fmtDateTime(b.originalSlotStart)}` : ""}. ${b.rescheduleReason ?? ""}`, href: `/carrier/bookings/${b.id}`, notificationIds: [] }] : [];

  return (
    <>
      <PageHeader
        title={s.reference}
        description={BOOKING_STATUS_META[b.status].description}
        crumbs={crumbs}
        actions={b.gatePassNumber ? <PassActions bookingId={b.id} qrToken={b.qrToken} canCancel={CARRIER_CANCELLABLE.includes(b.status)} /> : undefined}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={b.status} />
        <DirectionBadge direction={s.direction} />
        {b.earlyArrivalPromoted && <TonePill tone="progress">Early arrival promoted</TonePill>}
        {b.rescheduledBySystem && <TonePill tone="waiting">Rescheduled by system</TonePill>}
      </div>
      <RescheduleAlert notices={notices} />
      {b.status === "PENDING_APPROVAL" && (
        <Alert className="mb-4 border-status-waiting/40 bg-status-waiting-bg text-status-waiting">
          <AlertTitle>Waiting for warehouse approval</AlertTitle>
          <AlertDescription className="text-status-waiting/90">The pass is not valid at the gate until an admin approves this booking.</AlertDescription>
        </Alert>
      )}
      {(b.status === "CANCELLED" || b.status === "REJECTED" || b.status === "NO_SHOW") && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{BOOKING_STATUS_META[b.status].label}</AlertTitle>
          <AlertDescription>{b.cancelReason ?? b.rejectionReason ?? "The pass is no longer valid."}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {qr ? (
            <GatePass row={row} qr={qr} cfg={cfg} customValues={bookingValues.filter((c) => c.value).map((c) => ({ label: c.field.label, value: c.field.fieldType === "checkbox" ? (c.value === "true" ? "Yes" : "No") : c.value ?? "" }))} />
          ) : (
            <Section title="Gate pass">
              <p className="text-sm text-muted-foreground">No gate pass has been issued for this booking.</p>
            </Section>
          )}
          <Section title="Shipment">
            <DescriptionList columns={3} items={shipmentItems.filter((i) => i.value)} />
          </Section>
        </div>
        <div className="grid content-start gap-4">
          <Section title="Gate events">
            <BookingTimeline items={events.map((e) => ({ at: fmtDateTimeSeconds(e.event.occurredAt), label: GATE_EVENT_LABEL[e.event.eventType] + (e.dock?.code ? `, ${e.dock.code}` : ""), detail: e.event.exceptionType ? `${EXCEPTION_LABEL[e.event.exceptionType]}. ${e.event.note ?? ""}` : e.event.note, by: e.recordedBy?.name, tone: e.event.eventType === "exception" ? "exception" : e.event.eventType === "gate_out" ? "done" : e.event.eventType === "yard_in" ? "waiting" : "progress" }))} />
          </Section>
          <Section title="History">
            <BookingTimeline items={audit.slice(0, 15).map((a) => ({ at: fmtDateTime(a.entry.occurredAt), label: a.entry.action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), detail: a.entry.reason, by: a.actor?.name ?? a.entry.actorLabel ?? "system", tone: "neutral" as const }))} />
          </Section>
        </div>
      </div>
    </>
  );
}
