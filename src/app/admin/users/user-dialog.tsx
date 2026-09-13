"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/app/form";
import { EntityDialog } from "@/components/app/entity-dialog";
import { saveUserAction, type UserInput } from "@/lib/actions/admin";

export type OrgOption = { id: number; name: string; type: "customer" | "carrier" | "internal" };

export function UserDialog({ user, orgs }: { user?: { id: number; name: string; email: string; role: UserInput["role"]; organisationId: number; title: string | null; active: boolean; warehouseOpsView: boolean }; orgs: OrgOption[] }) {
  const [f, setF] = useState<UserInput>({ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "carrier", organisationId: user?.organisationId ?? 0, title: user?.title ?? "", password: "", active: user?.active ?? true, warehouseOpsView: user?.warehouseOpsView ?? false });
  const wantedType = f.role === "admin" || f.role === "security" ? "internal" : f.role;
  const orgOptions = orgs.filter((o) => o.type === wantedType);
  return (
    <EntityDialog trigger={<Button size="sm" variant={user ? "outline" : "default"}>{user ? "Edit" : "Add user"}</Button>} title={user ? `Edit ${user.name}` : "Add a user"} onSubmit={() => (f.organisationId ? saveUserAction(user?.id ?? null, f) : "Choose an organisation.")} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="u-name" required><Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="u-email" required><Input id="u-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role" required>
          <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as UserInput["role"], organisationId: 0 })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="security">Security</SelectItem><SelectItem value="carrier">Carrier</SelectItem><SelectItem value="customer">Customer</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Organisation" required hint={`${wantedType} organisations only`}>
          <Select value={f.organisationId ? String(f.organisationId) : ""} onValueChange={(v) => setF({ ...f, organisationId: Number(v) })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{orgOptions.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Job title" htmlFor="u-title"><Input id="u-title" value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={user ? "New password (leave empty to keep)" : "Password"} htmlFor="u-pw" required={!user}><Input id="u-pw" type="password" value={f.password ?? ""} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
      </div>
      <div className="flex flex-wrap gap-5">
        <div className="flex items-center gap-2"><Switch id="u-active" checked={f.active} onCheckedChange={(c) => setF({ ...f, active: c })} /><label htmlFor="u-active" className="text-sm">Active</label></div>
        {f.role === "admin" && <div className="flex items-center gap-2"><Switch id="u-ops" checked={f.warehouseOpsView} onCheckedChange={(c) => setF({ ...f, warehouseOpsView: c })} /><label htmlFor="u-ops" className="text-sm">Warehouse operations view (lands on the dock board)</label></div>}
      </div>
    </EntityDialog>
  );
}
