"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/app/form";
import { useAction } from "@/components/app/use-action";
import type { ActionResult } from "@/lib/auth/guard";

/**
 * Generic add or edit dialog. The caller renders the fields and provides the submit function.
 * Shows inline errors, toasts on success, closes and refreshes.
 */
export function EntityDialog({ trigger, title, description, submitLabel = "Save", children, onSubmit, wide }: { trigger: React.ReactNode; title: string; description?: string; submitLabel?: string; children: React.ReactNode; onSubmit: () => Promise<ActionResult<unknown>> | string; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const { run, pending, error, setError } = useAction();
  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">{trigger}</span>
      <Dialog open={open} onOpenChange={(o) => { if (!pending) { setOpen(o); setError(null); } }}>
        <DialogContent className={wide ? "max-h-[90vh] overflow-y-auto sm:max-w-2xl" : "max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-3">{children}</div>
          <FormError message={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Back</Button>
            <Button
              disabled={pending}
              onClick={() => {
                const r = onSubmit();
                if (typeof r === "string") return setError(r);
                run(() => r, () => setOpen(false));
              }}
            >
              {pending ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
