import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { users, organisations } from "@/lib/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { TonePill } from "@/components/app/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { fmtDateTime } from "@/lib/time";
import { UserDialog } from "./user-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage() {
  await requireRole("admin");
  const rows = await db.select({ u: users, org: { id: organisations.id, name: organisations.name } }).from(users).innerJoin(organisations, eq(organisations.id, users.organisationId)).orderBy(asc(users.role), asc(users.name));
  const orgs = await db.select({ id: organisations.id, name: organisations.name, type: organisations.type }).from(organisations).where(eq(organisations.active, true)).orderBy(asc(organisations.name));
  return (
    <>
      <PageHeader title="Users" description="Who can sign in, and as which role. Users are pre created here, there is no self registration." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} actions={<UserDialog orgs={orgs} />} />
      <TableSection title={`${rows.length} users`}>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Organisation</TableHead><TableHead>Title</TableHead><TableHead>Last login</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ u, org }) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}{u.warehouseOpsView && <span className="ml-2 text-[11px] text-muted-foreground">ops view</span>}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                <TableCell>{org.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.title}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</TableCell>
                <TableCell><TonePill tone={u.active ? "done" : "neutral"}>{u.active ? "Active" : "Disabled"}</TonePill></TableCell>
                <TableCell className="text-right"><UserDialog user={u} orgs={orgs} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableSection>
    </>
  );
}
