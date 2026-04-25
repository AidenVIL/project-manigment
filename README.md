# Sponsor Command Centre

A modular sponsor-management web app for an F1 team. It is designed to be:

- easy for teammates to use together
- deployable as a static site on Render
- backed by Supabase for shared company and template data
- cleanly separated into UI, business logic, storage, and deployment layers

## What It Includes

- Sponsor dashboard with fundraising progress and contribution breakdown
- Company CRM with contact details, asks, responses, and contribution tracking
- Follow-up calendar for interviews, proposals, and outreach deadlines
- HTML email template studio with token replacement
- Company website research helper with public-page scraping and optional free-tier AI suggestions
- Shared password gate for quick teammate access
- Local demo fallback so the app still runs before Supabase is connected

## Project Structure

```text
.
|-- assets/
|-- config.js
|-- index.html
|-- render.yaml
|-- scripts/
|   `-- render-build.mjs
|-- src/
|   |-- app.js
|   |-- config/
|   |-- data/
|   |-- models/
|   |-- services/
|   |-- styles/
|   |-- ui/
|   `-- utils/
`-- supabase/
    `-- schema.sql
```

## Local Preview

You can serve the site from the project root with any static server. One option with the bundled runtime used in this workspace is:

```powershell
& "C:\Users\zpu1t\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 4173
```

Then open `http://localhost:4173`.

## Supabase Setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Add your project URL and anon key in [`config.js`](./config.js) for local preview.
4. Set a shared site password in [`config.js`](./config.js).

The app uses:

- Supabase Data REST endpoints for CRUD
- anonymous row-level security policies for Mk 1 shared access

## Render Deployment

This repo includes [`render.yaml`](./render.yaml) and [`scripts/render-build.mjs`](./scripts/render-build.mjs).

Set these environment variables in Render:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` (optional)
- `PUBLIC_SITE_PASSWORD`
- `PUBLIC_TEAM_NAME`
- `PUBLIC_SEASON_LABEL`
- `PUBLIC_FUNDRAISING_TARGET`
- `PUBLIC_TEAM_SIGNATURE`
- `PUBLIC_TEAM_WEBSITE`

Render will build a static `dist/` folder and publish it.

## Easy Customisation Points

- Branding and team text: [`config.js`](./config.js)
- Seed demo data: [`src/data/mock-data.js`](./src/data/mock-data.js)
- Email token logic: [`src/services/template-service.js`](./src/services/template-service.js)
- Dashboard calculations: [`src/services/dashboard-service.js`](./src/services/dashboard-service.js)
- Supabase integration: [`src/services/supabase-service.js`](./src/services/supabase-service.js)

## Next Good Upgrades

- teammate invite flow from inside the app
- richer activity history per company
- richer company-research scoring and contact extraction
- attachment uploads for proposal decks and logos
- replacing the Mk 1 shared password gate with real role-based access control
