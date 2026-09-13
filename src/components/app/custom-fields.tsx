"use client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./form";

export type CustomFieldDef = {
  id: number;
  label: string;
  fieldKey: string;
  fieldType: "text" | "number" | "date" | "dropdown" | "checkbox" | "file";
  optionsJson: string[] | null;
  required: boolean;
  helpText: string | null;
};

/** Renders admin defined custom fields inside any form. Values are keyed by field id. */
export function CustomFieldsInputs({ fields, values, onChange }: { fields: CustomFieldDef[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  if (!fields.length) return null;
  const set = (id: number, v: string) => onChange({ ...values, [String(id)]: v });
  return (
    <>
      {fields.map((f) => {
        const v = values[String(f.id)] ?? "";
        const id = `cf-${f.id}`;
        if (f.fieldType === "checkbox") {
          return (
            <div key={f.id} className="flex items-center gap-2 pt-5">
              <Checkbox id={id} checked={v === "true"} onCheckedChange={(c) => set(f.id, c ? "true" : "false")} />
              <label htmlFor={id} className="text-sm">
                {f.label}
              </label>
            </div>
          );
        }
        if (f.fieldType === "dropdown") {
          return (
            <Field key={f.id} label={f.label} required={f.required} hint={f.helpText ?? undefined}>
              <Select value={v} onValueChange={(val) => set(f.id, val)}>
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {(f.optionsJson ?? []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          );
        }
        if (f.fieldType === "file") {
          return (
            <Field key={f.id} label={f.label} required={f.required} hint={f.helpText ?? "Enter a document reference or link"}>
              <Input id={id} value={v} onChange={(e) => set(f.id, e.target.value)} placeholder="Document reference" />
            </Field>
          );
        }
        return (
          <Field key={f.id} label={f.label} required={f.required} hint={f.helpText ?? undefined}>
            <Input id={id} type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"} value={v} onChange={(e) => set(f.id, e.target.value)} />
          </Field>
        );
      })}
    </>
  );
}

export function validateCustomFields(fields: CustomFieldDef[], values: Record<string, string>): string | null {
  for (const f of fields) {
    if (f.required && f.fieldType !== "checkbox" && !(values[String(f.id)] ?? "").trim()) return `${f.label} is required.`;
  }
  return null;
}
