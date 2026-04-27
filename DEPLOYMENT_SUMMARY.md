# PRODUCTION DEPLOYMENT SUMMARY
# Raspberry Pi + Cloudflare Tunnel Setup

## ✅ CHANGES MADE TO CODEBASE

### 1. **server.mjs** - Production Ready
   - ✅ Added `import dotenv from \"dotenv\"` and `dotenv.config()`
   - ✅ Automatic .env file loading for Raspberry Pi
   - ✅ Startup diagnostics showing config status
   - ✅ Dynamic `/config.js` generation from env vars
   - ✅ Cache headers: no-cache for HTML/config, long-cache for assets
   - ✅ Shows secret presence without printing values

### 2. **package.json** - Dependencies & Scripts
   - ✅ Added `dotenv` as dependency (^16.0.3)
   - ✅ New script: `\"purge:cloudflare\"`
   - ✅ New script: `\"deploy:pi\"` - one-command deployment

### 3. **.env.example** - Documentation
   - ✅ Created with ALL required environment variables
   - ✅ Organized by section (Gmail, Supabase, Stripe, etc.)
   - ✅ Clear comments explaining each variable
   - ✅ Shows where to get each value
   - ✅ Includes Atomic F1 team values (Gmail, Fundraising target, etc.)

### 4. **PI_ENV_TEMPLATE.txt** - Pre-configured for Atomic
   - ✅ Ready-to-use template with provided values
   - ✅ Atomic F1 Gmail: atomicf1team@gmail.com
   - ✅ Fundraising target: 30000
   - ✅ Site password: atomic123
   - ✅ Supabase URL & anon key pre-filled

### 5. **scripts/purge-cloudflare-cache.mjs** - Cache Clearing
   - ✅ Automatic Cloudflare cache purge on deploy
   - ✅ Uses CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID
   - ✅ Gracefully skips if env vars missing
   - ✅ Called automatically by \"deploy:pi\" script

### 6. **README.md** - Deployment Guide
   - ✅ New section: \"Where to Put API Keys\" with table
   - ✅ Raspberry Pi deployment instructions
   - ✅ One-command deployment flow
   - ✅ Startup diagnostics explanation
   - ✅ Troubleshooting guide
   - ✅ Cloudflare cache purge setup

## 🔧 WHAT YOU NEED TO DO NOW

### Step 1: On Your PC (Already Done)
```bash
# Just verify changes are ready
cd ~/Documents/project\\ manigment
git status
```

### Step 2: Push to GitHub
```bash
cd ~/Documents/project\\ manigment
git add .
git commit -m \"Productionize: dotenv, Supabase fix, cache headers, deployment scripts\"
git push origin main
```

### Step 3: On Raspberry Pi - First Time Setup
```bash
# SSH into Pi and set up
ssh pi@<your-pi-ip>
cd ~/project-manigment

# Pull latest code
git pull origin main

# Install dependencies (this installs dotenv)
npm install

# Create .env file
cp .env.example .env
nano .env
# Fill in these missing values:
#   - GOOGLE_CLIENT_ID
#   - GOOGLE_CLIENT_SECRET
#   - SUPABASE_SERVICE_ROLE_KEY (optional - for admin operations)
#   - CLOUDFLARE_API_TOKEN (optional - for cache purge)
#   - CLOUDFLARE_ZONE_ID (optional - for cache purge)

# First time: start PM2
npm run build
pm2 start server.mjs --name morrisprints --update-env
pm2 save
pm2 startup
```

### Step 4: Deploy Updates (Every Time)
```bash
# On Raspberry Pi
cd ~/project-manigment
npm run deploy:pi

# This runs:
#   1. npm install
#   2. npm run build (rebuild frontend)
#   3. pm2 restart morrisprints --update-env (reload env and restart)
#   4. npm run purge:cloudflare (clear cache)
```

## 🔑 REMAINING KEYS TO FILL IN

These are the values you still need to add to your Pi `.env` file:

```
# Google OAuth - Get from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=<YOUR_VALUE>
GOOGLE_CLIENT_SECRET=<YOUR_VALUE>

# Supabase admin operations (optional, but recommended)
# Get from Supabase project settings > API > Service role key
SUPABASE_SERVICE_ROLE_KEY=<YOUR_VALUE>

# Cloudflare cache purge (optional but recommended)
# Create token at: https://dash.cloudflare.com/ > My Profile > API Tokens
CLOUDFLARE_API_TOKEN=<YOUR_VALUE>
CLOUDFLARE_ZONE_ID=<YOUR_VALUE>
```

## ✅ WHY SUPABASE WAS BROKEN BEFORE

### Root Cause: Missing .env Loading

**Before (Broken):**
1. `server.mjs` did NOT load `.env` file
2. Only checked `process.env` which was empty
3. `getRuntimeConfigScript()` generated config with empty Supabase keys
4. Frontend loaded empty config from `/config.js`
5. Supabase connection attempts failed silently

**The Fix:**
1. Added `dotenv.config()` at server startup
2. Server now reads `.env` file from Pi
3. `getRuntimeConfigScript()` gets real keys from env
4. Frontend loads correct Supabase credentials
5. Connection test runs on login page - shows status badge

### Secondary Issues Fixed

1. **Cache Pollution**: 
   - Old `/config.js` cached by Cloudflare
   - Now uses `Cache-Control: no-cache` headers
   - Purge script clears Cloudflare cache on deploy

2. **Key Visibility**:
   - Used to hardcode secrets in static files
   - Now dynamically generated from environment
   - Startup diagnostics show what's configured without printing values

3. **Deployment Friction**:
   - Required manual PM2 reload + cache purge
   - Now: `npm run deploy:pi` does everything

## 📋 SUMMARY OF FIXED ITEMS

- [x] Supabase config completely fixed (dotenv loading)
- [x] Cloudflare cache purge automated
- [x] Cache headers fixed (no-cache for HTML/config)
- [x] API key location obvious (.env.example, README)
- [x] Real Pi values pre-filled (PI_ENV_TEMPLATE.txt)
- [x] Deployment one-command (deploy:pi script)
- [x] Startup diagnostics show config status
- [x] Troubleshooting guide in README

## 🚀 NEXT: Run on Raspberry Pi

After pushing to GitHub:

```bash
ssh pi@<your-pi-ip>
cd ~/project-manigment
git pull origin main
npm run deploy:pi
```

You should see:
```
===== Sponsor Portal Startup Diagnostics =====
Port: 3000
Build version: 2026-04-27

Configuration Status:
  Supabase URL: ✓ configured
  Supabase anon key: ✓ configured
  Supabase service key: ✗ missing (optional)
  Gmail account: ✓ configured
  Site password: ✓ configured
  Cloudflare token: ✗ missing (optional)
=============================================
```

Visit: https://pi.morrisprints.co.uk/
You should see the Supabase connection status badge on the login page!
