CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Hard database guard against double booking: two active bookings can never
-- hold overlapping time ranges on the same dock, regardless of application code.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_dock_overlap"
  EXCLUDE USING gist (
    "dock_id" WITH =,
    tstzrange("slot_start", "slot_end", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING_APPROVAL','BOOKED','ARRIVED','IN_YARD','AT_DOCK','HANDLING') AND "dock_id" IS NOT NULL AND "slot_start" IS NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slots_booking_idx" ON "slots" ("booking_id");
