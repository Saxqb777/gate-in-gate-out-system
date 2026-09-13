import { NextResponse } from "next/server";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getBookingRowByToken, customValuesFor } from "@/lib/queries/bookings";
import { loadConfig } from "@/lib/config";
import { passFields, qrDataUrl } from "@/components/app/gate-pass";
import { BOOKING_STATUS_META } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 9.5, color: "#1a1d19" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e3e6e0", paddingBottom: 10 },
  site: { fontSize: 8, color: "#6b7268", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  gp: { fontSize: 20, fontFamily: "Courier-Bold", marginTop: 4 },
  status: { marginTop: 6, fontSize: 9, color: "#5b8c2a", fontFamily: "Helvetica-Bold" },
  plateBox: { borderBottomWidth: 1, borderBottomColor: "#e3e6e0", paddingVertical: 8 },
  label: { fontSize: 7.5, color: "#6b7268", textTransform: "uppercase", letterSpacing: 0.6 },
  plate: { fontSize: 24, fontFamily: "Courier-Bold", marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 8 },
  cell: { width: "50%", paddingRight: 10, paddingVertical: 3.5 },
  value: { fontSize: 10, marginTop: 1 },
  footer: { borderTopWidth: 1, borderTopColor: "#e3e6e0", marginTop: 10, paddingTop: 8, fontSize: 8, color: "#6b7268", lineHeight: 1.4 },
  small: { fontSize: 7, color: "#6b7268", marginTop: 6 },
});

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const row = await getBookingRowByToken(token);
  if (!row || !row.booking.gatePassNumber) return new NextResponse("Not found", { status: 404 });
  const cfg = await loadConfig();
  const custom = await customValuesFor("booking", row.booking.id);
  const fields = passFields(
    row,
    custom.filter((c) => c.value).map((c) => ({ label: c.field.label, value: c.field.fieldType === "checkbox" ? (c.value === "true" ? "Yes" : "No") : c.value ?? "" })),
  );
  const qr = await qrDataUrl(row.booking.qrToken);
  const plate = fields.find((f) => f.label === "Truck plate")?.value ?? "";

  const doc = (
    <Document title={`Gate pass ${row.booking.gatePassNumber}`} author={cfg.siteName}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.site}>{cfg.siteName}</Text>
            <Text style={styles.title}>Gate pass</Text>
            <Text style={styles.gp}>{row.booking.gatePassNumber}</Text>
            <Text style={styles.status}>{BOOKING_STATUS_META[row.booking.status].label}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qr} style={{ width: 110, height: 110 }} />
        </View>
        <View style={styles.plateBox}>
          <Text style={styles.label}>Truck plate</Text>
          <Text style={styles.plate}>{plate || "Not set"}</Text>
        </View>
        <View style={styles.grid}>
          {fields
            .filter((f) => f.label !== "Truck plate")
            .map((f) => (
              <View key={f.label} style={styles.cell}>
                <Text style={styles.label}>{f.label}</Text>
                <Text style={styles.value}>{f.value || "Not set"}</Text>
              </View>
            ))}
        </View>
        <View style={styles.footer}>
          <Text>{cfg.gatePassInstructions}</Text>
          <Text style={styles.small}>{cfg.gatePassFooter}</Text>
        </View>
      </Page>
    </Document>
  );
  const buffer = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${row.booking.gatePassNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
