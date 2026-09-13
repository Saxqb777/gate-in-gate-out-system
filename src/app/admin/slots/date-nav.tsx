"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDaysKey } from "@/lib/time";

export function DateNav({ date, base }: { date: string; base: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(`${base}?date=${d}`);
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => go(addDaysKey(date, -1))} aria-label="Previous day"><ChevronLeft className="size-4" /></Button>
      <Input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} className="w-40" />
      <Button variant="outline" size="icon" onClick={() => go(addDaysKey(date, 1))} aria-label="Next day"><ChevronRight className="size-4" /></Button>
    </div>
  );
}
