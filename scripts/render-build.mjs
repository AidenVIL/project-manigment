import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const distDir = resolve(rootDir, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const entry of ["index.html", "src", "assets"]) {
  cpSync(resolve(rootDir, entry), resolve(distDir, entry), { recursive: true });
}

const runtimeConfig = {
  teamName: process.env.PUBLIC_TEAM_NAME || "Atomic",
  seasonLabel: process.env.PUBLIC_SEASON_LABEL || "2026 Sponsor Programme",
  fundraisingTarget: Number(process.env.PUBLIC_FUNDRAISING_TARGET || 75000),
  teamSignature:
    process.env.PUBLIC_TEAM_SIGNATURE || "Partnerships Team | Atomic",
  teamWebsite: process.env.PUBLIC_TEAM_WEBSITE || "https://example-team-site.com",
  sitePassword: process.env.PUBLIC_SITE_PASSWORD || "changeme123",
  logoPath: process.env.PUBLIC_LOGO_PATH || "./assets/atomic-logo-green.jpeg",
  brand: {
    primary: process.env.PUBLIC_BRAND_PRIMARY || "#32ce32",
    secondary: process.env.PUBLIC_BRAND_SECONDARY || "#9bff5f",
    tertiary: process.env.PUBLIC_BRAND_TERTIARY || "#d8ffd2",
    dark: process.env.PUBLIC_BRAND_DARK || "#07110a"
  },
  supabase: {
    url: process.env.PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.PUBLIC_SUPABASE_ANON_KEY || ""
  }
};

const configScript = `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)};\n`;
writeFileSync(resolve(distDir, "config.js"), configScript, "utf8");

console.log("Static bundle created in dist/");
