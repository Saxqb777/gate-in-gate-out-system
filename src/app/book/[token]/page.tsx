import { notFound, redirect } from "next/navigation";
import { getBookingRowByLinkToken } from "@/lib/queries/bookings";
import { getSession, ROLE_HOME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** The link a carrier receives when a customer assigns them a shipment. */
export default async function BookingLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getBookingRowByLinkToken(token);
  if (!row) notFound();
  const target = `/carrier/bookings/${row.booking.id}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(target)}`);
  if (session.role === "carrier" && session.organisationId === row.shipment.carrierOrgId) redirect(target);
  if (session.role === "admin") redirect(`/admin/bookings/${row.booking.id}`);
  redirect(ROLE_HOME[session.role]);
}
