import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Truck,
  Warehouse,
  ClipboardList,
  Package,
  Settings,
  ScrollText,
  BarChart3,
  Users,
  Building2,
  QrCode,
  ListChecks,
  SlidersHorizontal,
  CalendarDays,
  Container,
  Tags,
  ParkingSquare,
} from "lucide-react";
import type { UserRole } from "@/lib/db/schema";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

export const NAV: Record<UserRole, NavGroup[]> = {
  admin: [
    {
      items: [
        { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/admin/dock-board", label: "Dock board", icon: Warehouse },
        { href: "/admin/yard", label: "Yard", icon: ParkingSquare },
        { href: "/admin/slots", label: "Slot planner", icon: CalendarDays },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
        { href: "/admin/shipments", label: "Shipments", icon: Package },
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
        { href: "/admin/audit", label: "Audit log", icon: ScrollText },
      ],
    },
    {
      title: "Setup",
      items: [
        { href: "/admin/docks", label: "Docks", icon: Container },
        { href: "/admin/organisations", label: "Organisations", icon: Building2 },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/cargo-types", label: "Cargo types", icon: Tags },
        { href: "/admin/custom-fields", label: "Custom fields", icon: SlidersHorizontal },
        { href: "/admin/config", label: "Configuration", icon: Settings },
      ],
    },
  ],
  customer: [
    {
      items: [
        { href: "/customer", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/customer/shipments", label: "Shipments", icon: Package },
        { href: "/customer/shipments/new", label: "New shipment request", icon: ClipboardList, exact: true },
      ],
    },
  ],
  carrier: [
    {
      items: [
        { href: "/carrier", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/carrier/bookings", label: "Bookings", icon: Truck },
        { href: "/carrier/passes", label: "Gate passes", icon: QrCode },
      ],
    },
  ],
  security: [
    {
      items: [
        { href: "/security", label: "Scan", icon: QrCode, exact: true },
        { href: "/security/inside", label: "Inside now", icon: ListChecks },
        { href: "/security/expected", label: "Expected", icon: CalendarDays },
      ],
    },
  ],
};
