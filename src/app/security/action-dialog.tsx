"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/app/form";
import { EXCEPTION_LABEL } from "@/lib/status";
import type { ExceptionType } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/auth/guard";

export type ActionDialogConfig = {
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  noteRequired: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
  /** Show the exception type select (flag exception). */
  withExceptionType?: boolean;
  run: (input: { note: string; exceptionType: ExceptionType }) => Promise<ActionResult<unknown>>;
};

const EXCEPTION_TYPES = Object.keys(EXCEPTION_LABEL) as ExceptionType[];

/**
 * Gate house dialog: captures a note (and optionally an exception type), runs the action,
 * shows the error inline on failure and closes on success. Big controls for touch.
 */
export function ActionDialog({ config, onClose }: { config: ActionDialogConfig | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [exceptionType, setExceptionType] = useState<ExceptionType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!config) return;
    setError(null);
    if (config.withExceptionType && !exceptionType) {
      setError("Choose the type of problem.");
      return;
    }
    if (config.noteRequired && !note.trim()) {
      setError("Add a note before you continue.");
      return;
    }
    setPending(true);
    try {
      const res = await config.run({ note: note.trim(), exceptionType: exceptionType || "other" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={config != null}
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent className="gap-4 p-5">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">{config?.title}</DialogTitle>
          {config?.description && <DialogDescription className="text-base">{config.description}</DialogDescription>}
        </DialogHeader>
        {config?.withExceptionType && (
          <div className="grid gap-1.5">
            <Label htmlFor="exception-type" className="text-sm">
              Problem
            </Label>
            <Select value={exceptionType} onValueChange={(v) => setExceptionType(v as ExceptionType)}>
              <SelectTrigger id="exception-type" className="h-12 w-full text-base data-[size=default]:h-12">
                <SelectValue placeholder="Choose the problem" />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="min-h-11 text-base">
                    {EXCEPTION_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="action-note" className="text-sm">
            {config?.noteLabel ?? "Note"}
            {config?.noteRequired && <span className="text-status-exception">*</span>}
          </Label>
          <Textarea id="action-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={config?.notePlaceholder} rows={3} className="text-base" autoFocus={!config?.withExceptionType} />
        </div>
        <FormError message={error} />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="lg" className="h-12 text-base" onClick={onClose} disabled={pending}>
            Back
          </Button>
          <Button type="button" variant={config?.destructive ? "destructive" : "default"} size="lg" className="h-12 text-base" onClick={submit} disabled={pending}>
            {pending ? "Working..." : config?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
