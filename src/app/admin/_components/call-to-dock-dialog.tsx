"use client";

import { useState } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/app/form";
import { callToDockAction } from "@/lib/actions/gate";
import { useAction } from "@/components/app/use-action";

export type DockOption = { id: number; code: string; name: string };

const FIRST_FREE = "first-free";

/** Button that opens a dock chooser and calls the truck to that dock, or to the first free compatible dock. */
export function CallToDockButton({
  bookingId,
  reference,
  docks,
  size = "sm",
  variant = "default",
}: {
  bookingId: number;
  reference: string;
  /** Active docks that take this direction and have no truck on them right now. */
  docks: DockOption[];
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const [open, setOpen] = useState(false);
  const [dockId, setDockId] = useState<string>(FIRST_FREE);
  const { run, pending, error, setError } = useAction();

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        Call to dock
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call {reference} to a dock</DialogTitle>
            <DialogDescription>
              {docks.length === 0
                ? "No compatible dock is free right now. Wait for a dock to clear or move a truck to the yard first."
                : docks.length === 1
                  ? "1 compatible dock is free right now."
                  : `${docks.length} compatible docks are free right now.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="call-to-dock-select">Dock</Label>
            <Select value={dockId} onValueChange={setDockId}>
              <SelectTrigger id="call-to-dock-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FIRST_FREE}>First free dock</SelectItem>
                {docks.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.code}, {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Back
            </Button>
            <Button onClick={() => run(() => callToDockAction(bookingId, dockId === FIRST_FREE ? null : Number(dockId)), () => setOpen(false))} disabled={pending}>
              {pending ? "Working..." : "Call to dock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
