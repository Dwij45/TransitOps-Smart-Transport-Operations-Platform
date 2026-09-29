# Demo and release checklist

## Presentation path

1. Run `npm run db:migrate` and `npm run db:seed` so every role has lookup data.
2. Sign in as an administrator and open the dashboard. Confirm vehicle, trip, driver, maintenance, and expense figures match the role.
3. As a dispatcher, create a draft trip, assign an eligible vehicle and driver, dispatch it, start it, and complete it.
4. As a fleet manager, schedule maintenance, start it so the vehicle leaves dispatch, then complete it and confirm one expense appears.
5. As a financial analyst, log fuel with an odometer that does not go backwards, open Reports, and download the expense CSV.
6. As a safety officer, open a driver and record a safety event. Confirm a dispatcher cannot open Settings.
7. Upload a PDF under 1 MB on a vehicle, a licence, a maintenance order, or an expense, then download it while signed in.

## Release checklist

- Login works for an administrator, dispatcher, fleet manager, safety officer, and financial analyst.
- Dispatch, trip completion, maintenance, fuel, reports, CSV export, and uploads succeed on the happy path.
- A dispatcher cannot open Settings, Staff, or Audit. A financial analyst cannot open the fleet editor. A fleet manager cannot open the expense ledger.
- `npm test` passes.
- `npm run build` completes and the app answers `GET /api/health` with `{ "ok": true }`.
- Desktop and a narrow viewport both show the skip link on keyboard focus, and form errors use an alert.
- The presenter follows the path above without opening a page the signed-in role cannot use.
