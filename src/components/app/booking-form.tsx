"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormError, FormSection } from "@/components/app/form";
import { CustomFieldsInputs, validateCustomFields, type CustomFieldDef } from "@/components/app/custom-fields";
import { SlotPicker, type PickedSlot } from "@/components/app/slot-picker";
import { submitBookingAction } from "@/lib/actions/bookings";
import { fmtDate } from "@/lib/time";

export function BookingForm({ bookingId, truckTypes, customFields, initialDate, minDate, maxDate, handlingMinutes }: { bookingId: number; truckTypes: string[]; customFields: CustomFieldDef[]; initialDate: string; minDate: string; maxDate: string; handlingMinutes: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pickerKey, setPickerKey] = useState(0);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [f, setF] = useState({ truckPlate: "", trailerPlate: "", truckType: "", capacity: "", driverName: "", driverMobile: "", driverIdNumber: "" });
  const [custom, setCustom] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (f.truckPlate.trim().length < 3) errs.truckPlate = "Enter the truck plate.";
    if (!f.truckType) errs.truckType = "Choose the truck type.";
    if (f.driverName.trim().length < 2) errs.driverName = "Enter the driver name.";
    if (f.driverMobile.trim().length < 7) errs.driverMobile = "Enter the driver mobile number.";
    if (f.driverIdNumber.trim().length < 5) errs.driverIdNumber = "Enter the Emirates ID or licence number.";
    setFieldErrors(errs);
    const cfErr = validateCustomFields(customFields, custom);
    if (cfErr) return setError(cfErr);
    if (Object.keys(errs).length) return setError("Please complete the highlighted fields.");
    if (!slot) return setError("Pick a slot in the grid below.");
    start(async () => {
      const res = await submitBookingAction(bookingId, { ...f, slotId: slot.slotId, customValues: custom });
      if (!res.ok) {
        setError(res.error);
        if (/taken a moment ago|maximum|no longer/i.test(res.error)) {
          setSlot(null);
          setPickerKey((k) => k + 1);
        }
        return;
      }
      toast.success(res.message ?? "Booked.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-md border bg-card p-4">
      <FormSection title="Truck" description="As shown on the vehicle. Security checks these at the gate.">
        <Field label="Truck plate" htmlFor="truckPlate" required error={fieldErrors.truckPlate}>
          <Input id="truckPlate" value={f.truckPlate} onChange={set("truckPlate")} placeholder="AD 12345" className="font-mono uppercase" />
        </Field>
        <Field label="Trailer plate" htmlFor="trailerPlate">
          <Input id="trailerPlate" value={f.trailerPlate} onChange={set("trailerPlate")} className="font-mono uppercase" />
        </Field>
        <Field label="Truck type" required error={fieldErrors.truckType}>
          <Select value={f.truckType} onValueChange={(v) => setF({ ...f, truckType: v })}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              {truckTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Capacity" htmlFor="capacity" hint="For example 24 pallets or 1 x TEU">
          <Input id="capacity" value={f.capacity} onChange={set("capacity")} />
        </Field>
      </FormSection>
      <FormSection title="Driver">
        <Field label="Driver name" htmlFor="driverName" required error={fieldErrors.driverName}>
          <Input id="driverName" value={f.driverName} onChange={set("driverName")} />
        </Field>
        <Field label="Driver mobile" htmlFor="driverMobile" required error={fieldErrors.driverMobile}>
          <Input id="driverMobile" value={f.driverMobile} onChange={set("driverMobile")} placeholder="+971 50 000 0000" inputMode="tel" />
        </Field>
        <Field label="Emirates ID or licence number" htmlFor="driverIdNumber" required error={fieldErrors.driverIdNumber}>
          <Input id="driverIdNumber" value={f.driverIdNumber} onChange={set("driverIdNumber")} placeholder="784-1990-1234567-1" className="font-mono" />
        </Field>
      </FormSection>
      {customFields.length > 0 && (
        <FormSection title="Additional details" description="Requested by the warehouse.">
          <CustomFieldsInputs fields={customFields} values={custom} onChange={setCustom} />
        </FormSection>
      )}
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">Pick a slot</h3>
          <p className="text-xs text-muted-foreground">Only docks that handle this direction are shown. Each booking reserves {handlingMinutes} minutes of dock time.</p>
        </div>
        <SlotPicker key={pickerKey} bookingId={bookingId} initialDate={initialDate} minDate={minDate} maxDate={maxDate} value={slot} onChange={setSlot} />
        <div className="text-sm">
          {slot ? (
            <span>
              Selected: <span className="font-medium">{slot.dockCode}</span>, {fmtDate(slot.date)}, {slot.startTime} to {slot.endTime}
            </span>
          ) : (
            <span className="text-muted-foreground">No slot selected.</span>
          )}
        </div>
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Booking..." : "Confirm booking"}
        </Button>
      </div>
    </form>
  );
}
