"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Item = { id: number; title: string; body: string; href: string | null; level: string; createdAt: string; readAt: string | null };

export function NotificationsBell({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const unread = items.filter((i) => !i.readAt);

  function markAll() {
    start(async () => {
      await markNotificationsReadAction(unread.map((u) => u.id));
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4.5" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-exception px-1 text-[10px] font-semibold text-white">{unread.length > 9 ? "9+" : unread.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Notifications</div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} disabled={pending}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing to show.</div>}
          {items.map((n) => {
            const body = (
              <div className={cn("border-b px-3 py-2.5 text-sm last:border-b-0", !n.readAt && "bg-accent/60")}>
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.level === "critical" ? "bg-status-exception" : n.level === "warning" ? "bg-status-waiting" : "bg-status-progress")} />
                  <div className="min-w-0">
                    <div className="font-medium leading-snug">{n.title}</div>
                    <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{n.body}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{n.createdAt}</div>
                  </div>
                </div>
              </div>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block hover:bg-muted/60">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
