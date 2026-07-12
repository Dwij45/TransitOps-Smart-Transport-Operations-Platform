# TransitOps database schema

TransitOps uses PostgreSQL through Drizzle ORM. Better Auth owns authentication
records; the remaining tables model a single freight operator. Monetary values
are integer minor units (paise for INR), measurements are decimal kilograms or
kilometres, and all operational timestamps use `timestamptz`.

## Schema slices

| Area | Tables |
| --- | --- |
| Authentication | `user`, `session`, `account`, `verification` |
| Fleet | `vehicle`, `vehicle_type`, `location`, `location_type` |
| Driver safety | `driver`, `driver_license`, `safety_event_type`, `driver_safety_event` |
| Dispatch | `trip` |
| Maintenance | `maintenance_order`, `maintenance_service_type`, `maintenance_line_item` |
| Finance | `expense`, `fuel_entry` |
| Platform | `app_settings`, `document`, `audit_event` |

UUIDs are internal primary keys for domain records. The application assigns
human-readable codes such as `TR000001` and `MO000001` inside the same
transaction that creates the record. Vehicle registrations, fleet numbers,
trip codes, maintenance codes, emails, and licence numbers have
case-insensitive unique indexes where appropriate.

## Authoritative state

Vehicle rows persist only `active`, `in_shop`, or `retired`. `available`,
`reserved`, and `on_trip` are derived from the vehicle lifecycle plus
`dispatched`/`in_progress` trips. Driver rows persist `on_duty`, `off_duty`, or
`suspended`; trip assignment similarly determines reservation and active-trip
display states.

Trips follow:

```text
draft -> dispatched -> in_progress -> completed
  |          |
  +----------+-> cancelled
```

Partial unique indexes prevent a vehicle or driver from appearing in more than
one dispatched or in-progress trip. Check constraints tie lifecycle states to
assignments, timestamps, odometers, and cancellation reasons.

Maintenance follows `scheduled -> in_progress -> completed`, with cancellation
available before completion. Starting work moves the vehicle to `in_shop`;
completion or cancellation returns it to `active` when no other active order
exists. Line items calculate the order total. Completing an order posts exactly
one linked maintenance expense.

## Transaction boundaries

Cross-table rules belong in server-only transaction services and must lock the
affected rows before mutation:

1. **Dispatch trip:** lock trip, vehicle, driver, and primary licence; verify the
   trip is a draft, capacity is sufficient, vehicle is active and unassigned,
   driver is on duty and unassigned, and the primary licence is verified and
   unexpired. Then set assignments and `dispatched`.
2. **Start trip:** lock trip and vehicle; confirm `dispatched`, snapshot the
   vehicle odometer, set actual start time, and move to `in_progress`.
3. **Complete trip:** lock trip and vehicle; validate the end odometer, set the
   actual end and final revenue, update the vehicle odometer, and mark completed.
4. **Start maintenance:** lock order and vehicle; verify the vehicle is active
   and has no active trip, snapshot its odometer, mark the order in progress,
   and set the vehicle to `in_shop`.
5. **Complete maintenance:** lock order and vehicle; calculate line items, create
   one linked expense, update odometer if needed, complete the order, and restore
   the vehicle to active when appropriate.
6. **Log fuel:** create the `fuel` expense and its single `fuel_entry` together;
   validate that its odometer does not precede the vehicle's earlier readings.

Database constraints remain the final concurrency guard if two requests race.

## Derived analytics

Do not persist dashboard totals. Queries calculate:

- Fleet utilization from active vehicles assigned to dispatched/in-progress trips
- Driver trip-completion rate from assigned completed versus terminal trips
- Driver safety score as `clamp(100 + rolling 12-month event points, 0, 100)`
- Actual trip distance as end odometer minus start odometer
- Operational cost from the unified expense ledger
- Vehicle ROI as `(completed trip revenue - vehicle expenses) / acquisition cost`
- Fuel efficiency from distance between ordered vehicle fuel entries and litres

Materialized views should be introduced only after production query volume
demonstrates a need.

## Security and retention

Better Auth users have exactly one of `admin`, `fleet_manager`, `dispatcher`,
`safety_officer`, or `financial_analyst`. Public signup is disabled. Permission
checks are fixed in server-side application policy; hiding UI controls is not an
authorization boundary.

Operational and financial rows are retained. Vehicles are retired, drivers and
lookup values are archived, and immutable audit events record meaningful
changes. Audit snapshots must exclude passwords, tokens, secrets, and raw file
contents. Uploaded files live in object storage; `document` retains metadata and
one validated owning record.

PostgreSQL rejects updates and deletes against `audit_event`; corrections are
new compensating events. Database ownership and application credentials should
also be separated in production so the application role cannot disable this
protection.
