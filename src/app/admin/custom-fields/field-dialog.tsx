"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/form";
import { EntityDialog } from "@/components/app/entity-dialog";
import { saveCustomFieldAction, type CustomFieldInput } from "@/lib/actions/admin";
import type { CustomField } from "@/lib/db/schema";

const ROLES = ["admin", "customer", "carrier", "security"] as const;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export function FieldDialog({ field }: { field?: CustomField }) {
  const [f, setF] = useState<CustomFieldInput>({ appliesTo: field?.appliesTo ?? "shipment", label: field?.label ?? "", fieldKey: field?.fieldKey ?? "", fieldType: field?.fieldType ?? "text", options: field?.optionsJson ?? [], required: field?.required ?? false, visibleToRoles: (field?.visibleToRoles as CustomFieldInput["visibleToRoles"]) ?? ["admin", "customer", "carrier", "security"], helpText: field?.helpText ?? "", sortOrder: field?.sortOrder ?? 0, active: field?.active ?? true });
  const [optionsText, setOptionsText] = useState((field?.optionsJson ?? []).join("\n"));
  return (
    <EntityDialog
      trigger={<Button size="sm" variant={field ? "outline" : "default"}>{field ? "Edit" : "Add field"}</Button>}
      title={field ? `Edit ${field.label}` : "Add a custom field"}
      description="The field appears on the matching form straight away and its values show on the booking detail and gate pass."
      onSubmit={() => saveCustomFieldAction(field?.id ?? null, { ...f, options: optionsText.split("\n").map((s) => s.trim()).filter(Boolean) })}
      wide
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Applies to" required>
          <Select value={f.appliesTo} onValueChange={(v) => setF({ ...f, appliesTo: v as CustomFieldInput["appliesTo"] })} disabled={!!field}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="shipment">Shipment form (customer)</SelectItem><SelectItem value="booking">Booking form (carrier)</SelectItem><SelectItem value="carrier">Carrier record</SelectItem><SelectItem value="customer">Customer record</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Type" required>
          <Select value={f.fieldType} onValueChange={(v) => setF({ ...f, fieldType: v as CustomFieldInput["fieldType"] })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="number">Number</SelectItem><SelectItem value="date">Date</SelectItem><SelectItem value="dropdown">Dropdown</SelectItem><SelectItem value="checkbox">Checkbox</SelectItem><SelectItem value="file">Document reference</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Label" htmlFor="cf-label" required><Input id="cf-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value, fieldKey: field ? f.fieldKey : slug(e.target.value) })} /></Field>
        <Field label="Field key" htmlFor="cf-key" required hint="Lowercase, used in exports"><Input id="cf-key" value={f.fieldKey} onChange={(e) => setF({ ...f, fieldKey: slug(e.target.value) })} className="font-mono" disabled={!!field} /></Field>
        {f.fieldType === "dropdown" && (
          <Field label="Options, one per line" htmlFor="cf-opts" required className="col-span-2"><Textarea id="cf-opts" rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} /></Field>
        )}
        <Field label="Help text" htmlFor="cf-help" className="col-span-2"><Input id="cf-help" value={f.helpText ?? ""} onChange={(e) => setF({ ...f, helpText: e.target.value })} /></Field>
        <Field label="Sort order" htmlFor="cf-sort"><Input id="cf-sort" type="number" value={f.sortOrder ?? 0} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></Field>
        <Field label="Visible to">
          <div className="flex flex-wrap gap-3 pt-1">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-sm capitalize">
                <Checkbox checked={f.visibleToRoles.includes(r)} onCheckedChange={(c) => setF({ ...f, visibleToRoles: c ? [...f.visibleToRoles, r] : f.visibleToRoles.filter((x) => x !== r) })} />
                {r}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap gap-5">
        <div className="flex items-center gap-2"><Switch id="cf-req" checked={f.required} onCheckedChange={(c) => setF({ ...f, required: c })} /><label htmlFor="cf-req" className="text-sm">Required</label></div>
        <div className="flex items-center gap-2"><Switch id="cf-active" checked={f.active} onCheckedChange={(c) => setF({ ...f, active: c })} /><label htmlFor="cf-active" className="text-sm">Active</label></div>
      </div>
    </EntityDialog>
  );
}
