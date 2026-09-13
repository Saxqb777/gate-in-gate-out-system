import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { TonePill } from "@/components/app/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allDocks } from "@/lib/queries/bookings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { DockDialog } from "./dock-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Docks" };

export default async function DocksPage() {
  await requireRole("admin");
  const docks = await allDocks();
  const counts = await db.select({ dockId: bookings.dockId, count: sql<number>`count(*)::int` }).from(bookings).where(and(inArray(bookings.status, ACTIVE_STATUSES), gte(bookings.slotStart, new Date()))).groupBy(bookings.dockId);
  const countFor = (id: number) => counts.find((c) => c.dockId === id)?.count ?? 0;
  void eq;
  return (
    <>
      <PageHeader title="Docks" description="Docks the slot engine offers to carriers. Type controls which shipment directions a dock accepts." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Docks" }]} actions={<DockDialog />} />
      <TableSection title={`${docks.length} docks`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Upcoming bookings</TableHead><TableHead className="text-right">Order</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docks.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-[13px] font-medium">{d.code}</TableCell>
                <TableCell>{d.name}</TableCell>
                <TableCell className="capitalize">{d.type === "both" ? "Inbound and outbound" : d.type}</TableCell>
                <TableCell><TonePill tone={d.status === "active" ? "done" : d.status === "maintenance" ? "waiting" : "exception"}>{d.status}</TonePill></TableCell>
                <TableCell className="max-w-[320px] truncate text-muted-foreground">{d.notes}</TableCell>
                <TableCell className="text-right tabular">{countFor(d.id)}</TableCell>
                <TableCell className="text-right tabular">{d.sortOrder}</TableCell>
                <TableCell className="text-right"><DockDialog dock={d} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableSection>
    </>
  );
}
