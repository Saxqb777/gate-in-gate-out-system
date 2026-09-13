import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/app/shell";
import { notificationsForUser } from "@/lib/queries/notifications";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("customer");
  const notifications = await notificationsForUser(user);
  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
