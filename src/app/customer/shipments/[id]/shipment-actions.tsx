"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { cancelShipmentAction } from "@/lib/actions/shipments";
import { ShipmentForm, type ShipmentFormProps } from "../new/shipment-form";
import { AssignCarrierInline, type CarrierOption } from "./assign-carrier";

export function ShipmentActions({ shipmentId, canAssign, canEdit, canCancel, carriers, currentCarrierId, editProps, bookingLink }: { shipmentId: number; canAssign: boolean; canEdit: boolean; canCancel: boolean; carriers: CarrierOption[]; currentCarrierId: number | null; editProps: Omit<ShipmentFormProps, "mode" | "shipmentId" | "redirectBase" | "onDone">; bookingLink: string | null }) {
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {bookingLink && (
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(bookingLink);
              toast.success("Booking link copied.");
            } catch {
              toast.error("Could not copy. Select the link on the page instead.");
            }
          }}
        >
          Copy booking link
        </Button>
      )}
      {canAssign && <AssignCarrierInline shipmentId={shipmentId} carriers={carriers} currentId={currentCarrierId} />}
      {canEdit && (
        <Button variant="outline" onClick={() => setEdit(true)}>
          Edit details
        </Button>
      )}
      {canCancel && (
        <Button variant="destructive" onClick={() => setCancel(true)}>
          Cancel request
        </Button>
      )}
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit shipment</DialogTitle>
          </DialogHeader>
          <ShipmentForm mode="edit" shipmentId={shipmentId} redirectBase="/customer/shipments" onDone={() => setEdit(false)} {...editProps} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={cancel} onOpenChange={setCancel} title="Cancel this shipment request" description="Any booked slot is released and the carrier is notified." confirmLabel="Cancel request" destructive requireReason action={(reason) => cancelShipmentAction(shipmentId, reason)} />
    </div>
  );
}
