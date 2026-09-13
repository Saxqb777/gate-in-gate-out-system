import { Logo } from "./logo";
import { UserMenu } from "./user-menu";
import { SecurityTabs } from "./security-tabs";
import type { SessionUser } from "@/lib/auth/roles";

/** Large, simple shell for the gate house. Works on a phone or tablet. */
export function SecurityShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-3">
          <Logo />
          <UserMenu user={user} />
        </div>
        <div className="mx-auto max-w-3xl px-3 pb-2">
          <SecurityTabs />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">{children}</main>
    </div>
  );
}
