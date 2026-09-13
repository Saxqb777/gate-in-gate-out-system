import { cache } from "react";
import { db } from "@/lib/db";
import { configSettings } from "@/lib/db/schema";
import type { Tx } from "@/lib/db";

export type ConfigValueType = "string" | "number" | "boolean" | "time" | "json" | "select" | "text";

export type ConfigDef = {
  key: string;
  label: string;
  description: string;
  group: "site" | "slots" | "arrival" | "booking" | "gate_pass";
  type: ConfigValueType;
  default: string;
  options?: string[];
  sortOrder: number;
};

/** Every configurable behaviour in the system. Values are stored as strings in config_settings and parsed by type. */
export const CONFIG_DEFS: ConfigDef[] = [
  { key: "site_code", label: "Site code", description: "Used as the prefix of shipment reference numbers, for example ALF.", group: "site", type: "string", default: "ALF", sortOrder: 1 },
  { key: "site_name", label: "Site name", description: "Shown on gate passes and reports.", group: "site", type: "string", default: "Al Foah Warehouse, Al Ain", sortOrder: 2 },
  { key: "site_timezone", label: "Site timezone", description: "All slots and timestamps are shown in this timezone.", group: "site", type: "string", default: "Asia/Dubai", sortOrder: 3 },
  { key: "yard_capacity", label: "Yard capacity", description: "Maximum number of trucks that can wait in the yard at one time. Security is warned when this is reached.", group: "site", type: "number", default: "20", sortOrder: 4 },

  { key: "operating_start", label: "Operating hours start", description: "First slot of the day starts at this time.", group: "slots", type: "time", default: "06:00", sortOrder: 10 },
  { key: "operating_end", label: "Operating hours end", description: "No slot may end after this time.", group: "slots", type: "time", default: "22:00", sortOrder: 11 },
  { key: "slot_minutes", label: "Slot length (minutes)", description: "Length of each booking slot.", group: "slots", type: "number", default: "60", sortOrder: 12 },
  { key: "buffer_minutes", label: "Buffer between slots (minutes)", description: "Gap kept free between consecutive slots on the same dock.", group: "slots", type: "number", default: "15", sortOrder: 13 },
  { key: "max_concurrent_trucks", label: "Max concurrent trucks", description: "Maximum trucks that can be at docks at the same time across the whole site.", group: "slots", type: "number", default: "8", sortOrder: 14 },
  { key: "default_handling_minutes", label: "Default handling duration (minutes)", description: "Used when the cargo type has no handling duration of its own.", group: "slots", type: "number", default: "60", sortOrder: 15 },
  { key: "operating_days", label: "Operating days", description: "Days of the week the site accepts bookings. 1 is Monday, 7 is Sunday.", group: "slots", type: "json", default: "[1,2,3,4,5,6,7]", sortOrder: 16 },

  { key: "early_arrival_mode", label: "Early arrival rule", description: "bump: promote early trucks into a free dock and push later bookings to the next slot. strict: only use docks with nothing booked over the handling window. off: early trucks always wait for their slot.", group: "arrival", type: "select", default: "bump", options: ["bump", "strict", "off"], sortOrder: 20 },
  { key: "early_arrival_max_minutes", label: "Earliest accepted arrival (minutes before slot)", description: "Trucks arriving earlier than this are still gated in but always sent to the yard.", group: "arrival", type: "number", default: "240", sortOrder: 21 },
  { key: "late_tolerance_minutes", label: "Late tolerance (minutes)", description: "Arrivals after slot start plus this tolerance are counted as late in reports.", group: "arrival", type: "number", default: "30", sortOrder: 22 },
  { key: "no_show_after_minutes", label: "No show after (minutes)", description: "A booking with no gate in this long after its slot end is marked as a no show.", group: "arrival", type: "number", default: "60", sortOrder: 23 },

  { key: "approval_required", label: "Bookings need admin approval", description: "When on, carrier bookings wait for an admin to approve before the gate pass is valid.", group: "booking", type: "boolean", default: "false", sortOrder: 30 },
  { key: "booking_horizon_days", label: "Booking horizon (days)", description: "How far ahead carriers can book.", group: "booking", type: "number", default: "14", sortOrder: 31 },
  { key: "min_lead_minutes", label: "Minimum lead time (minutes)", description: "Slots starting sooner than this cannot be booked.", group: "booking", type: "number", default: "60", sortOrder: 32 },
  { key: "carrier_cancel_cutoff_minutes", label: "Carrier cancel cutoff (minutes)", description: "Carriers cannot cancel a booking closer than this to slot start. Admin can always cancel.", group: "booking", type: "number", default: "120", sortOrder: 33 },
  { key: "truck_types", label: "Truck types", description: "Options offered on the booking form, one per line.", group: "booking", type: "text", default: "Flatbed\nCurtain sider\nBox truck\nReefer\nContainer chassis 20ft\nContainer chassis 40ft\nTanker\nPickup", sortOrder: 34 },
  { key: "uom_options", label: "Units of measure", description: "Options offered on the shipment form, one per line.", group: "booking", type: "text", default: "Pallets\nCartons\nBags\nTonnes\nContainers\nDrums\nBins", sortOrder: 35 },

  { key: "gate_pass_instructions", label: "Gate pass instructions", description: "Printed on every gate pass.", group: "gate_pass", type: "text", default: "Present this pass at Gate House 1. Driver must carry Emirates ID or licence matching the pass. Arrive no more than 4 hours before the booked slot. Speed limit inside the facility is 20 km/h.", sortOrder: 40 },
  { key: "gate_pass_footer", label: "Gate pass footer", description: "Small print at the bottom of the gate pass.", group: "gate_pass", type: "string", default: "Agthia Group PJSC, Al Foah Warehouse, Al Ain, United Arab Emirates", sortOrder: 41 },
];

export const CONFIG_GROUP_LABELS: Record<ConfigDef["group"], string> = {
  site: "Site",
  slots: "Slots and docks",
  arrival: "Arrival rules",
  booking: "Booking rules",
  gate_pass: "Gate pass",
};

export type SiteConfig = {
  siteCode: string;
  siteName: string;
  siteTimezone: string;
  yardCapacity: number;
  operatingStart: string;
  operatingEnd: string;
  slotMinutes: number;
  bufferMinutes: number;
  maxConcurrentTrucks: number;
  defaultHandlingMinutes: number;
  operatingDays: number[];
  earlyArrivalMode: "bump" | "strict" | "off";
  earlyArrivalMaxMinutes: number;
  lateToleranceMinutes: number;
  noShowAfterMinutes: number;
  approvalRequired: boolean;
  bookingHorizonDays: number;
  minLeadMinutes: number;
  carrierCancelCutoffMinutes: number;
  truckTypes: string[];
  uomOptions: string[];
  gatePassInstructions: string;
  gatePassFooter: string;
  raw: Record<string, string>;
};

function parseConfig(raw: Record<string, string>): SiteConfig {
  const get = (k: string) => raw[k] ?? CONFIG_DEFS.find((d) => d.key === k)!.default;
  const num = (k: string) => {
    const n = Number(get(k));
    return Number.isFinite(n) ? n : Number(CONFIG_DEFS.find((d) => d.key === k)!.default);
  };
  const bool = (k: string) => get(k) === "true";
  const lines = (k: string) =>
    get(k)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  let operatingDays: number[] = [1, 2, 3, 4, 5, 6, 7];
  try {
    const parsed = JSON.parse(get("operating_days"));
    if (Array.isArray(parsed)) operatingDays = parsed.map(Number).filter((n) => n >= 1 && n <= 7);
  } catch {
    /* keep default */
  }
  const mode = get("early_arrival_mode");
  return {
    siteCode: get("site_code"),
    siteName: get("site_name"),
    siteTimezone: get("site_timezone"),
    yardCapacity: num("yard_capacity"),
    operatingStart: get("operating_start"),
    operatingEnd: get("operating_end"),
    slotMinutes: num("slot_minutes"),
    bufferMinutes: num("buffer_minutes"),
    maxConcurrentTrucks: num("max_concurrent_trucks"),
    defaultHandlingMinutes: num("default_handling_minutes"),
    operatingDays,
    earlyArrivalMode: mode === "strict" || mode === "off" ? mode : "bump",
    earlyArrivalMaxMinutes: num("early_arrival_max_minutes"),
    lateToleranceMinutes: num("late_tolerance_minutes"),
    noShowAfterMinutes: num("no_show_after_minutes"),
    approvalRequired: bool("approval_required"),
    bookingHorizonDays: num("booking_horizon_days"),
    minLeadMinutes: num("min_lead_minutes"),
    carrierCancelCutoffMinutes: num("carrier_cancel_cutoff_minutes"),
    truckTypes: lines("truck_types"),
    uomOptions: lines("uom_options"),
    gatePassInstructions: get("gate_pass_instructions"),
    gatePassFooter: get("gate_pass_footer"),
    raw,
  };
}

export async function loadConfig(tx?: Tx): Promise<SiteConfig> {
  const rows = await (tx ?? db).select().from(configSettings);
  const raw: Record<string, string> = {};
  for (const r of rows) raw[r.key] = r.value;
  return parseConfig(raw);
}

/** Request scoped cached config for server components. */
export const getConfig = cache(async () => loadConfig());
