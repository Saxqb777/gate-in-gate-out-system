CREATE TYPE "public"."booking_status" AS ENUM('DRAFT', 'AWAITING_TRUCK_DETAILS', 'PENDING_APPROVAL', 'BOOKED', 'ARRIVED', 'IN_YARD', 'AT_DOCK', 'HANDLING', 'COMPLETED', 'GATE_OUT', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."custom_field_applies" AS ENUM('shipment', 'booking', 'carrier', 'customer');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date', 'dropdown', 'checkbox', 'file');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."dock_status" AS ENUM('active', 'maintenance', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."dock_type" AS ENUM('inbound', 'outbound', 'both');--> statement-breakpoint
CREATE TYPE "public"."exception_type" AS ENUM('wrong_truck_plate', 'documents_missing', 'damaged_seal', 'driver_mismatch', 'other');--> statement-breakpoint
CREATE TYPE "public"."gate_event_type" AS ENUM('gate_in', 'yard_in', 'yard_out', 'dock_in', 'handling_start', 'handling_end', 'dock_out', 'gate_out', 'exception');--> statement-breakpoint
CREATE TYPE "public"."notification_level" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('customer', 'carrier', 'internal');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('DRAFT', 'AWAITING_CARRIER', 'AWAITING_TRUCK_DETAILS', 'PENDING_APPROVAL', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW', 'EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('open', 'held', 'booked', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'carrier', 'customer', 'security');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" integer,
	"actor_label" text,
	"before_json" jsonb,
	"after_json" jsonb,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" integer NOT NULL,
	"dock_id" integer,
	"slot_id" integer,
	"slot_start" timestamp with time zone,
	"slot_end" timestamp with time zone,
	"original_slot_start" timestamp with time zone,
	"original_dock_id" integer,
	"truck_plate" text,
	"trailer_plate" text,
	"driver_name" text,
	"driver_mobile" text,
	"driver_id_number" text,
	"truck_type" text,
	"capacity" text,
	"status" "booking_status" DEFAULT 'DRAFT' NOT NULL,
	"qr_token" text NOT NULL,
	"gate_pass_number" text,
	"booking_link_token" text NOT NULL,
	"rescheduled_by_system" boolean DEFAULT false NOT NULL,
	"reschedule_reason" text,
	"reschedule_acknowledged" boolean DEFAULT false NOT NULL,
	"early_arrival_promoted" boolean DEFAULT false NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"booked_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"dock_in_at" timestamp with time zone,
	"handling_start_at" timestamp with time zone,
	"handling_end_at" timestamp with time zone,
	"gate_out_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "bookings_gate_pass_number_unique" UNIQUE("gate_pass_number"),
	CONSTRAINT "bookings_booking_link_token_unique" UNIQUE("booking_link_token")
);
--> statement-breakpoint
CREATE TABLE "cargo_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"handling_minutes" integer DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cargo_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "config_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"value_type" text DEFAULT 'string' NOT NULL,
	"group" text DEFAULT 'general' NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_values_entity_type_entity_id_field_id_pk" PRIMARY KEY("entity_type","entity_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"applies_to" "custom_field_applies" NOT NULL,
	"label" text NOT NULL,
	"field_key" text NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"options_json" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"visible_to_roles" jsonb DEFAULT '["admin","carrier","customer","security"]'::jsonb NOT NULL,
	"help_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docks" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "dock_type" NOT NULL,
	"status" "dock_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gate_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"event_type" "gate_event_type" NOT NULL,
	"exception_type" "exception_type",
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_user_id" integer,
	"dock_id" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_id" integer,
	"user_id" integer,
	"role" "user_role",
	"level" "notification_level" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"entity_type" text,
	"entity_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" "org_type" NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"trade_licence" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "reference_sequences" (
	"key" text PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"direction" "direction" NOT NULL,
	"customer_org_id" integer NOT NULL,
	"carrier_org_id" integer,
	"cargo_description" text NOT NULL,
	"cargo_type_id" integer,
	"quantity" integer,
	"uom" text,
	"bl_number" text,
	"container_number" text,
	"seal_number" text,
	"po_number" text,
	"invoice_number" text,
	"expected_date" date NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"status" "shipment_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"handling_minutes" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"dock_id" integer NOT NULL,
	"slot_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "slot_status" DEFAULT 'open' NOT NULL,
	"booking_id" integer,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"organisation_id" integer NOT NULL,
	"title" text,
	"warehouse_ops_view" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yard_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"position" integer NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"reason" text,
	"called_to_dock_id" integer
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_dock_id_docks_id_fk" FOREIGN KEY ("dock_id") REFERENCES "public"."docks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_original_dock_id_docks_id_fk" FOREIGN KEY ("original_dock_id") REFERENCES "public"."docks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_settings" ADD CONSTRAINT "config_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_id_custom_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_dock_id_docks_id_fk" FOREIGN KEY ("dock_id") REFERENCES "public"."docks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_customer_org_id_organisations_id_fk" FOREIGN KEY ("customer_org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_org_id_organisations_id_fk" FOREIGN KEY ("carrier_org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cargo_type_id_cargo_types_id_fk" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_dock_id_docks_id_fk" FOREIGN KEY ("dock_id") REFERENCES "public"."docks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yard_queue" ADD CONSTRAINT "yard_queue_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yard_queue" ADD CONSTRAINT "yard_queue_called_to_dock_id_docks_id_fk" FOREIGN KEY ("called_to_dock_id") REFERENCES "public"."docks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_time_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "bookings_shipment_idx" ON "bookings" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "bookings_dock_idx" ON "bookings" USING btree ("dock_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_slot_start_idx" ON "bookings" USING btree ("slot_start");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_fields_key_unique" ON "custom_fields" USING btree ("applies_to","field_key");--> statement-breakpoint
CREATE INDEX "gate_events_booking_idx" ON "gate_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "gate_events_time_idx" ON "gate_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "notifications_role_idx" ON "notifications" USING btree ("role");--> statement-breakpoint
CREATE INDEX "shipments_customer_idx" ON "shipments" USING btree ("customer_org_id");--> statement-breakpoint
CREATE INDEX "shipments_carrier_idx" ON "shipments" USING btree ("carrier_org_id");--> statement-breakpoint
CREATE INDEX "shipments_expected_idx" ON "shipments" USING btree ("expected_date");--> statement-breakpoint
CREATE UNIQUE INDEX "slots_dock_start_unique" ON "slots" USING btree ("dock_id","starts_at");--> statement-breakpoint
CREATE INDEX "slots_date_idx" ON "slots" USING btree ("slot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "yard_queue_booking_idx" ON "yard_queue" USING btree ("booking_id");