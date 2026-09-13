"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/form";
import { EntityDialog } from "@/components/app/entity-dialog";
import { saveOrganisationAction, type OrgInput } from "@/lib/actions/admin";
import type { Organisation } from "@/lib/db/schema";

export function OrgDialog({ org }: { org?: Organisation }) {
  const [f, setF] = useState<OrgInput>({ name: org?.name ?? "", code: org?.code ?? "", type: org?.type ?? "carrier", contactName: org?.contactName ?? "", contactEmail: org?.contactEmail ?? "", contactPhone: org?.contactPhone ?? "", address: org?.address ?? "", tradeLicence: org?.tradeLicence ?? "", active: org?.active ?? true });
  const set = (k: keyof OrgInput) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <EntityDialog trigger={<Button size="sm" variant={org ? "outline" : "default"}>{org ? "Edit" : "Add organisation"}</Button>} title={org ? `Edit ${org.name}` : "Add an organisation"} description="Customers raise shipments, carriers book trucks, internal is Agthia staff." onSubmit={() => saveOrganisationAction(org?.id ?? null, f)} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="org-name" required><Input id="org-name" value={f.name} onChange={set("name")} /></Field>
        <Field label="Code" htmlFor="org-code" required hint="Short unique code"><Input id="org-code" value={f.code} onChange={set("code")} className="font-mono uppercase" /></Field>
        <Field label="Type" required>
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as OrgInput["type"] })} disabled={!!org}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="carrier">Carrier</SelectItem><SelectItem value="internal">Internal</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Trade licence" htmlFor="org-lic"><Input id="org-lic" value={f.tradeLicence ?? ""} onChange={set("tradeLicence")} /></Field>
        <Field label="Contact name" htmlFor="org-cn"><Input id="org-cn" value={f.contactName ?? ""} onChange={set("contactName")} /></Field>
        <Field label="Contact email" htmlFor="org-ce"><Input id="org-ce" type="email" value={f.contactEmail ?? ""} onChange={set("contactEmail")} /></Field>
        <Field label="Contact phone" htmlFor="org-cp"><Input id="org-cp" value={f.contactPhone ?? ""} onChange={set("contactPhone")} /></Field>
        <Field label="Address" htmlFor="org-ad"><Input id="org-ad" value={f.address ?? ""} onChange={set("address")} /></Field>
      </div>
      <div className="flex items-center gap-2"><Switch id="org-active" checked={f.active} onCheckedChange={(c) => setF({ ...f, active: c })} /><label htmlFor="org-active" className="text-sm">Active</label></div>
    </EntityDialog>
  );
}
