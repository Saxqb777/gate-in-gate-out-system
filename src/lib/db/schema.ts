import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  date,
  time,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const orgTypeEnum = pgEnum("org_type", ["customer", "carrier", "internal"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "carrier", "customer", "security"]);
export const dockTypeEnum = pgEnum("dock_type", ["inbound", "outbound", "both"]);
export const dockStatusEnum = pgEnum("dock_status", ["active", "maintenance", "blocked"]);
export const slotStatusEnum = pgEnum("slot_status", ["open", "held", "booked", "blocked"]);
export const directionEnum = pgEnum("direction", ["inbound", "outbound"]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);
export const shipmentStatusEnum = pgEnum("shipment_status", [
  "DRAFT",
  "AWAITING_CARRIER",
  "AWAITING_TRUCK_DETAILS",
  "PENDING_APPROVAL",
  "BOOKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "NO_SHOW",
  "EXCEPTION",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "DRAFT",
  "AWAITING_TRUCK_DETAILS",
  "PENDING_APPROVAL",
  "BOOKED",
  "ARRIVED",
  "IN_YARD",
  "AT_DOCK",
  "HANDLING",
  "COMPLETED",
  "GATE_OUT",
  "CANCELLED",
  "NO_SHOW",
  "REJECTED",
  "EXCEPTION",
]);
export const gateEventTypeEnum = pgEnum("gate_event_type", [
  "gate_in",
  "yard_in",
  "yard_out",
  "dock_in",
  "handling_start",
  "handling_end",
  "dock_out",
  "gate_out",
  "exception",
]);
export const exceptionTypeEnum = pgEnum("exception_type", [
  "wrong_truck_plate",
  "documents_missing",
  "damaged_seal",
  "driver_mismatch",
  "other",
]);
export const customFieldAppliesEnum = pgEnum("custom_field_applies", [
  "shipment",
  "booking",
  "carrier",
  "customer",
]);
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "date",
  "dropdown",
  "checkbox",
  "file",
]);
export const notificationLevelEnum = pgEnum("notification_level", ["info", "warning", "critical"]);

// ---------------------------------------------------------------------------
// Core tables
// ---------------------------------------------------------------------------

export const organisations = pgTable("organisations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: orgTypeEnum("type").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  tradeLicence: text("trade_licence"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    organisationId: integer("organisation_id")
      .notNull()
      .references(() => organisations.id),
    title: text("title"),
    warehouseOpsView: boolean("warehouse_ops_view").notNull().default(false),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

export const docks = pgTable("docks", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: dockTypeEnum("type").notNull(),
  status: dockStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cargoTypes = pgTable("cargo_types", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  handlingMinutes: integer("handling_minutes").notNull().default(60),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const slots = pgTable(
  "slots",
  {
    id: serial("id").primaryKey(),
    dockId: integer("dock_id")
      .notNull()
      .references(() => docks.id),
    slotDate: date("slot_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: slotStatusEnum("status").notNull().default("open"),
    bookingId: integer("booking_id"),
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("slots_dock_start_unique").on(t.dockId, t.startsAt),
    index("slots_date_idx").on(t.slotDate),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    direction: directionEnum("direction").notNull(),
    customerOrgId: integer("customer_org_id")
      .notNull()
      .references(() => organisations.id),
    carrierOrgId: integer("carrier_org_id").references(() => organisations.id),
    cargoDescription: text("cargo_description").notNull(),
    cargoTypeId: integer("cargo_type_id").references(() => cargoTypes.id),
    quantity: integer("quantity"),
    uom: text("uom"),
    blNumber: text("bl_number"),
    containerNumber: text("container_number"),
    sealNumber: text("seal_number"),
    poNumber: text("po_number"),
    invoiceNumber: text("invoice_number"),
    expectedDate: date("expected_date").notNull(),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: shipmentStatusEnum("status").notNull().default("DRAFT"),
    notes: text("notes"),
    handlingMinutes: integer("handling_minutes"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shipments_customer_idx").on(t.customerOrgId),
    index("shipments_carrier_idx").on(t.carrierOrgId),
    index("shipments_expected_idx").on(t.expectedDate),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    shipmentId: integer("shipment_id")
      .notNull()
      .references(() => shipments.id),
    dockId: integer("dock_id").references(() => docks.id),
    slotId: integer("slot_id").references(() => slots.id),
    slotStart: timestamp("slot_start", { withTimezone: true }),
    slotEnd: timestamp("slot_end", { withTimezone: true }),
    originalSlotStart: timestamp("original_slot_start", { withTimezone: true }),
    originalDockId: integer("original_dock_id").references(() => docks.id),
    truckPlate: text("truck_plate"),
    trailerPlate: text("trailer_plate"),
    driverName: text("driver_name"),
    driverMobile: text("driver_mobile"),
    driverIdNumber: text("driver_id_number"),
    truckType: text("truck_type"),
    capacity: text("capacity"),
    status: bookingStatusEnum("status").notNull().default("DRAFT"),
    qrToken: text("qr_token").notNull().unique(),
    gatePassNumber: text("gate_pass_number").unique(),
    bookingLinkToken: text("booking_link_token").notNull().unique(),
    rescheduledBySystem: boolean("rescheduled_by_system").notNull().default(false),
    rescheduleReason: text("reschedule_reason"),
    rescheduleAcknowledged: boolean("reschedule_acknowledged").notNull().default(false),
    earlyArrivalPromoted: boolean("early_arrival_promoted").notNull().default(false),
    approvedBy: integer("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    bookedAt: timestamp("booked_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    dockInAt: timestamp("dock_in_at", { withTimezone: true }),
    handlingStartAt: timestamp("handling_start_at", { withTimezone: true }),
    handlingEndAt: timestamp("handling_end_at", { withTimezone: true }),
    gateOutAt: timestamp("gate_out_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_shipment_idx").on(t.shipmentId),
    index("bookings_dock_idx").on(t.dockId),
    index("bookings_status_idx").on(t.status),
    index("bookings_slot_start_idx").on(t.slotStart),
  ],
);

export const gateEvents = pgTable(
  "gate_events",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id),
    eventType: gateEventTypeEnum("event_type").notNull(),
    exceptionType: exceptionTypeEnum("exception_type"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    recordedByUserId: integer("recorded_by_user_id").references(() => users.id),
    dockId: integer("dock_id").references(() => docks.id),
    note: text("note"),
  },
  (t) => [index("gate_events_booking_idx").on(t.bookingId), index("gate_events_time_idx").on(t.occurredAt)],
);

export const yardQueue = pgTable(
  "yard_queue",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id),
    position: integer("position").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    calledAt: timestamp("called_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    reason: text("reason"),
    calledToDockId: integer("called_to_dock_id").references(() => docks.id),
  },
  (t) => [index("yard_queue_booking_idx").on(t.bookingId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    action: text("action").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id),
    actorLabel: text("actor_label"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_time_idx").on(t.occurredAt),
  ],
);

export const configSettings = pgTable("config_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  valueType: text("value_type").notNull().default("string"),
  group: text("group").notNull().default("general"),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customFields = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  appliesTo: customFieldAppliesEnum("applies_to").notNull(),
  label: text("label").notNull(),
  fieldKey: text("field_key").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  optionsJson: jsonb("options_json").$type<string[]>(),
  required: boolean("required").notNull().default(false),
  visibleToRoles: jsonb("visible_to_roles").$type<string[]>().notNull().default(["admin", "carrier", "customer", "security"]),
  helpText: text("help_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("custom_fields_key_unique").on(t.appliesTo, t.fieldKey)]);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    fieldId: integer("field_id")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),
    value: text("value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.entityType, t.entityId, t.fieldId] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    organisationId: integer("organisation_id").references(() => organisations.id),
    userId: integer("user_id").references(() => users.id),
    role: userRoleEnum("role"),
    level: notificationLevelEnum("level").notNull().default("info"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_org_idx").on(t.organisationId), index("notifications_role_idx").on(t.role)],
);

export const sequences = pgTable(
  "reference_sequences",
  {
    key: text("key").primaryKey(),
    lastValue: integer("last_value").notNull().default(0),
  },
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organisation: one(organisations, { fields: [users.organisationId], references: [organisations.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  customer: one(organisations, { fields: [shipments.customerOrgId], references: [organisations.id], relationName: "customer" }),
  carrier: one(organisations, { fields: [shipments.carrierOrgId], references: [organisations.id], relationName: "carrier" }),
  cargoType: one(cargoTypes, { fields: [shipments.cargoTypeId], references: [cargoTypes.id] }),
  bookings: many(bookings),
  creator: one(users, { fields: [shipments.createdBy], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  shipment: one(shipments, { fields: [bookings.shipmentId], references: [shipments.id] }),
  dock: one(docks, { fields: [bookings.dockId], references: [docks.id] }),
  slot: one(slots, { fields: [bookings.slotId], references: [slots.id] }),
  gateEvents: many(gateEvents),
  yardEntries: many(yardQueue),
}));

export const gateEventsRelations = relations(gateEvents, ({ one }) => ({
  booking: one(bookings, { fields: [gateEvents.bookingId], references: [bookings.id] }),
  recordedBy: one(users, { fields: [gateEvents.recordedByUserId], references: [users.id] }),
  dock: one(docks, { fields: [gateEvents.dockId], references: [docks.id] }),
}));

export const yardQueueRelations = relations(yardQueue, ({ one }) => ({
  booking: one(bookings, { fields: [yardQueue.bookingId], references: [bookings.id] }),
}));

export const slotsRelations = relations(slots, ({ one }) => ({
  dock: one(docks, { fields: [slots.dockId], references: [docks.id] }),
}));

export const docksRelations = relations(docks, ({ many }) => ({
  slots: many(slots),
  bookings: many(bookings),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorUserId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Organisation = typeof organisations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Dock = typeof docks.$inferSelect;
export type Slot = typeof slots.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type GateEvent = typeof gateEvents.$inferSelect;
export type YardQueueEntry = typeof yardQueue.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type ConfigSetting = typeof configSettings.$inferSelect;
export type CustomField = typeof customFields.$inferSelect;
export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CargoType = typeof cargoTypes.$inferSelect;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type ShipmentStatus = (typeof shipmentStatusEnum.enumValues)[number];
export type GateEventType = (typeof gateEventTypeEnum.enumValues)[number];
export type ExceptionType = (typeof exceptionTypeEnum.enumValues)[number];
export type DockType = (typeof dockTypeEnum.enumValues)[number];
