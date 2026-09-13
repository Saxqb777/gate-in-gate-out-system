import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { allCargoTypes, allOrganisations, customFieldsFor } from "@/lib/queries/bookings";
import { siteDateKey } from "@/lib/time";
import { ShipmentForm } from "./shipment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New shipment request" };

export default async function NewShipment() {
  await requireRole("customer");
  const [cfg, cargoTypes, carriers, fields] = await Promise.all([getConfig(), allCargoTypes(), allOrganisations("carrier"), customFieldsFor("shipment", "customer")]);
  return (
    <>
      <PageHeader title="New shipment request" description="Tell the warehouse what is coming or going. The carrier books the truck and slot." crumbs={[{ label: "Customer", href: "/customer" }, { label: "Shipments", href: "/customer/shipments" }, { label: "New" }]} />
      <div className="max-w-5xl">
        <ShipmentForm
          mode="create"
          today={siteDateKey()}
          cargoTypes={cargoTypes.map((c) => ({ id: c.id, name: c.name, handlingMinutes: c.handlingMinutes }))}
          carriers={carriers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          uomOptions={cfg.uomOptions}
          customFields={fields.map((f) => ({ id: f.id, label: f.label, fieldKey: f.fieldKey, fieldType: f.fieldType, optionsJson: f.optionsJson, required: f.required, helpText: f.helpText }))}
          redirectBase="/customer/shipments"
        />
      </div>
    </>
  );
}
