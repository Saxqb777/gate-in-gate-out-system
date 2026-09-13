"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/app/form";
import { useAction } from "@/components/app/use-action";
import { saveConfigAction } from "@/lib/actions/admin";
import type { ConfigDef } from "@/lib/config";

export function ConfigGroupForm({ defs, values, warning }: { defs: ConfigDef[]; values: Record<string, string>; warning?: string }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(defs.map((d) => [d.key, values[d.key] ?? d.default])));
  const { run, pending, error } = useAction();
  const dirty = defs.some((d) => (values[d.key] ?? d.default) !== v[d.key]);
  const set = (k: string, val: string) => setV({ ...v, [k]: val });
  return (
    <div className="grid gap-4">
      {warning && <div className="rounded border border-status-waiting/40 bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting">{warning}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {defs.map((d) => (
          <div key={d.key} className="grid gap-1">
            <label htmlFor={`cfg-${d.key}`} className="text-xs font-medium">{d.label}</label>
            {d.type === "boolean" ? (
              <div className="flex items-center gap-2 pt-1"><Switch id={`cfg-${d.key}`} checked={v[d.key] === "true"} onCheckedChange={(c) => set(d.key, c ? "true" : "false")} /><span className="text-sm">{v[d.key] === "true" ? "On" : "Off"}</span></div>
            ) : d.type === "select" ? (
              <Select value={v[d.key]} onValueChange={(val) => set(d.key, val)}>
                <SelectTrigger id={`cfg-${d.key}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(d.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : d.type === "text" ? (
              <Textarea id={`cfg-${d.key}`} rows={4} value={v[d.key]} onChange={(e) => set(d.key, e.target.value)} />
            ) : (
              <Input id={`cfg-${d.key}`} type={d.type === "number" ? "number" : d.type === "time" ? "time" : "text"} value={v[d.key]} onChange={(e) => set(d.key, e.target.value)} className={d.type === "json" ? "font-mono" : undefined} />
            )}
            <p className="text-[11px] text-muted-foreground">{d.description}{d.type === "json" ? " Stored as JSON." : ""}</p>
          </div>
        ))}
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button disabled={!dirty || pending} onClick={() => run(() => saveConfigAction(v))}>{pending ? "Saving..." : "Save changes"}</Button>
      </div>
    </div>
  );
}
