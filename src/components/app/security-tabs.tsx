"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

export function SecurityTabs() {
  const pathname = usePathname();
  const items = NAV.security[0].items;
  return (
    <div className="grid grid-cols-3 rounded-md border bg-muted p-0.5">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link key={it.href} href={it.href} className={cn("flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-2 text-sm", active ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
            <Icon className="size-4" />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
