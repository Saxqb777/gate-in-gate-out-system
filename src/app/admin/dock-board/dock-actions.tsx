"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/app/form";
import { useAction } from "@/components/app/use-action";
import { startHandlingAction, finishHandlingAction, sendToYardAction, gateOutAction } from "@/lib/actions/gate";

export function DockActions({ bookingId, status }: { bookingId: number; status: string }) {
  const { run, pending, error } = useAction();
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {status === "AT_DOCK" && (
          <Button size="sm" disabled={pending} onClick={() => run(() => startHandlingAction(bookingId))}>
            Start handling
          </Button>
        )}
        {status === "HANDLING" && (
          <Button size="sm" disabled={pending} onClick={() => run(() => finishHandlingAction(bookingId))}>
            Finish handling
          </Button>
        )}
        {status === "COMPLETED" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => gateOutAction(bookingId))}>
            Gate out
          </Button>
        )}
        {status === "AT_DOCK" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => sendToYardAction(bookingId, "Moved to yard from dock board"))}>
            Send to yard
          </Button>
        )}
      </div>
      <FormError message={error} />
    </div>
  );
}
