import QRCode from "qrcode";
import type { BookingRow } from "@/lib/queries/bookings";
import type { SiteConfig } from "@/lib/config";
import { BookingStatusBadge } from "./status-badge";
import { fmtDate, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function appBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "";
}

export function passUrl(qrToken: string) {
  return `${appBaseUrl()}/pass/${qrToken}`;
}

export async function qrDataUrl(qrToken: string) {
  return QRCode.toDataURL(passUrl(qrToken), { margin: 1, width: 320, color: { dark: "#1a1d19", light: "#ffffff" } });
}

export type PassValue = { label: string; value: string };

/** Field list shared by the HTML pass and the PDF so they never drift apart. */
export function passFields(row: BookingRow, customValues: PassValue[] = []): PassValue[] {
  const { booking: b, shipment: s, carrier, customer, dock, cargoType } = row;
  const slotStart = b.originalSlotStart ?? b.slotStart;
  const slotLen = b.slotStart && b.slotEnd ? b.slotEnd.getTime() - b.slotStart.getTime() : 0;
  const slotEnd = slotStart ? new Date(slotStart.getTime() + slotLen) : null;
  const items: PassValue[] = [
    { label: "Reference", value: s.reference },
    { label: "Direction", value: s.direction === "inbound" ? "Inbound (unloading)" : "Outbound (loading)" },
    { label: "Customer", value: customer.name },
    { label: "Carrier", value: carrier?.name ?? "Not assigned" },
    { label: "Cargo", value: `${s.cargoDescription}${cargoType ? `, ${cargoType.name}` : ""}` },
    { label: "Quantity", value: s.quantity != null ? `${s.quantity} ${s.uom ?? ""}`.trim() : "Not stated" },
  ];
  if (s.containerNumber || s.sealNumber) items.push({ label: "Container and seal", value: `${s.containerNumber ?? ""}${s.sealNumber ? ` / seal ${s.sealNumber}` : ""}` });
  if (s.blNumber) items.push({ label: "BL number", value: s.blNumber });
  if (s.poNumber) items.push({ label: "PO number", value: s.poNumber });
  if (s.invoiceNumber) items.push({ label: "Invoice", value: s.invoiceNumber });
  items.push(
    { label: "Booked slot", value: slotStart ? `${fmtDate(slotStart)}, ${fmtTime(slotStart)} to ${fmtTime(slotEnd)}` : "No slot" },
    { label: "Dock", value: dock ? `${dock.code}, ${dock.name}` : "Assigned on arrival" },
    { label: "Truck plate", value: b.truckPlate ?? "" },
    { label: "Trailer plate", value: b.trailerPlate ?? "None" },
    { label: "Driver", value: b.driverName ?? "" },
    { label: "Driver mobile", value: b.driverMobile ?? "" },
    { label: "Driver ID or licence", value: b.driverIdNumber ?? "" },
    { label: "Truck type", value: `${b.truckType ?? ""}${b.capacity ? `, ${b.capacity}` : ""}` },
  );
  return [...items, ...customValues];
}

export function GatePass({ row, qr, cfg, customValues = [], className }: { row: BookingRow; qr: string; cfg: SiteConfig; customValues?: PassValue[]; className?: string }) {
  const { booking: b } = row;
  const fields = passFields(row, customValues);
  const plate = fields.find((f) => f.label === "Truck plate")?.value;
  return (
    <div className={cn("mx-auto w-full max-w-2xl rounded-md border bg-white text-[#1a1d19] print:max-w-none print:border-0", className)}>
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{cfg.siteName}</div>
          <div className="text-lg font-semibold">Gate pass</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight">{b.gatePassNumber ?? "Not issued"}</div>
          <div className="mt-2">
            <BookingStatusBadge status={b.status} />
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for this gate pass" width={160} height={160} className="size-40 shrink-0 rounded border" />
      </div>
      <div className="border-b px-5 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Truck plate</div>
        <div className="font-mono text-3xl font-bold tracking-tight">{plate || "Not set"}</div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 px-5 py-4 sm:grid-cols-2">
        {fields
          .filter((f) => f.label !== "Truck plate")
          .map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{f.label}</dt>
              <dd className="text-sm">{f.value || "Not set"}</dd>
            </div>
          ))}
      </dl>
      <div className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        <p>{cfg.gatePassInstructions}</p>
        <p className="mt-2 text-[11px]">{cfg.gatePassFooter}</p>
      </div>
    </div>
  );
}
