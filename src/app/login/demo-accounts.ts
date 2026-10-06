/** Seeded demo accounts shown on the sign in page while demo logins are on. Password matches the seed. */
export type DemoAccount = { label: string; detail: string; role: "admin" | "customer" | "carrier" | "security"; email: string; password: string };

const PASSWORD = "Foah@2026";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Admin", detail: "Agthia warehouse manager", role: "admin", email: "admin@agthia.ae", password: PASSWORD },
  { label: "Warehouse ops", detail: "Control room, opens on the dock board", role: "admin", email: "warehouse@agthia.ae", password: PASSWORD },
  { label: "Security", detail: "Gate House 1", role: "security", email: "security@agthia.ae", password: PASSWORD },
  { label: "Al Foah Dates", detail: "Customer planner", role: "customer", email: "planner@alfoah.ae", password: PASSWORD },
  { label: "Grand Mills", detail: "Customer planner", role: "customer", email: "planner@grandmills.ae", password: PASSWORD },
  { label: "Al Wafi Transport", detail: "Carrier dispatch", role: "carrier", email: "ops@alwafi-transport.ae", password: PASSWORD },
  { label: "Emirates Haulage", detail: "Carrier dispatch", role: "carrier", email: "ops@emirates-haulage.ae", password: PASSWORD },
];
