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

## Where to Put API Keys

### For Raspberry Pi Production

**Location**: `~/project-manigment/.env`

Create a `.env` file in the home directory of the Raspberry Pi:

```bash
cd ~/project-manigment
cp .env.example .env
nano .env  # Edit with your values
```

See [`PI_ENV_TEMPLATE.txt`](./PI_ENV_TEMPLATE.txt) for a pre-configured template.

### For Render Cloud Deployment

Set environment variables in the Render dashboard:
- Go to your service > Environment
- Add each variable from [`PI_ENV_TEMPLATE.txt`](./PI_ENV_TEMPLATE.txt)

### For Local Development

Create `.env` in project root with test values. This file is ignored by Git.

### API Key Reference

| Variable | Purpose | Where to Get | Visibility |
|----------|---------|--------------|------------|
| `GMAIL_ACCOUNT_EMAIL` | Team mailbox | Gmail | Safe to share |
| `GOOGLE_CLIENT_ID` | OAuth provider | Google Cloud Console | Safe to share |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | Google Cloud Console | **KEEP SECRET** |
| `PUBLIC_SUPABASE_URL` | Database URL | Supabase project settings | Safe (frontend) |
| `PUBLIC_SUPABASE_ANON_KEY` | Public DB access | Supabase API settings | Safe (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access | Supabase API settings | **KEEP SECRET** |
| `PUBLIC_SITE_PASSWORD` | Access gate | Your choice | Safe to share with team |
| `CLOUDFLARE_API_TOKEN` | Cache control | Cloudflare dashboard | **KEEP SECRET** |

## Raspberry Pi Deployment

### Initial Setup

Run once on the Raspberry Pi:

```bash
cd ~/project-manigment
npm install
```

### Configuration

1. Create `.env` file:
   ```bash
   cp .env.example .env
   nano .env  # Fill in your actual API keys
   ```

2. Start with PM2:
   ```bash
   pm2 start server.mjs --name morrisprints --update-env
   pm2 save
   pm2 startup
   ```

### One-Command Deployment

After making changes on your PC:

**PC Side:**
```bash
cd ~/Documents/project\ manigment
git add .
git commit -m "Your update message"
git push origin main
```

**Raspberry Pi Side:**
```bash
cd ~/project-manigment
npm run deploy:pi
```

This automatically:
1. Installs dependencies
2. Builds the frontend bundle
3. Restarts the PM2 process with updated env
4. Purges Cloudflare cache (if configured)

### Verify Deployment

After running `npm run deploy:pi`, you'll see startup diagnostics:

```
===== Sponsor Portal Startup Diagnostics =====
Port: 3000
Build version: 2026-04-27

Configuration Status:
  Supabase URL: ✓ configured
  Supabase anon key: ✓ configured
  Supabase service key: ✗ missing (optional for API-only mode)
  Gmail account: ✓ configured
  Site password: ✓ configured
  Cloudflare token: ✗ missing (optional)

Use .env file in ~/project-manigment/.env for Raspberry Pi
Or use environment variables for Render/cloud deployment
=============================================
```

### Cloudflare Cache Purge

To automatically purge cache on deploy, set these in `.env`:

```bash
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
```

Get values from:
- **API Token**: https://dash.cloudflare.com/ > My Profile > API Tokens (create token with cache purge permission)
- **Zone ID**: https://dash.cloudflare.com/ > Your domain > Overview (scroll down)

### Troubleshooting

#### Supabase connection fails

1. Check `.env` has correct keys:
   ```bash
   cat ~/project-manigment/.env | grep SUPABASE
   ```

2. Visit `https://pi.morrisprints.co.uk/` and check the Supabase status badge on login page

3. Server logs should show status on startup - check with:
   ```bash
   pm2 logs morrisprints
   ```

#### Old frontend after deploy

1. Manual Cloudflare purge:
   ```bash
   npm run purge:cloudflare
   ```

2. Or via Cloudflare dashboard: Purge Cache > Purge Everything

3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

#### PM2 process won't restart

```bash
pm2 kill
pm2 start server.mjs --name morrisprints --update-env
pm2 save
```

## Configuration Files

- [`.env.example`](./.env.example) - Template with all available variables
- [`PI_ENV_TEMPLATE.txt`](./PI_ENV_TEMPLATE.txt) - Pre-filled for Atomic F1 team Raspberry Pi
- [`server.mjs`](./server.mjs) - Loads `.env` automatically via `dotenv`

## Render Deployment

This repo includes [`render.yaml`](./render.yaml) and [`scripts/render-build.mjs`](./scripts/render-build.mjs).

Render will build a static `dist/` folder and publish it.

> When running the Node server locally or on a Raspberry Pi, `server.mjs` now serves `/config.js` dynamically from the current environment variables. That means you can update `PUBLIC_*` env vars in PM2 or your shell and restart the server without needing an additional static rebuild.


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
