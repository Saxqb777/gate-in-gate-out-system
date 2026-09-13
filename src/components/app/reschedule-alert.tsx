"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acknowledgeRescheduleAction } from "@/lib/actions/bookings";
import { markNotificationsReadAction } from "@/lib/actions/admin";

export type RescheduleNotice = { bookingId: number; reference: string; title: string; body: string; href: string; notificationIds: number[] };

/** Highlighted block shown to carriers and customers when the system moved one of their bookings. */
export function RescheduleAlert({ notices }: { notices: RescheduleNotice[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!notices.length) return null;
  function ack(n: RescheduleNotice) {
    start(async () => {
      const r = await acknowledgeRescheduleAction(n.bookingId);
      if (n.notificationIds.length) await markNotificationsReadAction(n.notificationIds);
      if (r.ok) toast.success(`Acknowledged ${n.reference}.`);
      else toast.error(r.error);
      router.refresh();
    });
  }
  return (
    <div className="mb-4 rounded-md border border-status-waiting/40 bg-status-waiting-bg px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-status-waiting">
        <AlertTriangle className="size-4" />
        {notices.length === 1 ? "A booking was rescheduled by the system" : `${notices.length} bookings were rescheduled by the system`}
      </div>
      <ul className="mt-2 grid gap-2">
        {notices.map((n) => (
          <li key={n.bookingId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-status-waiting/30 bg-card px-3 py-2 text-sm">
            <div className="min-w-0">
              <a href={n.href} className="font-mono font-medium hover:underline">
                {n.reference}
              </a>
              <span className="text-muted-foreground">: {n.body}</span>
            </div>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => ack(n)}>
              Acknowledge
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
