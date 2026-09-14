"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Lets a planner complete the truck details for a carrier that has no office login. */
export function SelfBookToggle({ carrierName, children }: { carrierName: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded border border-dashed px-3 py-2.5">
        <div className="text-sm">
          <div className="font-medium">Already have the truck details from {carrierName}?</div>
          <div className="text-xs text-muted-foreground">You can enter them and pick the slot yourself. The carrier is notified and gets the gate pass in their account.</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Enter truck details myself
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Truck details on behalf of {carrierName}</div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </div>
      {children}
    </div>
  );
}
