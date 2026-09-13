"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/app/form";
import { EntityDialog } from "@/components/app/entity-dialog";
import { saveCargoTypeAction, type CargoTypeInput } from "@/lib/actions/admin";
import type { CargoType } from "@/lib/db/schema";

export function CargoTypeDialog({ item }: { item?: CargoType }) {
  const [f, setF] = useState<CargoTypeInput>({ code: item?.code ?? "", name: item?.name ?? "", handlingMinutes: item?.handlingMinutes ?? 60, active: item?.active ?? true, sortOrder: item?.sortOrder ?? 0 });
  return (
    <EntityDialog trigger={<Button size="sm" variant={item ? "outline" : "default"}>{item ? "Edit" : "Add cargo type"}</Button>} title={item ? `Edit ${item.name}` : "Add a cargo type"} description="Handling minutes decide how much dock time a booking of this type reserves." onSubmit={() => saveCargoTypeAction(item?.id ?? null, f)}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" htmlFor="ct-code" required hint="Capitals, numbers, underscores"><Input id="ct-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono" /></Field>
        <Field label="Name" htmlFor="ct-name" required><Input id="ct-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Handling minutes" htmlFor="ct-min" required><Input id="ct-min" type="number" min={5} max={600} value={f.handlingMinutes} onChange={(e) => setF({ ...f, handlingMinutes: Number(e.target.value) })} /></Field>
        <Field label="Sort order" htmlFor="ct-sort"><Input id="ct-sort" type="number" value={f.sortOrder ?? 0} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></Field>
      </div>
      <div className="flex items-center gap-2"><Switch id="ct-active" checked={f.active} onCheckedChange={(c) => setF({ ...f, active: c })} /><label htmlFor="ct-active" className="text-sm">Active (offered on the shipment form)</label></div>
    </EntityDialog>
  );
}
