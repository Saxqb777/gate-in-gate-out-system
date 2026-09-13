"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { blockSlotAction } from "@/lib/actions/admin";

export function BlockSlotButton({ slotId, blocked }: { slotId: number; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-[10px] text-muted-foreground underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        {blocked ? "Unblock" : "Block"}
      </button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={blocked ? "Reopen this slot" : "Block this slot"} description={blocked ? "Carriers will be able to book it again." : "Carriers will not be able to book it."} confirmLabel={blocked ? "Reopen" : "Block slot"} requireReason={!blocked} reasonPlaceholder="For example: forklift maintenance" action={(reason) => blockSlotAction(slotId, !blocked, reason)} />
    </>
  );
}
