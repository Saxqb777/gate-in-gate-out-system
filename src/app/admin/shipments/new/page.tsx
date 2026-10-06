import { requireRole } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { allCargoTypes, allOrganisations, customFieldsFor } from "@/lib/queries/bookings";
import { siteDateKey } from "@/lib/time";
import { ShipmentForm } from "@/app/customer/shipments/new/shipment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New shipment" };

/** Admin raises a shipment on behalf of a business unit, for example from a phone call. */
export default async function AdminNewShipment() {
  await requireRole("admin");
  const [cfg, cargoTypes, carriers, customers, fields] = await Promise.all([getConfig(), allCargoTypes(), allOrganisations("carrier"), allOrganisations("customer"), customFieldsFor("shipment", "admin")]);
  return (
    <>
      <PageHeader title="New shipment" description="Raise a request on behalf of a business unit. You land on the booking afterwards, where you can also enter the truck details." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Shipments", href: "/admin/shipments" }, { label: "New" }]} />
      <div className="max-w-5xl">
        <ShipmentForm
          mode="create"
          today={siteDateKey()}
          cargoTypes={cargoTypes.map((c) => ({ id: c.id, name: c.name, handlingMinutes: c.handlingMinutes }))}
          carriers={carriers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          customers={customers.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          uomOptions={cfg.uomOptions}
          customFields={fields.map((f) => ({ id: f.id, label: f.label, fieldKey: f.fieldKey, fieldType: f.fieldType, optionsJson: f.optionsJson, required: f.required, helpText: f.helpText }))}
          redirectBase="/admin/bookings"
          redirectKey="bookingId"
        />
      </div>
    </>
  );
}
