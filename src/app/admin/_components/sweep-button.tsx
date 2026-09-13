"use client";

import { Button } from "@/components/ui/button";
import { useAction } from "@/components/app/use-action";
import { sweepNoShowsAction } from "@/lib/actions/gate";

export function SweepButton() {
  const { run, pending } = useAction();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => sweepNoShowsAction())}>
      {pending ? "Checking..." : "Run no show check"}
    </Button>
  );
}
