"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { cancelBookingAction } from "@/lib/actions/bookings";

export function PassActions({ bookingId, qrToken, canCancel }: { bookingId: number; qrToken: string; canCancel: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href={`/api/gate-pass/${qrToken}/pdf`} target="_blank">Download PDF</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`/pass/${qrToken}`} target="_blank">Open mobile pass</Link>
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        Print
      </Button>
      {canCancel && (
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Cancel booking
        </Button>
      )}
      <ConfirmDialog open={open} onOpenChange={setOpen} title="Cancel this booking" description="The slot is released and the customer is notified. The gate pass stops working." confirmLabel="Cancel booking" destructive requireReason reasonPlaceholder="For example: truck breakdown, will rebook" action={(reason) => cancelBookingAction(bookingId, reason)} />
    </div>
  );
}
