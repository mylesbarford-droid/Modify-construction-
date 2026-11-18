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

1. Create a Cloudflare D1 database, then apply `migrations/0001_auth.sql`.
2. Add a D1 binding named `DB` to the Worker, pointing to that database.
3. Add Worker secrets named `COMPANY_LOGIN_PASSWORD` and `BOOTSTRAP_KEY`. Use different, long random values.
4. Deploy this branch.
5. Create the first administrator by sending a POST to `/api/setup/first-admin` with header `x-bootstrap-key: <BOOTSTRAP_KEY>` and JSON body `{"name":"Administrator name","staffCode":"ADMIN","pin":"123456"}`. Choose a unique PIN; do not use the example PIN.
6. Immediately remove the `BOOTSTRAP_KEY` secret from the Worker after setup.

The initial administrator is created once only. Further staff provisioning and role management still need a secured administrator workflow.

## Important production limitation

**This is not yet a production-ready shared company system.** The existing dashboard still reads and writes its demonstration records in browser `localStorage`; this branch does not migrate those records into D1 or connect the dashboard screens to these authenticated APIs. Do not enter real company records or rely on these role permissions to protect the existing dashboard until that integration, private file storage, backups, and end-to-end tests are completed.

The original preview used browser-local storage, which is not shared between staff or devices.
