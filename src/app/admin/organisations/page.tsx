import { eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { TonePill } from "@/components/app/status-badge";
import { ListFilters } from "@/components/app/list-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allOrganisations } from "@/lib/queries/bookings";
import { param, type SearchParams } from "@/lib/params";
import { OrgDialog } from "./org-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organisations" };

export default async function OrganisationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const type = param(sp, "type") as "customer" | "carrier" | "internal" | undefined;
  const orgs = await allOrganisations(type);
  const counts = await db.select({ orgId: users.organisationId, count: sql<number>`count(*)::int` }).from(users).groupBy(users.organisationId);
  void eq;
  return (
    <>
      <PageHeader title="Organisations" description="Customers (Agthia business units), carriers, and internal teams." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Organisations" }]} actions={<OrgDialog />} />
      <ListFilters fields={[{ key: "type", label: "Type", type: "select", options: [{ value: "customer", label: "Customers" }, { value: "carrier", label: "Carriers" }, { value: "internal", label: "Internal" }] }]} />
      <TableSection title={`${orgs.length} organisations`}>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Trade licence</TableHead><TableHead className="text-right">Users</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="font-mono text-xs">{o.code}</TableCell>
                <TableCell className="capitalize">{o.type}</TableCell>
                <TableCell>{o.contactName}</TableCell>
                <TableCell>{o.contactEmail}</TableCell>
                <TableCell>{o.contactPhone}</TableCell>
                <TableCell className="font-mono text-xs">{o.tradeLicence}</TableCell>
                <TableCell className="text-right tabular">{counts.find((c) => c.orgId === o.id)?.count ?? 0}</TableCell>
                <TableCell><TonePill tone={o.active ? "done" : "neutral"}>{o.active ? "Active" : "Inactive"}</TonePill></TableCell>
                <TableCell className="text-right"><OrgDialog org={o} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableSection>
    </>
  );
}
