"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDateTimeSeconds } from "@/lib/time";

/** Refreshes server components on an interval so live boards stay current without websockets. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  const [last, setLast] = useState<Date | null>(null);
  useEffect(() => {
    setLast(new Date());
    const t = setInterval(() => {
      router.refresh();
      setLast(new Date());
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{last ? `Updated ${fmtDateTimeSeconds(last).slice(-8)}` : ""}</span>
      <Button variant="outline" size="sm" onClick={() => { router.refresh(); setLast(new Date()); }}>
        <RefreshCw className="size-3.5" />
        Refresh
      </Button>
    </div>
  );
}
