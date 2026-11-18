# MODIFY Construction Management

A mobile-responsive management dashboard preview for MODIFY Construction.

## Cloudflare deployment
This repository is configured as a Cloudflare Worker with static assets:
- Worker entry point: `src/index.js`
- Static website: `public/index.html`
- Wrangler configuration: `wrangler.jsonc`

The Cloudflare deploy command can remain `npx wrangler deploy`. No build command is required.

## Important
This first version is a front-end preview. It stores demonstration records in the current browser using localStorage. It is not yet a shared, authenticated, multi-user production system. Before using real company data, connect a secure shared database, manager authentication, private document storage, and backups.