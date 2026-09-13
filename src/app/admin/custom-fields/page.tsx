import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { customFields } from "@/lib/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { TonePill } from "@/components/app/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FieldDialog } from "./field-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom fields" };

const GROUPS: { key: "shipment" | "booking" | "carrier" | "customer"; title: string; description: string }[] = [
  { key: "shipment", title: "Shipment form", description: "Filled by the customer when raising a request. Shown to carrier and security." },
  { key: "booking", title: "Booking form", description: "Filled by the carrier with the truck details. Printed on the gate pass." },
  { key: "carrier", title: "Carrier record", description: "Extra attributes on carrier organisations." },
  { key: "customer", title: "Customer record", description: "Extra attributes on customer organisations." },
];

export default async function CustomFieldsPage() {
  await requireRole("admin");
  const rows = await db.select().from(customFields).orderBy(asc(customFields.appliesTo), asc(customFields.sortOrder), asc(customFields.id));
  return (
    <>
      <PageHeader title="Custom fields" description="Fields added here appear on the customer shipment form and the carrier booking form immediately, and their values show on the booking detail and gate pass." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Custom fields" }]} actions={<FieldDialog />} />
      <div className="grid gap-4">
        {GROUPS.map((g) => {
          const items = rows.filter((r) => r.appliesTo === g.key);
          return (
            <TableSection key={g.key} title={g.title} description={g.description}>
              {items.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">No fields yet.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Key</TableHead><TableHead>Type</TableHead><TableHead>Options</TableHead><TableHead>Required</TableHead><TableHead>Visible to</TableHead><TableHead className="text-right">Order</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.label}{f.helpText && <div className="text-[11px] font-normal text-muted-foreground">{f.helpText}</div>}</TableCell>
                        <TableCell className="font-mono text-xs">{f.fieldKey}</TableCell>
                        <TableCell className="capitalize">{f.fieldType === "file" ? "Document reference" : f.fieldType}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{(f.optionsJson ?? []).join(", ")}</TableCell>
                        <TableCell>{f.required ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-xs capitalize">{(f.visibleToRoles ?? []).join(", ")}</TableCell>
                        <TableCell className="text-right tabular">{f.sortOrder}</TableCell>
                        <TableCell><TonePill tone={f.active ? "done" : "neutral"}>{f.active ? "Active" : "Hidden"}</TonePill></TableCell>
                        <TableCell className="text-right"><FieldDialog field={f} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableSection>
          );
        })}
      </div>
    </>
  );
}
