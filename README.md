# MODIFY Construction Management

A mobile-responsive construction management dashboard with a shared sign-in and central job register.

## Current implementation

This branch includes:
- Shared company password plus individual staff code and six-digit PIN sign-in.
- Secure server-side sessions, role-checked API permissions, sign-in rate limiting and audit logging.
- Administrator staff creation and activation/deactivation.
- Job assignment endpoints and staff administration UI.
- Shared D1-backed job updates with manager approval/rejection.
- A D1-backed Jobs & Sites register, job detail view and job-specific site diary history.
- A one-time import action for legacy Jobs & Sites records held in the browser's local storage.
- Automated Node syntax and static contract checks in GitHub Actions.

## Cloudflare configuration required

The Worker uses `src/index.js` and serves the dashboard from `public/`.

Required bindings and secrets:
- D1 binding named `DB`, pointing to the company database.
- Worker secret `COMPANY_LOGIN_PASSWORD`.
- Worker secret `BOOTSTRAP_KEY` for first-administrator setup only.
- Private R2 bucket binding `JOB_PHOTOS` for site photo uploads.

Apply the migrations in order:
1. `migrations/0001_auth.sql`
2. `migrations/0002_job_updates.sql`
3. `migrations/0003_jobs.sql`

The first administrator is created once through `/setup.html`. The setup flow requires the `BOOTSTRAP_KEY`; remove that secret immediately after the administrator is created. Never put passwords, PINs, bootstrap keys or API tokens in source control.

## Central job register and site diary

D1 is the source of truth for Jobs & Sites:
- `GET /api/jobs` lists all jobs for managers and only assigned jobs for employees.
- `POST /api/jobs` creates a centrally stored job (manager permission required).
- `GET /api/jobs/:jobNumber` returns the job, its site diary history and assigned staff.
- `PATCH /api/jobs/:jobNumber` updates job details (manager permission required).
- Job updates must reference an existing job in the central register.
- The dashboard offers a one-time import of legacy job records from that browser's local storage. Existing job numbers are not overwritten.

## Remaining limitations — not production-ready

This is an integration milestone, not a finished production system:
- The `0003_jobs.sql` migration must be applied to the live D1 database before the central Jobs & Sites feature can run there.
- The private R2 bucket and `JOB_PHOTOS` binding are not configured; photo uploads are therefore unavailable.
- Materials, documents, money, workforce, timesheets and other dashboard modules have not all been migrated to shared D1 storage. Do not assume that every screen is shared between staff.
- Legacy job import must be run from a browser that still has the old local records.
- GitHub automated checks are not a substitute for browser end-to-end testing. A live Cloudflare deployment and end-to-end test have not been completed.

Do not enter real company information or rely on this as the production system until the remaining integrations, backups, access checks and end-to-end tests are completed.


Operational register synchronisation is being validated in CI and still requires a staging browser test before release.
