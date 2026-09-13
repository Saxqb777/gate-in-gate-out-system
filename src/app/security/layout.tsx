import { requireRole } from "@/lib/auth/guard";
import { SecurityShell } from "@/components/app/security-shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("security");
  return <SecurityShell user={user}>{children}</SecurityShell>;
}
