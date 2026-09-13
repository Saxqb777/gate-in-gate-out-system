"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/form";
import { EntityDialog } from "@/components/app/entity-dialog";
import { saveDockAction, type DockInput } from "@/lib/actions/admin";

export function DockDialog({ dock }: { dock?: { id: number; code: string; name: string; type: "inbound" | "outbound" | "both"; status: "active" | "maintenance" | "blocked"; notes: string | null; sortOrder: number } }) {
  const [f, setF] = useState<DockInput>({ code: dock?.code ?? "", name: dock?.name ?? "", type: dock?.type ?? "inbound", status: dock?.status ?? "active", notes: dock?.notes ?? "", sortOrder: dock?.sortOrder ?? 0 });
  return (
    <EntityDialog trigger={<Button size="sm" variant={dock ? "outline" : "default"}>{dock ? "Edit" : "Add dock"}</Button>} title={dock ? `Edit ${dock.code}` : "Add a dock"} description="Taking a dock out of service removes its open future slots. Existing bookings on it must be moved from the bookings list." onSubmit={() => saveDockAction(dock?.id ?? null, f)}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" htmlFor="dock-code" required><Input id="dock-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="DOCK-09" className="font-mono uppercase" /></Field>
        <Field label="Name" htmlFor="dock-name" required><Input id="dock-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Type" required>
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as DockInput["type"] })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="inbound">Inbound</SelectItem><SelectItem value="outbound">Outbound</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Status" required>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as DockInput["status"] })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Sort order" htmlFor="dock-sort"><Input id="dock-sort" type="number" value={f.sortOrder ?? 0} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Notes" htmlFor="dock-notes"><Textarea id="dock-notes" rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </EntityDialog>
  );
}
