import { requireRole } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/page-header";
import { GateScanner } from "./gate-scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scan" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SecurityScanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("security");
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = raw?.trim() || null;
  return (
    <>
      <PageHeader title="Scan" description="Scan the QR code on the gate pass, or type the reference or gate pass number." />
      <GateScanner initialQuery={q} />
    </>
  );
}
