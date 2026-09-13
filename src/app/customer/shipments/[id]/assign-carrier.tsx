"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/app/form";
import { useAction } from "@/components/app/use-action";
import { assignCarrierAction } from "@/lib/actions/shipments";

export type CarrierOption = { id: number; name: string };

export function AssignCarrierInline({ shipmentId, carriers, currentId, label }: { shipmentId: number; carriers: CarrierOption[]; currentId?: number | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [carrierId, setCarrierId] = useState(currentId ? String(currentId) : "");
  const { run, pending, error, setError } = useAction();
  return (
    <>
      <Button size="sm" variant={currentId ? "outline" : "default"} onClick={() => setOpen(true)}>
        {label ?? (currentId ? "Change carrier" : "Assign carrier")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!pending) { setOpen(o); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentId ? "Change carrier" : "Assign a carrier"}</DialogTitle>
            <DialogDescription>The carrier receives a booking link to add truck details and pick a dock slot.</DialogDescription>
          </DialogHeader>
          <Select value={carrierId} onValueChange={setCarrierId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose a carrier" /></SelectTrigger>
            <SelectContent>
              {carriers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormError message={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Back</Button>
            <Button disabled={pending || !carrierId} onClick={() => run(() => assignCarrierAction(shipmentId, Number(carrierId)), () => setOpen(false))}>
              {pending ? "Sending..." : "Assign and send link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
