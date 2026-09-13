"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormError, FormSection } from "@/components/app/form";
import { CustomFieldsInputs, validateCustomFields, type CustomFieldDef } from "@/components/app/custom-fields";
import { createShipmentAction, updateShipmentAction, type ShipmentInput } from "@/lib/actions/shipments";
import { cn } from "@/lib/utils";

export type ShipmentFormProps = {
  mode: "create" | "edit";
  shipmentId?: number;
  today: string;
  cargoTypes: { id: number; name: string; handlingMinutes: number }[];
  carriers: { id: number; name: string }[];
  customers?: { id: number; name: string }[];
  uomOptions: string[];
  customFields: CustomFieldDef[];
  initial?: Partial<ShipmentInput> & { customValues?: Record<string, string> };
  redirectBase: string;
  onDone?: () => void;
};

const NONE = "__none__";

export function ShipmentForm(p: ShipmentFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const i = p.initial ?? {};
  const [f, setF] = useState({
    direction: (i.direction ?? "inbound") as "inbound" | "outbound",
    expectedDate: i.expectedDate ?? p.today,
    priority: (i.priority ?? "normal") as "low" | "normal" | "high" | "urgent",
    cargoTypeId: i.cargoTypeId ? String(i.cargoTypeId) : "",
    cargoDescription: i.cargoDescription ?? "",
    quantity: i.quantity != null ? String(i.quantity) : "",
    uom: i.uom ?? "",
    handlingMinutes: i.handlingMinutes ? String(i.handlingMinutes) : "",
    blNumber: i.blNumber ?? "",
    containerNumber: i.containerNumber ?? "",
    sealNumber: i.sealNumber ?? "",
    poNumber: i.poNumber ?? "",
    invoiceNumber: i.invoiceNumber ?? "",
    carrierOrgId: i.carrierOrgId ? String(i.carrierOrgId) : "",
    customerOrgId: i.customerOrgId ? String(i.customerOrgId) : "",
    notes: i.notes ?? "",
  });
  const [custom, setCustom] = useState<Record<string, string>>(i.customValues ?? {});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const inbound = f.direction === "inbound";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ne: Record<string, string> = {};
    if (f.cargoDescription.trim().length < 3) ne.cargoDescription = "Describe the cargo.";
    if (!f.expectedDate) ne.expectedDate = "Pick a date.";
    if (p.customers && !f.customerOrgId) ne.customerOrgId = "Choose the customer.";
    setErrs(ne);
    if (Object.keys(ne).length) return setError("Please complete the highlighted fields.");
    const cfErr = validateCustomFields(p.customFields, custom);
    if (cfErr) return setError(cfErr);
    const input: ShipmentInput = {
      direction: f.direction,
      expectedDate: f.expectedDate,
      priority: f.priority,
      cargoTypeId: f.cargoTypeId ? Number(f.cargoTypeId) : null,
      cargoDescription: f.cargoDescription.trim(),
      quantity: f.quantity ? Number(f.quantity) : null,
      uom: f.uom || null,
      handlingMinutes: f.handlingMinutes ? Number(f.handlingMinutes) : null,
      blNumber: f.blNumber || null,
      containerNumber: f.containerNumber || null,
      sealNumber: f.sealNumber || null,
      poNumber: f.poNumber || null,
      invoiceNumber: f.invoiceNumber || null,
      carrierOrgId: f.carrierOrgId ? Number(f.carrierOrgId) : null,
      customerOrgId: f.customerOrgId ? Number(f.customerOrgId) : undefined,
      notes: f.notes || null,
      customValues: custom,
    };
    start(async () => {
      if (p.mode === "create") {
        const res = await createShipmentAction(input);
        if (!res.ok) return setError(res.error);
        toast.success(res.message ?? "Shipment raised.");
        router.push(`${p.redirectBase}/${res.data!.shipmentId}`);
      } else {
        const res = await updateShipmentAction(p.shipmentId!, input);
        if (!res.ok) return setError(res.error);
        toast.success(res.message ?? "Saved.");
        router.refresh();
        p.onDone?.();
      }
    });
  }

  return (
    <form onSubmit={submit} className={cn("grid gap-5", p.mode === "create" && "rounded-md border bg-card p-4")}>
      <FormSection title="Shipment">
        {p.customers && (
          <Field label="Customer" required error={errs.customerOrgId}>
            <Select value={f.customerOrgId} onValueChange={(v) => setF({ ...f, customerOrgId: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{p.customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Direction" required>
          <div className="grid grid-cols-2 rounded-md border bg-muted p-0.5">
            {(["inbound", "outbound"] as const).map((d) => (
              <button key={d} type="button" disabled={p.mode === "edit"} onClick={() => setF({ ...f, direction: d })} className={cn("rounded-[5px] px-2 py-1 text-sm", f.direction === d ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
                {d === "inbound" ? "Inbound" : "Outbound"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Expected date" htmlFor="expectedDate" required error={errs.expectedDate}>
          <Input id="expectedDate" type="date" min={p.today} value={f.expectedDate} onChange={set("expectedDate")} />
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as typeof f.priority })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cargo type" hint="Sets the dock time reserved for the truck">
          <Select value={f.cargoTypeId} onValueChange={(v) => setF({ ...f, cargoTypeId: v === NONE ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not specified</SelectItem>
              {p.cargoTypes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.handlingMinutes} min)</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cargo description" htmlFor="cargoDescription" required error={errs.cargoDescription} className="sm:col-span-2">
          <Input id="cargoDescription" value={f.cargoDescription} onChange={set("cargoDescription")} placeholder="For example: Khalas dates, field bins" />
        </Field>
        <Field label="Quantity" htmlFor="quantity">
          <Input id="quantity" type="number" min={0} value={f.quantity} onChange={set("quantity")} />
        </Field>
        <Field label="Unit">
          <Select value={f.uom} onValueChange={(v) => setF({ ...f, uom: v === NONE ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not specified</SelectItem>
              {p.uomOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Handling time override (min)" htmlFor="handlingMinutes" hint="Leave empty to use the cargo type default">
          <Input id="handlingMinutes" type="number" min={5} max={600} value={f.handlingMinutes} onChange={set("handlingMinutes")} />
        </Field>
      </FormSection>
      <FormSection title="References" description={inbound ? "Documents the truck brings with it." : "Documents that travel with the load."}>
        {(inbound || showAll) && <Field label="BL number" htmlFor="blNumber"><Input id="blNumber" value={f.blNumber} onChange={set("blNumber")} className="font-mono" /></Field>}
        {(inbound || showAll) && <Field label="PO number" htmlFor="poNumber"><Input id="poNumber" value={f.poNumber} onChange={set("poNumber")} className="font-mono" /></Field>}
        {(!inbound || showAll) && <Field label="Invoice number" htmlFor="invoiceNumber"><Input id="invoiceNumber" value={f.invoiceNumber} onChange={set("invoiceNumber")} className="font-mono" /></Field>}
        <Field label="Container number" htmlFor="containerNumber"><Input id="containerNumber" value={f.containerNumber} onChange={set("containerNumber")} className="font-mono uppercase" /></Field>
        <Field label="Seal number" htmlFor="sealNumber"><Input id="sealNumber" value={f.sealNumber} onChange={set("sealNumber")} className="font-mono" /></Field>
        <div className="flex items-end">
          <button type="button" className="text-xs text-primary-deep hover:underline" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer references" : "Show all references"}
          </button>
        </div>
      </FormSection>
      {p.mode === "create" && (
        <FormSection title="Carrier" description="The carrier receives a booking link to add truck details and pick a slot. You can also assign later.">
          <Field label="Carrier" className="sm:col-span-2">
            <Select value={f.carrierOrgId} onValueChange={(v) => setF({ ...f, carrierOrgId: v === NONE ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Assign later</SelectItem>
                {p.carriers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </FormSection>
      )}
      {p.customFields.length > 0 && (
        <FormSection title="Additional details" description="Requested by the warehouse.">
          <CustomFieldsInputs fields={p.customFields} values={custom} onChange={setCustom} />
        </FormSection>
      )}
      <Field label="Notes for the warehouse" htmlFor="notes">
        <Textarea id="notes" rows={3} value={f.notes} onChange={set("notes")} placeholder="Anything the dock team or security should know" />
      </Field>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving..." : p.mode === "create" ? "Raise shipment request" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
