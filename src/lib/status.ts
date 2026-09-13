import type { BookingStatus, ShipmentStatus } from "@/lib/db/schema";

export type StatusTone = "waiting" | "progress" | "done" | "exception" | "neutral";

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; tone: StatusTone; description: string }> = {
  DRAFT: { label: "Draft", tone: "neutral", description: "Shipment raised, carrier not yet assigned." },
  AWAITING_TRUCK_DETAILS: { label: "Awaiting truck details", tone: "waiting", description: "Carrier assigned, truck and slot not yet provided." },
  PENDING_APPROVAL: { label: "Pending approval", tone: "waiting", description: "Booking submitted, waiting for admin approval." },
  BOOKED: { label: "Booked", tone: "progress", description: "Slot confirmed, gate pass issued." },
  ARRIVED: { label: "Arrived", tone: "progress", description: "Truck gated in." },
  IN_YARD: { label: "In yard", tone: "waiting", description: "Truck waiting in the yard for a dock." },
  AT_DOCK: { label: "At dock", tone: "progress", description: "Truck positioned at its dock." },
  HANDLING: { label: "Handling", tone: "progress", description: "Loading or unloading in progress." },
  COMPLETED: { label: "Completed", tone: "done", description: "Handling finished, truck ready to leave." },
  GATE_OUT: { label: "Gated out", tone: "done", description: "Truck has left the facility." },
  CANCELLED: { label: "Cancelled", tone: "neutral", description: "Booking cancelled." },
  NO_SHOW: { label: "No show", tone: "exception", description: "Truck did not arrive for its slot." },
  REJECTED: { label: "Rejected", tone: "exception", description: "Booking rejected by admin." },
  EXCEPTION: { label: "Exception", tone: "exception", description: "Flagged at the gate, needs attention." },
};

export const SHIPMENT_STATUS_META: Record<ShipmentStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  AWAITING_CARRIER: { label: "Awaiting carrier", tone: "waiting" },
  AWAITING_TRUCK_DETAILS: { label: "Awaiting truck details", tone: "waiting" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "waiting" },
  BOOKED: { label: "Booked", tone: "progress" },
  IN_PROGRESS: { label: "In progress", tone: "progress" },
  COMPLETED: { label: "Completed", tone: "done" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "exception" },
  NO_SHOW: { label: "No show", tone: "exception" },
  EXCEPTION: { label: "Exception", tone: "exception" },
};

/** Booking statuses that mean the truck is physically inside the facility. */
export const INSIDE_STATUSES: BookingStatus[] = ["ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING", "COMPLETED", "EXCEPTION"];

/** Booking statuses that hold a dock slot (used by the DB overlap constraint too). */
export const ACTIVE_STATUSES: BookingStatus[] = ["PENDING_APPROVAL", "BOOKED", "ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING"];

/** Statuses from which the carrier may still cancel. */
export const CARRIER_CANCELLABLE: BookingStatus[] = ["AWAITING_TRUCK_DETAILS", "PENDING_APPROVAL", "BOOKED"];

export const TERMINAL_STATUSES: BookingStatus[] = ["GATE_OUT", "CANCELLED", "NO_SHOW", "REJECTED"];

export function shipmentStatusForBooking(status: BookingStatus): ShipmentStatus {
  switch (status) {
    case "DRAFT":
      return "AWAITING_CARRIER";
    case "AWAITING_TRUCK_DETAILS":
      return "AWAITING_TRUCK_DETAILS";
    case "PENDING_APPROVAL":
      return "PENDING_APPROVAL";
    case "BOOKED":
      return "BOOKED";
    case "ARRIVED":
    case "IN_YARD":
    case "AT_DOCK":
    case "HANDLING":
    case "COMPLETED":
      return "IN_PROGRESS";
    case "GATE_OUT":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    case "NO_SHOW":
      return "NO_SHOW";
    case "REJECTED":
      return "REJECTED";
    case "EXCEPTION":
      return "EXCEPTION";
  }
}

export const GATE_EVENT_LABEL: Record<string, string> = {
  gate_in: "Gate in",
  yard_in: "Sent to yard",
  yard_out: "Called from yard",
  dock_in: "Docked",
  handling_start: "Handling started",
  handling_end: "Handling finished",
  dock_out: "Left dock",
  gate_out: "Gate out",
  exception: "Exception",
};

export const EXCEPTION_LABEL: Record<string, string> = {
  wrong_truck_plate: "Wrong truck plate",
  documents_missing: "Documents missing",
  damaged_seal: "Damaged seal",
  driver_mismatch: "Driver does not match",
  other: "Other",
};

export const DIRECTION_LABEL = { inbound: "Inbound", outbound: "Outbound" } as const;
export const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as const;
