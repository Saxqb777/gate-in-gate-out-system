import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { TableSection } from "@/components/app/description-list";
import { EmptyState } from "@/components/app/empty-state";
import { BookingStatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBookings } from "@/lib/queries/bookings";
import { fmtDate, fmtTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gate passes" };

export default async function CarrierPasses() {
  const user = await requireRole("carrier");
  const rows = (await listBookings({ carrierOrgId: user.organisationId, order: "slot_desc", limit: 300 })).filter((r) => r.booking.gatePassNumber);
  return (
    <>
      <PageHeader title="Gate passes" description="Reprint or open any pass issued to your trucks." crumbs={[{ label: "Carrier", href: "/carrier" }, { label: "Gate passes" }]} />
      <TableSection title={`${rows.length} passes`}>
        {rows.length === 0 ? (
          <div className="p-3"><EmptyState title="No gate passes yet." description="A pass is issued as soon as a booking is confirmed." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gate pass</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Dock</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ booking: b, shipment: s, dock }) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-[13px] font-medium">{b.gatePassNumber}</TableCell>
                  <TableCell>
                    <Link href={`/carrier/bookings/${b.id}`} className="font-mono text-[13px] hover:underline">
                      {s.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{b.slotStart ? `${fmtDate(b.originalSlotStart ?? b.slotStart)} ${fmtTime(b.originalSlotStart ?? b.slotStart)}` : ""}</TableCell>
                  <TableCell className="font-mono text-[13px]">{dock?.code ?? ""}</TableCell>
                  <TableCell className="font-mono text-[13px]">{b.truckPlate}</TableCell>
                  <TableCell>{b.driverName}</TableCell>
                  <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button asChild size="sm" variant="outline" className="mr-1"><Link href={`/pass/${b.qrToken}`} target="_blank">View</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link href={`/api/gate-pass/${b.qrToken}/pdf`} target="_blank">PDF</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableSection>
    </>
  );
}
