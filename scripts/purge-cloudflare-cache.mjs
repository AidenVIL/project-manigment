#!/usr/bin/env node

/**
 * Cloudflare Cache Purge Script
 * Automatically purges Cloudflare cache after deployment
 * Used in: npm run deploy:pi
 */

const apiToken = process.env.CLOUDFLARE_API_TOKEN || "";
const zoneId = process.env.CLOUDFLARE_ZONE_ID || "";

if (!apiToken || !zoneId) {
  console.log("ℹ️  Cloudflare cache purge skipped (env vars not configured)");
  console.log("   To enable: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID");
  process.exit(0);
}

console.log("🔄 Purging Cloudflare cache...");

fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    purge_everything: true
  })
})
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      console.log("✅ Cloudflare cache purged successfully");
      process.exit(0);
    } else {
      console.error("❌ Cloudflare purge failed:", data.errors);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Cloudflare purge error:", error.message);
    process.exit(1);
  });
