# MODIFY Construction Management

A mobile-responsive construction management dashboard with a shared sign-in and central job register.

## Sign in

The current requested sign-in is the shared word `Modify`. There are no individual staff PINs or passwords in this mode. The first successful sign-in creates a shared MODIFY Team account with administrator permissions.

**Important access limitation:** anyone who knows or discovers the shared word receives administrator-level access to all app functions. This is convenience access, not individual staff authentication. Do not use it for confidential or sensitive company records unless the company accepts that risk. There is no way to identify which individual made a change from this shared account.

## Install MODIFY as an app

The dashboard includes Progressive Web App (PWA) support:
- Open the deployed HTTPS website in a supported browser and choose **Install MODIFY app** (or the browser's Install app option).
- On iPhone/iPad, open the website in Safari, tap Share, then choose **Add to Home Screen**.
- The app shell can open offline if it was previously loaded, but company sign-in, shared records, updates and photo uploads still require an internet connection.
- The service worker deliberately does not cache API responses, authentication or private company records.

## Current implementation

This branch includes:
- Shared `Modify` access word as requested; first sign-in creates the shared administrator account.
- Server-side sessions, rate limiting and audit logging (audit entries identify the shared account, not an individual worker).
- D1-backed job updates with manager review controls.
- A D1-backed Jobs & Sites register, job detail view and job-specific site diary history.
- Shared D1-backed operational register records.
- A one-time import action for legacy Jobs & Sites records held in the browser's local storage.
- Automated Node syntax, static contract and Wrangler dry-run checks in GitHub Actions.

## Cloudflare configuration

The Worker uses `src/index.js` and serves the dashboard from `public/`.

For Cloudflare Workers Builds:
- Build command: leave blank (no build step is required).
- Deploy command: `npx wrangler deploy`.
- D1 binding: named `DB`, pointing to the company database in `wrangler.jsonc`.

Apply migrations in order on a new database:
1. `migrations/0001_auth.sql`
2. `migrations/0002_job_updates.sql`
3. `migrations/0003_jobs.sql`
4. `migrations/0004_shared_modules.sql`

If migrations 0001 and 0002 have already been applied to the production database, apply only 0003 and 0004. Do not apply them again unnecessarily. Confirm the migration history before running commands.

## Photo storage

Private photo uploads require a private Cloudflare R2 bucket bound to the Worker as `JOB_PHOTOS`. Without that binding, the app and database-backed registers can still run, but site photo uploads will report that private photo storage is not configured. Existing attachments in older browser-local registers are not migrated to shared file storage.

## Remaining limitations — not yet production-verified

- The latest feature branch has passed GitHub automated checks, but it has not been deployed to Cloudflare or tested end-to-end in a real browser against the production D1 database.
- Migrations 0003 and 0004 must be applied to the live D1 database before central Jobs & Sites and shared operational registers can run.
- R2 photo storage is not configured; photo uploads are unavailable until the optional bucket and binding are added.
- Legacy job import must be run from a browser that still has the old local records.
- Automated checks are not a substitute for live browser testing.

Do not enter real company information or rely on this as the production system until the database migrations, deployment, access model and end-to-end checks are completed.
