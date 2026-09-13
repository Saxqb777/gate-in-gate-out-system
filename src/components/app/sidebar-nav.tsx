"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import type { UserRole } from "@/lib/db/schema";

export function SidebarNav({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV[role];
  return (
    <nav className="flex flex-col gap-4 px-2">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">{g.title}</div>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-active hover:text-white",
                      active && "bg-sidebar-active text-white font-medium",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
