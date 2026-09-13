"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormError } from "@/components/app/form";
import { SlotPicker, type PickedSlot } from "@/components/app/slot-picker";
import { useAction } from "@/components/app/use-action";
import { approveBookingAction, rejectBookingAction, reassignBookingAction, cancelBookingAction } from "@/lib/actions/bookings";
import { startHandlingAction, finishHandlingAction, sendToYardAction, gateOutAction, clearExceptionAction } from "@/lib/actions/gate";
import { CallToDockButton, type DockOption } from "../../_components/call-to-dock-dialog";

type Props = { bookingId: number; reference: string; status: string; initialDate: string; minDate: string; maxDate: string; freeDocks: DockOption[] };

export function BookingActions({ bookingId, reference, status, initialDate, minDate, maxDate, freeDocks }: Props) {
  const { run, pending, error } = useAction();
  const [dialog, setDialog] = useState<null | "reject" | "cancel" | "move" | "gateout" | "clear">(null);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [reason, setReason] = useState("");
  const [resumeAs, setResumeAs] = useState<"BOOKED" | "ARRIVED" | "IN_YARD" | "AT_DOCK">("ARRIVED");
  const [localError, setLocalError] = useState<string | null>(null);
  const movable = ["PENDING_APPROVAL", "BOOKED", "ARRIVED", "IN_YARD"].includes(status);
  const cancellable = !["GATE_OUT", "CANCELLED", "NO_SHOW", "REJECTED"].includes(status);
  const close = () => { setDialog(null); setReason(""); setSlot(null); setLocalError(null); };

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-2">
        {status === "PENDING_APPROVAL" && (
          <>
            <Button disabled={pending} onClick={() => run(() => approveBookingAction(bookingId))}>Approve</Button>
            <Button variant="destructive" disabled={pending} onClick={() => setDialog("reject")}>Reject</Button>
          </>
        )}
        {status === "AT_DOCK" && <Button disabled={pending} onClick={() => run(() => startHandlingAction(bookingId))}>Start handling</Button>}
        {status === "HANDLING" && <Button disabled={pending} onClick={() => run(() => finishHandlingAction(bookingId))}>Finish handling</Button>}
        {status === "COMPLETED" && <Button disabled={pending} onClick={() => run(() => gateOutAction(bookingId))}>Gate out</Button>}
        {["IN_YARD", "ARRIVED"].includes(status) && <CallToDockButton bookingId={bookingId} reference={reference} docks={freeDocks} size="default" />}
        {["ARRIVED", "AT_DOCK"].includes(status) && <Button variant="outline" disabled={pending} onClick={() => run(() => sendToYardAction(bookingId, "Moved to yard by admin"))}>Send to yard</Button>}
        {["ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING", "EXCEPTION"].includes(status) && <Button variant="outline" onClick={() => setDialog("gateout")}>Gate out with note</Button>}
        {status === "EXCEPTION" && <Button onClick={() => setDialog("clear")}>Clear exception</Button>}
        {movable && <Button variant="outline" onClick={() => setDialog("move")}>Move to another slot</Button>}
        {cancellable && <Button variant="destructive" onClick={() => setDialog("cancel")}>Cancel booking</Button>}
      </div>
      <FormError message={error} />

      <ConfirmDialog open={dialog === "reject"} onOpenChange={(o) => !o && close()} title="Reject this booking" description="The slot is released and the carrier and customer are notified." confirmLabel="Reject" destructive requireReason action={(r) => rejectBookingAction(bookingId, r)} />
      <ConfirmDialog open={dialog === "cancel"} onOpenChange={(o) => !o && close()} title="Cancel this booking" description="The slot is released and both parties are notified." confirmLabel="Cancel booking" destructive requireReason action={(r) => cancelBookingAction(bookingId, r)} />
      <ConfirmDialog open={dialog === "gateout"} onOpenChange={(o) => !o && close()} title="Gate out before completion" description="Record why the truck is leaving." confirmLabel="Gate out" requireReason reasonLabel="Note" action={(r) => gateOutAction(bookingId, r)} />

      <Dialog open={dialog === "move"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Move {reference} to another slot</DialogTitle>
            <DialogDescription>Pick a new dock and time. The carrier and customer are notified with your reason.</DialogDescription>
          </DialogHeader>
          <SlotPicker bookingId={bookingId} initialDate={initialDate} minDate={minDate} maxDate={maxDate} value={slot} onChange={setSlot} compact />
          <div className="text-sm">{slot ? `Selected: ${slot.dockCode}, ${slot.date}, ${slot.startTime} to ${slot.endTime}` : <span className="text-muted-foreground">No slot selected.</span>}</div>
          <div className="grid gap-1.5">
            <Label htmlFor="move-reason">Reason</Label>
            <Textarea id="move-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: DOCK-03 leveller fault, moved to DOCK-07" />
          </div>
          <FormError message={localError ?? error} />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>Back</Button>
            <Button
              disabled={pending}
              onClick={() => {
                setLocalError(null);
                if (!slot) return setLocalError("Pick a slot.");
                if (!reason.trim()) return setLocalError("Give a reason.");
                run(() => reassignBookingAction(bookingId, slot.slotId, reason.trim()), close);
              }}
            >
              {pending ? "Moving..." : "Move booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "clear"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear exception</DialogTitle>
            <DialogDescription>Decide where the truck continues from.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Resume as</Label>
            <Select value={resumeAs} onValueChange={(v) => setResumeAs(v as typeof resumeAs)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BOOKED">Booked (truck turned away, may return)</SelectItem>
                <SelectItem value="ARRIVED">Arrived (at the gate)</SelectItem>
                <SelectItem value="IN_YARD">In yard</SelectItem>
                <SelectItem value="AT_DOCK">At dock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="clear-note">Decision note</Label>
            <Textarea id="clear-note" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <FormError message={localError ?? error} />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>Back</Button>
            <Button disabled={pending} onClick={() => { if (!reason.trim()) return setLocalError("Add a note."); run(() => clearExceptionAction(bookingId, resumeAs, reason.trim()), close); }}>Clear exception</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
