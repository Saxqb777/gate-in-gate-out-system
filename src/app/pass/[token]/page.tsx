import Link from "next/link";
import { getBookingRowByToken, customValuesFor } from "@/lib/queries/bookings";
import { getConfig } from "@/lib/config";
import { GatePass, qrDataUrl } from "@/components/app/gate-pass";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gate pass" };

export default async function PublicPassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getBookingRowByToken(token);
  if (!row || !row.booking.gatePassNumber) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Logo />
        <div className="text-lg font-semibold">This pass is not valid</div>
        <p className="max-w-sm text-sm text-muted-foreground">The link may be wrong or the booking has not been confirmed. Contact your dispatcher.</p>
      </div>
    );
  }
  const cfg = await getConfig();
  const custom = await customValuesFor("booking", row.booking.id);
  const qr = await qrDataUrl(row.booking.qrToken);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Logo />
          <Button asChild size="sm">
            <Link href={`/api/gate-pass/${token}/pdf`} target="_blank">
              Download PDF
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-3 py-4">
        <GatePass row={row} qr={qr} cfg={cfg} customValues={custom.filter((c) => c.value).map((c) => ({ label: c.field.label, value: c.field.fieldType === "checkbox" ? (c.value === "true" ? "Yes" : "No") : c.value ?? "" }))} />
        <p className="mt-4 text-center text-xs text-muted-foreground">Show this screen or the printed pass at the gate.</p>
      </main>
    </div>
  );
}
