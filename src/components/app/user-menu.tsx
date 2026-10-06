"use client";

import Link from "next/link";
import { LogOut, ChevronDown, LayoutDashboard, Warehouse, ParkingSquare, QrCode } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ROLE_LABEL, type SessionUser } from "@/lib/auth/roles";

export function UserMenu({ user }: { user: SessionUser }) {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary-deep">{initials}</div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[13px] font-medium">{user.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {ROLE_LABEL[user.role]}, {user.organisationName}
          </div>
        </div>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {ROLE_LABEL[user.role]}
            {user.title ? `, ${user.title}` : ""}
          </div>
        </DropdownMenuLabel>
        {user.role === "admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Switch view</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href="/admin"><LayoutDashboard className="size-4" />Admin overview</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/dock-board"><Warehouse className="size-4" />Dock board</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/admin/yard"><ParkingSquare className="size-4" />Yard</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/security"><QrCode className="size-4" />Security gate</Link></DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logoutAction()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
