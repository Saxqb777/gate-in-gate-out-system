"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import type { ActionResult } from "@/lib/auth/guard";

async function reload(): Promise<ActionResult<{ bookings: number }>> {
  try {
    const res = await fetch("/api/admin/demo-reset", { method: "POST" });
    const body = (await res.json()) as { ok: boolean; bookings?: number; error?: string };
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? "Demo reset failed." };
    return { ok: true, data: { bookings: body.bookings ?? 0 }, message: `Demo data reloaded. ${body.bookings} bookings dated around today.` };
  } catch {
    return { ok: false, error: "Could not reach the server. Try again." };
  }
}

/** One click reload of the demo bookings, for use between client meetings. */
export function DemoReset() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Removes every shipment, booking, gate event, audit row and notification, then loads fresh demo bookings dated around today. Docks, organisations, users, cargo types, custom fields and configuration are kept. Takes up to a minute. Not for use after go live.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>Reload demo data</Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title="Reload demo data" description="All current shipments and bookings are deleted and replaced with demo bookings. This cannot be undone." confirmLabel="Reload demo data" destructive action={reload} />
    </div>
  );
}
