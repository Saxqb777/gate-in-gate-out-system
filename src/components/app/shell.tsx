import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SessionUser } from "@/lib/auth/roles";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications-bell";
import { fmtDate } from "@/lib/time";

export type Crumb = { label: string; href?: string };

export function AppShell({ user, children, notifications }: { user: SessionUser; children: React.ReactNode; notifications: { id: number; title: string; body: string; href: string | null; level: string; createdAt: string; readAt: string | null }[] }) {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-4 py-3">
          <Logo light />
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav role={user.role} />
        </div>
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-muted">
          <div>{fmtDate(new Date())}</div>
          <div>Times shown in Gulf Standard Time</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-card px-3 sm:px-4">
          <MobileNav role={user.role} />
          <div className="lg:hidden">
            <Logo />
          </div>
          <div id="breadcrumb-slot" className="hidden min-w-0 flex-1 lg:block" />
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell items={notifications} />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5">{children}</main>
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3" />}
          {c.href ? (
            <Link href={c.href} className="hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
