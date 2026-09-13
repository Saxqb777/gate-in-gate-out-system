import type { UserRole } from "@/lib/db/schema";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  organisationId: number;
  organisationName: string;
  organisationType: "customer" | "carrier" | "internal";
  title: string | null;
  warehouseOpsView: boolean;
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  carrier: "/carrier",
  customer: "/customer",
  security: "/security",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  carrier: "Carrier",
  customer: "Customer",
  security: "Security",
};
