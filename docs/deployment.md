# Deployment

A teammate can clone this repository, configure the environment, run the app, and deploy it using this guide.

## Setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Create a Postgres database. Locally that is `transitops` on port 5432. In production, use a Neon database and put its connection string in `DATABASE_URL`.
4. Install dependencies with `npm install`.
5. Apply migrations with `npm run db:migrate`.
6. Load lookup data with `npm run db:seed`.
7. Start the app with `npm run dev` and open the origin in `BETTER_AUTH_URL`.

## Architecture

The app is a Next.js server. Pages and server actions talk to Postgres through Drizzle. Better Auth stores users and sessions in the same database. Uploaded files stay in the bucket named by `OBJECT_STORAGE_BUCKET`, under `OBJECT_STORAGE_DIR` on disk. Money is stored as integer minor units.

## Environment

Required variables:

- `DATABASE_URL` — Postgres connection string. Use the Neon URL in production.
- `BETTER_AUTH_SECRET` — at least 32 random characters. Do not commit a real value.
- `BETTER_AUTH_URL` — the public origin, including scheme and port.
- `OBJECT_STORAGE_BUCKET` and `OBJECT_STORAGE_DIR` — private file storage.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` — outbound email. When SMTP is empty, messages are written to the server log so local development still works.
- `CRON_SECRET` — optional. When set, `GET /api/health` with header `x-cron-secret` deletes expired verification rows.

## Operations

- `npm test` runs the unit tests.
- `npm run typecheck` checks TypeScript.
- `npm run build` then `npm start` runs the production server.
- `GET /api/health` returns `{ "ok": true }` and does not include secrets.
- Point an uptime check at `/api/health`. Point a scheduled job at the same path with `x-cron-secret` when `CRON_SECRET` is set.

## Migrations

Run `npm run db:migrate` before starting a new release. Generate SQL with `npm run db:generate` only when the schema changes, and commit the generated files. Do not edit applied migration files.

## Backup

Take a Neon backup, or `pg_dump` the database, before each release. Copy the object-storage directory as well. Database backups do not include uploaded files.

## Rollback

1. Deploy the previous application build.
2. If the new migration is unsafe to keep, restore the database backup taken before `db:migrate`.
3. Restore the object-storage directory from the same backup window if files were removed.
4. Confirm `/api/health` returns ok and a staff member can sign in.

## Troubleshooting

- Sign-in fails with a network error when `BETTER_AUTH_URL` does not match the browser origin.
- Uploads fail when `OBJECT_STORAGE_BUCKET` or `OBJECT_STORAGE_DIR` is missing.
- Email stays in the server log until SMTP variables are set.
- A unique-constraint error on a live trip or driver means that assignment is already in progress. The form shows a conflict message.
