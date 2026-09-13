"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export type FilterField =
  | {
      key: string;
      label: string;
      type: "select";
      options: FilterOption[];
      /** Label of the "no filter" option. Ignored when defaultValue is set. */
      allLabel?: string;
      /** Value shown when the param is absent. Picking it removes the param. */
      defaultValue?: string;
      className?: string;
    }
  | { key: string; label: string; type: "text"; placeholder?: string; className?: string }
  | { key: string; label: string; type: "date"; className?: string };

const ALL = "__all__";

/**
 * Filter row that keeps its state in the URL so the server page can read it.
 * Selects and dates push on change, text inputs push after a short pause or on Enter.
 * The page param is dropped on every change so paginated lists restart at page 1.
 */
export function ListFilters({ fields, className }: { fields: FilterField[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spString = sp.toString();
  const textKeys = fields
    .filter((f) => f.type === "text")
    .map((f) => f.key)
    .join(",");
  const [text, setText] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest params, mutated synchronously on push so quick successive changes accumulate.
  const paramsRef = useRef<URLSearchParams>(new URLSearchParams(spString));

  useEffect(() => {
    paramsRef.current = new URLSearchParams(spString);
    const next: Record<string, string> = {};
    for (const k of textKeys.split(",").filter(Boolean)) next[k] = paramsRef.current.get(k) ?? "";
    setText(next);
  }, [spString, textKeys]);

  function push(updates: Record<string, string | null | undefined>) {
    const params = paramsRef.current;
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onText(key: string, value: string) {
    setText((t) => ({ ...t, [key]: value }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ [key]: value.trim() }), 450);
  }

  const activeCount = fields.filter((f) => sp.get(f.key)).length;

  return (
    <div className={cn("mb-3 flex flex-wrap items-end gap-2", className)}>
      {fields.map((f) => {
        const id = `filter-${f.key}`;
        return (
          <div key={f.key} className="grid gap-1">
            <Label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
              {f.label}
            </Label>
            {f.type === "select" ? (
              <Select value={sp.get(f.key) ?? f.defaultValue ?? ALL} onValueChange={(v) => push({ [f.key]: v === ALL || v === f.defaultValue ? null : v })}>
                <SelectTrigger id={id} size="sm" className={cn("w-40 bg-card", f.className)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.defaultValue == null && <SelectItem value={ALL}>{f.allLabel ?? "All"}</SelectItem>}
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.type === "date" ? (
              <Input id={id} type="date" value={sp.get(f.key) ?? ""} onChange={(e) => push({ [f.key]: e.target.value })} className={cn("h-7 w-40 bg-card text-xs", f.className)} />
            ) : (
              <Input
                id={id}
                value={text[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => onText(f.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (timer.current) clearTimeout(timer.current);
                    push({ [f.key]: (text[f.key] ?? "").trim() });
                  }
                }}
                className={cn("h-7 w-52 bg-card text-xs", f.className)}
              />
            )}
          </div>
        );
      })}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => push(Object.fromEntries(fields.map((f) => [f.key, null])))}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
