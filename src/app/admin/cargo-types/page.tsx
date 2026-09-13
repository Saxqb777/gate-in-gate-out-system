import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { TonePill } from "@/components/app/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allCargoTypes } from "@/lib/queries/bookings";
import { CargoTypeDialog } from "./cargo-type-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cargo types" };

export default async function CargoTypesPage() {
  await requireRole("admin");
  const rows = await allCargoTypes(false);
  return (
    <>
      <PageHeader title="Cargo types" description="Each type carries a handling duration. The slot engine reserves that much dock time, so a 120 minute container booking takes two consecutive slots." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Cargo types" }]} actions={<CargoTypeDialog />} />
      <TableSection title={`${rows.length} cargo types`}>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Handling minutes</TableHead><TableHead className="text-right">Order</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right tabular">{c.handlingMinutes}</TableCell>
                <TableCell className="text-right tabular">{c.sortOrder}</TableCell>
                <TableCell><TonePill tone={c.active ? "done" : "neutral"}>{c.active ? "Active" : "Hidden"}</TonePill></TableCell>
                <TableCell className="text-right"><CargoTypeDialog item={c} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableSection>
    </>
  );
}
