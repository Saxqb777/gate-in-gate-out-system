# FoahGate

Dock appointment and gate management for Agthia Group, Al Foah warehouse, Al Ain.

Customers (Agthia business units) raise shipment requests, carriers book a dock slot and receive a QR gate pass, security verifies every truck at the gate, and the warehouse runs the live dock and yard boards. Every state change is written to an audit log.

## Stack

- Next.js 15 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui style components
- Postgres on Neon, Drizzle ORM with SQL migrations
- Cookie plus JWT session auth with pre seeded users, no third party provider
- QR codes generated server side, gate pass PDF via @react-pdf/renderer
- Deployed on Vercel, a daily cron marks no shows

## Roles and demo logins

One login page. Pick the role, then sign in. The role must match the account. Password for every seeded user is `Foah@2026`.

| Email | Role | Organisation |
| --- | --- | --- |
| admin@agthia.ae | Admin | Agthia warehouse |
| warehouse@agthia.ae | Admin | Agthia warehouse (lands on the dock board) |
| security@agthia.ae | Security | Gate House 1 |
| ops@alwafi-transport.ae | Carrier | Al Wafi Transport LLC |
| ops@emirates-haulage.ae | Carrier | Emirates Haulage |
| planner@alfoah.ae | Customer | Al Foah Dates |
| planner@grandmills.ae | Customer | Grand Mills |

## What each role can do

- Admin: overview, live dock board, yard board, slot planner (block and unblock slots), all bookings and shipments, approve or reject (when approval mode is on), move a booking to another slot with a reason, clear exceptions, reports, audit log, and setup pages for docks, organisations, users, cargo types, custom fields and configuration.
- Customer: raise shipment requests, assign a carrier (sends a booking link), track every shipment end to end, cancel before arrival. Cannot see other customers.
- Carrier: sees shipments assigned to it, fills truck and driver details, picks a slot from the availability grid, receives a QR gate pass (web, mobile page and PDF), reprints passes, cancels before the cutoff.
- Security: phone or tablet screen. Scan the QR with the camera or type the reference, see the GRANTED or CHECK card, then Gate in, Send to yard, Call to dock, Gate out, or Flag exception. Lists of trucks inside and expected today.

## The slot and dock engine

- Slots are generated from configuration: operating hours, slot length, buffer between slots, operating days. Defaults 06:00 to 22:00, 60 minute slots, 15 minute buffer. Change them on the Configuration page and open future slots regenerate.
- A slot is offered only when the dock type matches the shipment direction, the dock is active, every slot covered by the cargo handling duration is open, the site wide concurrent truck cap is not reached and the minimum lead time is respected.
- Double booking is prevented at the database: a Postgres exclusion constraint on `bookings (dock_id, tstzrange(slot_start, slot_end))` for active statuses, plus row locks and a conditional update on the slot rows inside one transaction. Two carriers clicking the same slot at the same second cannot both succeed. `npm run test:engine` proves it.
- Early arrival override (the client rule): when security gates in a truck before its slot, the engine looks for a compatible dock that is free right now for the full handling duration. If one is free the truck goes straight to it (ARRIVED then AT_DOCK, audit action `EARLY_ARRIVAL_PROMOTED`). If the only free dock is held by a later booking, mode `bump` pushes that booking to the next available compatible slot, marks it `RESCHEDULED_BY_SYSTEM`, writes the audit entry and shows a highlighted notice on the carrier and customer dashboards until they acknowledge it. If nothing is free the truck goes to the yard queue with a position. Modes `bump`, `strict` and `off` are configurable.
- Reference numbers: shipments `ALF-INB-2026-00142`, gate passes `GP-2026-00142`. The QR carries an opaque random token, never the sequential number.

## Adding what the client asks for

- Configuration page: every operating rule is a key value setting, nothing is hard coded.
- Custom fields page: add text, number, date, dropdown, checkbox or document reference fields to the shipment form or the booking form. They appear immediately and print on the gate pass.
- Docks, cargo types (with handling minutes), organisations and users are all managed in the app.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate           # applies drizzle/*.sql
npm run db:seed              # resets and loads demo data (re-run any time, ideally the morning of a demo)
npm run dev
```

Other scripts: `npm run db:generate` (new migration after a schema change), `npm run test:engine` (double booking race and early arrival tests against the database in `.env`), `npm run typecheck`, `npm run lint`.

## Deploy to Vercel

1. Create a Neon project and copy the pooled connection string.
2. Import this repository into Vercel (framework Next.js, no special build settings).
3. Add these environment variables in Vercel, Production and Preview:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon connection string, keep `sslmode=require` |
   | `AUTH_SECRET` | long random string, at least 32 characters |
   | `NEXT_PUBLIC_APP_URL` | the public URL, for example `https://foahgate.vercel.app` (used in QR codes and booking links) |
   | `CRON_SECRET` | random string, Vercel sends it to the hourly no show cron |
   | `SETUP_SECRET` | random string, protects the setup endpoint |
   | `SITE_TIMEZONE` | `Asia/Dubai` |

4. Deploy. Environment variables only apply to deployments created after they were saved, so redeploy after adding them. Then run the migrations and load the demo data once:

   ```bash
   curl -X POST https://<your-app>/api/setup -H "Authorization: Bearer <SETUP_SECRET>"
   ```

   Calling it again resets the demo data. Add `?seed=false` to run migrations only. At go live call it with `?mode=clean` to remove every demo shipment, booking, gate event, audit row and notification while keeping organisations, users, docks, cargo types, configuration and custom fields. Then change the seeded passwords from the Users page. You can also run `npm run db:migrate` and `npm run db:seed` locally with `DATABASE_URL` pointing at Neon.

5. The cron in `vercel.json` calls `/api/cron/sweep` daily at 06:00 Gulf time to mark overdue bookings as no shows (Vercel Hobby allows daily crons only; on Pro you can change it to `0 * * * *`). Admin can also run the check any time from the overview page.

## Operating procedures

`docs/foahgate-sop.html` is the printable standard operating procedure: one chapter per role, the access matrix, status meanings, the rules the system enforces and the go live checklist. Open it in a browser and print to PDF.

## Project layout

```
src/app/(login|admin|customer|carrier|security)   role areas, each with its own layout and guard
src/app/pass/[token]                               public mobile gate pass (opaque token)
src/app/api/gate-pass/[token]/pdf                  PDF download
src/app/book/[token]                               booking link sent to carriers
src/lib/engine/slots.ts                            slot generation, availability, locking, next free window
src/lib/engine/booking.ts                          create, assign, submit, cancel, approve, reject, reassign
src/lib/engine/gate.ts                             gate in with early arrival override, yard, dock, handling, gate out, exceptions, no show sweep
src/lib/actions/*                                  server actions, one file per area, all return { ok, data | error }
src/lib/db/schema.ts                               Drizzle schema, drizzle/ holds the SQL migrations
src/lib/seed                                       demo data
```
