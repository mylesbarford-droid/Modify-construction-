# MODIFY Construction Management

A mobile-responsive construction management dashboard preview.

## Cloudflare deployment

- Worker entry point: `src/index.js`
- Static website: `public/index.html`
- Deploy: `npx wrangler deploy`

## Authentication foundation (not yet connected to the dashboard)

This branch adds the server-side foundation for a shared company sign-in followed by an individual six-digit staff PIN. The Worker verifies PINs using PBKDF2, stores only hashed session tokens, issues secure HTTP-only cookies, expires sessions after 12 hours, rate-limits sign-in attempts, and records sign-in events. Role permissions are enforced in the Worker API, not in browser JavaScript.

Roles:
- `administrator`: full access
- `office_manager`: jobs, money, documents, suppliers, workforce and user-list visibility
- `site_manager`: jobs, workforce, plant, vehicles, safety and document reading
- `employee`: assigned jobs, timesheets and daily reports

### Required Cloudflare setup

1. Create a Cloudflare D1 database and apply `migrations/0001_auth.sql`, `migrations/0002_job_updates.sql`, then `migrations/0003_jobs.sql`.
2. Add a D1 binding named `DB` to the Worker, pointing to that database.
3. Create a **private** Cloudflare R2 bucket for job photos and bind it to the Worker as `JOB_PHOTOS`. Do not enable public bucket access.
4. Add Worker secrets named `COMPANY_LOGIN_PASSWORD` and `BOOTSTRAP_KEY`. Use different, long random values.
5. Deploy only to a non-production test environment first.
6. Create the first administrator by sending a POST to `/api/setup/first-admin` with header `x-bootstrap-key: <BOOTSTRAP_KEY>` and JSON body `{"name":"Administrator name","staffCode":"ADMIN","pin":"choose-a-unique-six-digit-pin"}`.
7. Immediately remove the `BOOTSTRAP_KEY` secret from the Worker after setup.

### Shared job-update API (backend foundation)

The Worker now includes role-checked endpoints for listing and creating job updates, manager approval/rejection, and private photo upload/retrieval through the `JOB_PHOTOS` R2 binding. Employees are restricted to jobs present in `job_assignments`; managers have review permission. Each decision and photo upload is written to the audit log. Apply `migrations/0002_job_updates.sql` before using these endpoints.

**Still not ready for production:** the dashboard has not yet been connected to the login or these APIs. The current Job Updates screen still uses browser-local records and IndexedDB photos, and the employee-to-job assignment and staff administration screens are not implemented. The R2 binding and D1 database must be configured in the actual Cloudflare account. Automated and browser end-to-end tests have not been run. Do not deploy this branch to the live site or enter real company information until those items are completed.

The initial administrator is created once only. Further staff provisioning and role management still need a secured administrator workflow.

## Important production limitation

**This is not yet a production-ready shared company system.** The existing dashboard still reads and writes its demonstration records in browser `localStorage`; this branch does not migrate those records into D1 or connect the dashboard screens to these authenticated APIs. Do not enter real company records or rely on these role permissions to protect the existing dashboard until that integration, private file storage, backups, and end-to-end tests are completed.

The original preview used browser-local storage, which is not shared between staff or devices.


## Central Jobs & Sites register (new integration work)

The shared app now uses D1 as the source of truth for the Jobs & Sites register:
- `GET /api/jobs` lists all jobs for managers and only assigned jobs for employees.
- `POST /api/jobs` creates a centrally stored job (manager permissions required).
- `GET /api/jobs/:jobNumber` returns the job, its site diary history and assigned staff.
- `PATCH /api/jobs/:jobNumber` updates job details (manager permissions required).
- Job updates must reference a job already in the central register.
- The Jobs & Sites screen has a one-time import action for old job records found in that browser local storage. Existing job numbers are not overwritten.

**Migration required:** apply `migrations/0003_jobs.sql` to the configured D1 database before deploying this version. This migration has not been applied to the live Cloudflare database from this workspace. Materials, documents, money, workforce and photo attachments are not yet fully migrated into central storage; do not treat this as complete production integration.
