import { requireRole } from "@/lib/auth/guard";
import { getConfig, CONFIG_DEFS, CONFIG_GROUP_LABELS, type ConfigDef } from "@/lib/config";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/description-list";
import { ConfigGroupForm } from "./config-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuration" };

const ORDER: ConfigDef["group"][] = ["slots", "arrival", "booking", "gate_pass", "site"];
const DESCRIPTIONS: Record<ConfigDef["group"], string> = {
  slots: "The slot grid every dock follows. Nothing here is hard coded in the application.",
  arrival: "How security handles trucks that arrive early or late, and when a booking becomes a no show.",
  booking: "Rules applied when carriers book, and the options shown on the forms.",
  gate_pass: "Text printed on every gate pass.",
  site: "Site identity used in reference numbers and on documents.",
};

export default async function ConfigPage() {
  await requireRole("admin");
  const cfg = await getConfig();
  return (
    <>
      <PageHeader title="Configuration" description="Operating rules for the slot engine, arrivals, bookings and gate passes. Every change is written to the audit log." crumbs={[{ label: "Admin", href: "/admin" }, { label: "Configuration" }]} />
      <div className="grid gap-4">
        {ORDER.map((g) => (
          <Section key={g} title={CONFIG_GROUP_LABELS[g]} description={DESCRIPTIONS[g]}>
            <ConfigGroupForm defs={CONFIG_DEFS.filter((d) => d.group === g).sort((a, b) => a.sortOrder - b.sortOrder)} values={cfg.raw} warning={g === "slots" ? "Changing the slot grid regenerates open future slots. Existing bookings keep their times." : undefined} />
          </Section>
        ))}
      </div>
    </>
  );
}
