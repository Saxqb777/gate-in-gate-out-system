"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/auth/guard";

/**
 * A confirm dialog that optionally captures a reason, runs a server action and shows
 * a toast on success or an inline error on failure.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  requireReason,
  reasonLabel = "Reason",
  reasonPlaceholder,
  action,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  action: (reason: string) => Promise<ActionResult<unknown>>;
  onSuccess?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (requireReason && !reason.trim()) {
      setError("Please give a reason.");
      return;
    }
    start(async () => {
      const res = await action(reason.trim());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.message ?? "Done.");
      onOpenChange(false);
      setReason("");
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) { onOpenChange(o); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {requireReason && (
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} rows={3} />
          </div>
        )}
        {error && <div className="rounded border border-status-exception/30 bg-status-exception-bg px-3 py-2 text-sm text-status-exception">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Back
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
