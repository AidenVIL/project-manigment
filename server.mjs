import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";

// Load .env file for Raspberry Pi and local development
dotenv.config();

const distDir = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT || 3000);
const buildVersion = new Date().toISOString().split("T")[0];

// Startup diagnostics
function logStartupDiagnostics() {
  console.log("");
  console.log("===== Sponsor Portal Startup Diagnostics =====");
  console.log(`Port: ${port}`);
  console.log(`Build version: ${buildVersion}`);
  console.log("");
  console.log("Configuration Status:");
  
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log(`  Supabase URL: ${supabaseUrl ? "✓ configured" : "✗ missing"}`);
  console.log(`  Supabase anon key: ${supabaseAnonKey ? "✓ configured" : "✗ missing"}`);
  console.log(`  Supabase service key: ${supabaseServiceKey ? "✓ configured" : "✗ missing (optional for API-only mode)"}`);
  console.log(`  Gmail account: ${process.env.GMAIL_ACCOUNT_EMAIL ? "✓ configured" : "✗ missing"}`);
  console.log(`  Site password: ${process.env.PUBLIC_SITE_PASSWORD ? "✓ configured" : "✗ missing"}`);
  console.log(`  Cloudflare token: ${process.env.CLOUDFLARE_API_TOKEN ? "✓ configured" : "✗ missing (optional)"}`);
  console.log("");
  console.log("Use .env file in ~/project-manigment/.env for Raspberry Pi");
  console.log("Or use environment variables for Render/cloud deployment");
  console.log("=============================================");
  console.log("");
}

logStartupDiagnostics();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send"
];

const runtimeSecrets = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  allowedEmail: (process.env.GMAIL_ACCOUNT_EMAIL || "").trim().toLowerCase(),
  geminiApiKey: (process.env.GEMINI_API_KEY || "").trim(),
  geminiModel: (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim()
};

const persistentDir = resolve(
  process.env.PERSISTENT_DATA_DIR || process.env.RENDER_DISK_PATH || process.cwd(),
  ".atomic-runtime"
);
const gmailTokenPath = resolve(persistentDir, "gmail-token.json");
mkdirSync(persistentDir, { recursive: true });

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
}

function createCookie(name, value, request, options = {}) {
  const parts = [`${name}=${value}`];
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  } else {
    parts.push("SameSite=Lax");
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  } else {
    parts.push("Path=/");
  }
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const isSecure = options.secure ?? (forwardedProto === "https");
  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function parseCookies(request) {
  const raw = request.headers.cookie || "";
  return raw.split(/;\s*/).filter(Boolean).reduce((cookies, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) {
      return cookies;
    }
    const key = pair.slice(0, index);
    const value = pair.slice(index + 1);
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendRedirect(response, location, extraHeaders = {}) {
  response.writeHead(302, {
    Location: location,
    ...extraHeaders
  });
  response.end();
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function sendFile(response, filePath, cacheStrategy = "default") {
  const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  const headers = { "Content-Type": contentType };

  if (cacheStrategy === "no-cache") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  } else if (cacheStrategy === "short") {
    headers["Cache-Control"] = "public, max-age=3600";
  } else {
    // Default: long cache for hashed assets
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }

  response.writeHead(200, headers);
  createReadStream(filePath).pipe(response);
}

function getRuntimeConfigScript() {
  const runtimeConfig = {
    teamName: process.env.PUBLIC_TEAM_NAME || "Atomic",
    seasonLabel: process.env.PUBLIC_SEASON_LABEL || "2026 Sponsor Programme",
    fundraisingTarget: Number(process.env.PUBLIC_FUNDRAISING_TARGET || 75000),
    teamSignature: process.env.PUBLIC_TEAM_SIGNATURE || "Partnerships Team | Atomic",
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

  return `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)};\n`;
}

async function resolveRequestPath(urlPathname) {
  const safePath = normalize(decodeURIComponent(urlPathname)).replace(/^(\.\.[/\\])+/, "");
  let targetPath = join(distDir, safePath);

  if (safePath === "/" || safePath === ".") {
    return join(distDir, "index.html");
  }

  try {
    const fileStat = await stat(targetPath);
    if (fileStat.isDirectory()) {
      const nestedIndex = join(targetPath, "index.html");
      if (existsSync(nestedIndex)) {
        return nestedIndex;
      }
    } else {
      return targetPath;
    }
  } catch {
    // Fall back to SPA entrypoint below.
  }

  return join(distDir, "index.html");
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function readStoredToken() {
  if (!existsSync(gmailTokenPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(gmailTokenPath, "utf8"));
  } catch {
    return null;
  }
}

function writeStoredToken(token) {
  writeFileSync(gmailTokenPath, JSON.stringify(token, null, 2), "utf8");
}

function clearStoredToken() {
  if (existsSync(gmailTokenPath)) {
    rmSync(gmailTokenPath, { force: true });
  }
}

function requireGoogleConfig() {
  if (!runtimeSecrets.clientId || !runtimeSecrets.clientSecret || !runtimeSecrets.redirectUri) {
    throw new Error(
      "Missing Google OAuth settings. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    code,
    client_id: runtimeSecrets.clientId,
    client_secret: runtimeSecrets.clientSecret,
    redirect_uri: runtimeSecrets.redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const token = await response.json();
  return {
    ...token,
    expires_at: Date.now() + Number(token.expires_in || 3600) * 1000
  };
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: runtimeSecrets.clientId,
    client_secret: runtimeSecrets.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const token = await response.json();
  return {
    ...token,
    expires_at: Date.now() + Number(token.expires_in || 3600) * 1000
  };
}

async function getValidGmailToken() {
  const stored = readStoredToken();
  if (!stored) {
    return null;
  }

  const expiresSoon = !stored.expires_at || stored.expires_at < Date.now() + 60_000;
  if (!expiresSoon && stored.access_token) {
    return stored;
  }

  if (!stored.refresh_token) {
    return stored.access_token ? stored : null;
  }

  const refreshed = await refreshAccessToken(stored.refresh_token);
  const nextToken = {
    ...stored,
    ...refreshed,
    refresh_token: stored.refresh_token
  };
  writeStoredToken(nextToken);
  return nextToken;
}

async function gmailRequest(path, options = {}) {
  const token = await getValidGmailToken();
  if (!token?.access_token) {
    throw new Error("Gmail is not connected.");
  }

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {})
    },
    body: options.body
  });

  if (response.status === 401 && token.refresh_token) {
    const refreshed = await refreshAccessToken(token.refresh_token);
    const nextToken = {
      ...token,
      ...refreshed,
      refresh_token: token.refresh_token
    };
    writeStoredToken(nextToken);
    return gmailRequest(path, options);
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function decodeBase64Url(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function normalizeWebsiteUrl(input = "") {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("Add a company website first.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

function normalizeSearchResultUrl(rawUrl = "") {
  if (!rawUrl) {
    return "";
  }

  try {
    const direct = new URL(decodeHtmlEntities(rawUrl));
    if (direct.hostname.includes("duckduckgo.com")) {
      const redirected = direct.searchParams.get("uddg");
      if (redirected) {
        return new URL(decodeURIComponent(redirected)).toString();
      }
    }
    if (direct.hostname.includes("bing.com")) {
      const encodedTarget = direct.searchParams.get("u");
      if (encodedTarget) {
        const normalizedTarget = encodedTarget.startsWith("a1") ? encodedTarget.slice(2) : encodedTarget;
        try {
          const decodedTarget = Buffer.from(
            normalizedTarget.replace(/-/g, "+").replace(/_/g, "/"),
            "base64"
          ).toString("utf8");
          if (/^https?:\/\//i.test(decodedTarget)) {
            return new URL(decodedTarget).toString();
          }
        } catch {
          // Fall back to direct parsing below.
        }
      }
    }
    return direct.toString();
  } catch {
    try {
      const prefixed = new URL(decodeHtmlEntities(rawUrl), "https://duckduckgo.com");
      const redirected = prefixed.searchParams.get("uddg");
      if (redirected) {
        return new URL(decodeURIComponent(redirected)).toString();
      }
      return prefixed.toString();
    } catch {
      return "";
    }
  }
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(text = "") {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeWhitespace(text = "") {
  return decodeHtmlEntities(String(text || "").replace(/\s+/g, " ")).trim();
}

function extractTitle(html = "") {
  return normalizeWhitespace(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function extractMetaDescription(html = "") {
  return normalizeWhitespace(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i)?.[1] ||
      ""
  );
}

function textSnippet(text = "", maxLength = 2200) {
  return normalizeWhitespace(text).slice(0, maxLength);
}

function normalizeEmailCandidate(email = "") {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/i, "")
    .replace(/[),;:]+$/g, "")
    .replace(/^["'<\[]+|[>"'\]]+$/g, "");
}

function extractObfuscatedEmailCandidates(text = "") {
  const source = String(text || "");
  if (!source.trim()) {
    return [];
  }

  const normalized = source
    .replace(/\u00a0/g, " ")
    .replace(/\s*(?:\[|\()?\s*at\s*(?:\]|\))?\s*/gi, "@")
    .replace(/\s*(?:\[|\()?\s*dot\s*(?:\]|\))?\s*/gi, ".")
    .replace(/\s*\{\s*at\s*\}\s*/gi, "@")
    .replace(/\s*\{\s*dot\s*\}\s*/gi, ".")
    .replace(/\s+@\s+/g, "@")
    .replace(/\s+\.\s+/g, ".");

  return [...normalized.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
}

function isLikelyPlaceholderEmail(email = "") {
  const placeholderDomains = [
    "example.com",
    "domain.com",
    "email.com",
    "yourdomain.com",
    "company.com",
    "website.com",
    "test.com"
  ];
  const placeholderLocalParts = [
    "user",
    "name",
    "email",
    "example",
    "test",
    "yourname",
    "username",
    "firstname",
    "lastname",
    "first.last",
    "first_last"
  ];
  const [localPart = "", domain = ""] = String(email || "").split("@");
  if (!localPart || !domain) {
    return true;
  }

  if (placeholderDomains.includes(domain) || placeholderLocalParts.includes(localPart)) {
    return true;
  }

  if (/^(user|name|email|firstname|lastname|test)[._-]?(name|email|domain|lastname)?$/i.test(localPart)) {
    return true;
  }

  if (/^(your|my|sample|demo|placeholder)/i.test(localPart)) {
    return true;
  }

  return false;
}

function extractEmails(text = "", pageUrl = "") {
  const rawText = String(text || "");
  const directMatches = [...rawText.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
  const obfuscatedMatches = extractObfuscatedEmailCandidates(rawText);
  const mailtoMatches = [...rawText.matchAll(/mailto:([^"'?\s>]+)/gi)].map((match) => match[1]);
  const seen = new Set();
  return [...directMatches, ...obfuscatedMatches, ...mailtoMatches]
    .map((entry) => normalizeEmailCandidate(entry))
    .filter((email) => {
      if (!email || seen.has(email)) {
        return false;
      }
      seen.add(email);

      const [localPart = "", domain = ""] = email.split("@");
      if (!localPart || !domain) {
        return false;
      }

      if (email.endsWith(".png") || email.endsWith(".jpg") || email.endsWith(".jpeg") || email.endsWith(".webp")) {
        return false;
      }

      if (localPart.length < 2) {
        return false;
      }

      if (
        /\.(local|internal|invalid|example|placeholder)$/i.test(domain) ||
        /(?:^|\.)layer\.push$/i.test(domain)
      ) {
        return false;
      }

      if (
        /(fp[-_.]?integer|hero|width|height|sprite|pixel|placeholder|noreply[-_.]?asset|cdn)/i.test(localPart) ||
        /(social-media-hero|sprite|placeholder|cdn|assets?|fonts?)/i.test(domain)
      ) {
        return false;
      }

      if (/^(?:[a-z]\d*|tmp|test|debug)$/i.test(localPart)) {
        return false;
      }

      if (isLikelyPlaceholderEmail(email)) {
        return false;
      }

      if (/\.(css|js|svg|gif)$/i.test(domain)) {
        return false;
      }

      return true;
    })
    .map((email) => ({ email, source: pageUrl }));
}

function extractPhones(text = "", pageUrl = "") {
  const matches = [...String(text || "").matchAll(/(?:\+\d{1,3}\s?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/g)];
  const seen = new Set();
  return matches
    .map((match) => normalizeWhitespace(match[0]))
    .filter((phone) => phone.replace(/\D/g, "").length >= 9)
    .filter((phone) => {
      if (seen.has(phone)) {
        return false;
      }
      seen.add(phone);
      return true;
    })
    .map((phone) => ({ phone, source: pageUrl }));
}

function extractLinks(html = "", baseUrl = "") {
  const links = [];
  const seen = new Set();
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const label = normalizeWhitespace(stripHtml(match[2]));

    try {
      const url = new URL(href, baseUrl);
      if (!/^https?:$/i.test(url.protocol)) {
        continue;
      }

      const key = url.toString();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      links.push({ url: key, label });
    } catch {
      // Ignore malformed links.
    }
  }

  return links;
}

function extractContactCandidates(text = "", pageUrl = "") {
  const candidates = [];
  const seen = new Set();
  const roleKeywords =
    /(head|director|manager|lead|executive|coordinator|officer|founder|owner|commercial|marketing|partnerships|business development|president|chief)/i;
  const patterns = [
    /\b([A-Z][a-z]+ [A-Z][a-z]+)\s*[,|-]\s*((?:Head|Director|Manager|Lead|Executive|Coordinator|Officer|Founder|Owner|Commercial|Marketing|Partnerships|Business Development)[^.\n,]{0,60})/g,
    /\b((?:Head|Director|Manager|Lead|Executive|Coordinator|Officer|Founder|Owner|Commercial|Marketing|Partnerships|Business Development)[^:\n]{0,50})[:\-]\s*([A-Z][a-z]+ [A-Z][a-z]+)/g
  ];

  const segments = String(text || "")
    .split(/[\n\r]+|(?<=[.?!])\s+|[|•]+/)
    .map((segment) => normalizeWhitespace(segment))
    .filter((segment) => segment.length >= 8 && segment.length <= 180);

  for (const segment of segments) {
    for (const pattern of patterns) {
      for (const match of segment.matchAll(pattern)) {
        const name = normalizeWhitespace(pattern === patterns[0] ? match[1] : match[2]);
        const role = normalizeWhitespace(pattern === patterns[0] ? match[2] : match[1]);
        const nameLooksValid = /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/.test(name);
        const roleLooksValid = roleKeywords.test(role);
        if (!nameLooksValid || !roleLooksValid || roleKeywords.test(name)) {
          continue;
        }

        if (/[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+/.test(role)) {
          continue;
        }

        const key = `${name}|${role}`;
        if (!name || seen.has(key)) {
          continue;
        }

        seen.add(key);
        candidates.push({
          name,
          role,
          source: pageUrl
        });
      }
    }
  }

  return candidates.slice(0, 8);
}

function titleCaseFromSlug(value = "") {
  return String(value || "")
    .split(/[\W_]+/)
    .filter((part) => part.length >= 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferCompanyNameFromWebsite(website = "") {
  try {
    return titleCaseFromSlug(new URL(website).hostname.replace(/^www\./i, "").split(".")[0]);
  } catch {
    return "";
  }
}

function inferCompanyNameFromSearchResult(title = "", website = "", query = "") {
  const titleSegments = normalizeWhitespace(title)
    .split(/[|\-–—]/)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const directMatch = titleSegments.find((segment) => segment.toLowerCase().includes(normalizedQuery));
  if (directMatch) {
    return directMatch;
  }

  if (titleSegments.length) {
    return titleSegments[titleSegments.length - 1];
  }

  return inferCompanyNameFromWebsite(website);
}

function guessNameFromEmail(email = "") {
  const localPart = String(email || "").split("@")[0] || "";
  if (!localPart || /^(info|hello|team|sales|support|contact|office|admin|marketing|partnerships?)$/i.test(localPart)) {
    return "";
  }

  const pieces = localPart
    .split(/[._-]+/)
    .filter((piece) => /^[a-z]{2,}$/i.test(piece) && !/^\d+$/.test(piece));

  if (pieces.length < 2 || pieces.length > 3) {
    return "";
  }

  return pieces
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase())
    .join(" ");
}

function inferEmailCandidates({ contacts = [], emails = [], website = "" } = {}) {
  if (!contacts.length) {
    return [];
  }

  let domain = "";
  try {
    const hostname = new URL(website).hostname.replace(/^www\./i, "");
    if (!/^((api|app|login|portal)\.)/i.test(hostname)) {
      domain = hostname;
    }
  } catch {
    domain = "";
  }

  if (!domain) {
    const knownDomain = emails.find((entry) => String(entry.email || "").includes("@"))?.email?.split("@")[1];
    domain = knownDomain || "";
  }

  if (!domain) {
    return [];
  }

  const confirmedPatterns = emails
    .map((entry) => {
      const guessedName = guessNameFromEmail(entry.email);
      if (!guessedName) {
        return null;
      }

      const [first = "", last = ""] = guessedName.toLowerCase().split(/\s+/);
      const localPart = String(entry.email || "").split("@")[0].toLowerCase();
      if (!first || !last) {
        return null;
      }

      if (localPart === `${first}.${last}`) return "first.last";
      if (localPart === `${first}${last}`) return "firstlast";
      if (localPart === `${first[0]}${last}`) return "flast";
      if (localPart === `${first}${last[0]}`) return "firstl";
      if (localPart === first) return "first";
      return null;
    })
    .filter(Boolean);

  const patternPriority = confirmedPatterns.length
    ? [...new Set(confirmedPatterns)]
    : ["first.last", "flast", "firstlast"];

  const inferred = [];
  const seen = new Set(emails.map((entry) => normalizeEmailCandidate(entry.email)));

  for (const contact of contacts) {
    const parts = String(contact.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.replace(/[^a-z'-]/gi, "").toLowerCase());
    const first = parts[0] || "";
    const last = parts[parts.length - 1] || "";
    if (!first || !last) {
      continue;
    }

    const candidates = patternPriority
      .map((pattern) => {
        if (pattern === "first.last") return `${first}.${last}@${domain}`;
        if (pattern === "firstlast") return `${first}${last}@${domain}`;
        if (pattern === "flast") return `${first[0]}${last}@${domain}`;
        if (pattern === "firstl") return `${first}${last[0]}@${domain}`;
        if (pattern === "first") return `${first}@${domain}`;
        return "";
      })
      .filter(Boolean);

    const chosen = candidates.find((email) => !seen.has(email) && !isLikelyPlaceholderEmail(email));
    if (!chosen) {
      continue;
    }

    seen.add(chosen);
    inferred.push({
      email: chosen,
      source: website,
      inferred: true,
      contactName: contact.name || "",
      contactRole: contact.role || "",
      patternLabel: patternPriority[0] || "first.last"
    });
  }

  return inferred.slice(0, 8);
}

function getPageAreaLabel(pages = [], sourceUrl = "") {
  if (!sourceUrl || !pages.length) {
    return "Public page";
  }

  const page = pages.find((entry) => entry.url === sourceUrl);
  if (page?.label) {
    return page.label;
  }

  try {
    const url = new URL(sourceUrl);
    return url.pathname && url.pathname !== "/" ? url.pathname.replace(/\//g, " ").trim() : url.hostname;
  } catch {
    return "Public page";
  }
}

function scoreEmailContactMatch(emailEntry, contact) {
  if (!emailEntry?.email || !contact?.name) {
    return 0;
  }

  const localPart = String(emailEntry.email).split("@")[0].toLowerCase();
  const tokens = String(contact.name)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const first = tokens[0] || "";
  const last = tokens[tokens.length - 1] || "";

  let score = 0;
  if (emailEntry.source && contact.source && emailEntry.source === contact.source) {
    score += 3;
  }
  if (first && localPart.includes(first)) {
    score += 2;
  }
  if (last && localPart.includes(last)) {
    score += 3;
  }
  if (first && last && (localPart.includes(`${first}.${last}`) || localPart.includes(`${first}${last}`))) {
    score += 4;
  }
  if (first && last && (localPart.includes(`${first[0]}${last}`) || localPart.includes(`${first}${last[0]}`))) {
    score += 3;
  }

  return score;
}

function buildEmailMatches({ contacts = [], emails = [], pages = [] }) {
  const genericPattern = /^(info|hello|team|sales|support|contact|office|admin|marketing|partnerships?)@/i;

  return emails
    .map((entry, index) => {
      const bestContact = contacts
        .map((contact) => ({
          contact,
          score: scoreEmailContactMatch(entry, contact)
        }))
        .sort((left, right) => right.score - left.score)[0];
      const guessedName = guessNameFromEmail(entry.email);
      const isGeneric = genericPattern.test(entry.email || "");

      return {
        id: `${entry.email || "email"}-${index}`,
        email: entry.email || "",
        source: entry.source || "",
        areaLabel: getPageAreaLabel(pages, entry.source),
        contactName:
          entry.contactName ||
          (bestContact?.score >= 3
            ? bestContact.contact.name
            : guessedName),
        contactRole: entry.contactRole || (bestContact?.score >= 3 ? bestContact.contact.role || "" : ""),
        matchReason:
          entry.inferred
            ? `Likely inferred from the person's name and the company domain (${entry.patternLabel || "common format"}).`
            : bestContact?.score >= 5
              ? "Matched to a named contact on the same public page."
              : bestContact?.score >= 3
                ? "Email pattern appears to match a named contact."
                : guessedName
                  ? "Name guessed from the public email format."
                  : isGeneric
                    ? "Generic public company inbox."
                    : "Public email found on the scanned page.",
        specificityScore: entry.inferred ? 1.5 : bestContact?.score || (guessedName ? 2 : isGeneric ? 0 : 1),
        inferred: Boolean(entry.inferred)
      };
    })
    .sort((left, right) => right.specificityScore - left.specificityScore)
    .slice(0, 12);
}

function looksLikeArticlePath(url = "") {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const depth = path.split("/").filter(Boolean).length;
    return depth >= 2 && /(blog|blogs|news|article|articles|insight|insights|resources|press|stories|story)/.test(path);
  } catch {
    return false;
  }
}

function looksLikeCompanyDirectoryResult(title = "", snippet = "") {
  const haystack = `${title} ${snippet}`.toLowerCase();
  return /(official site|official website|contact us|about us|our team|head office|company overview|partnerships?)/.test(
    haystack
  );
}

function buildIndustrySearchQueries(industry = "", context = "") {
  const normalizedIndustry = normalizeWhitespace(industry);
  const normalizedContext = normalizeWhitespace(context);
  return [
    `${normalizedIndustry} companies uk sponsorship`,
    `${normalizedIndustry} companies uk`,
    `${normalizedIndustry} business uk`,
    normalizedContext ? `${normalizedIndustry} ${normalizedContext} company uk` : "",
    normalizedContext ? `${normalizedIndustry} ${normalizedContext} sponsor` : "",
    normalizedContext ? `${normalizedContext} ${normalizedIndustry} official site` : ""
  ]
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);
}

function buildExternalSponsorSearchQueries(industry = "", context = "") {
  const normalizedIndustry = normalizeWhitespace(industry);
  const normalizedContext = normalizeWhitespace(context);

  return [
    `${normalizedIndustry} uk company sponsorship opportunities`,
    `${normalizedIndustry} uk corporate partnerships`,
    `${normalizedIndustry} uk sponsor us`,
    `${normalizedIndustry} uk partner with us`,
    `${normalizedIndustry} uk companies house`,
    `${normalizedIndustry} site:.co.uk sponsorship`,
    `${normalizedIndustry} site:.org.uk partnerships`,
    normalizedContext ? `${normalizedIndustry} ${normalizedContext} uk sponsor` : "",
    normalizedContext ? `${normalizedIndustry} ${normalizedContext} uk partnerships` : ""
  ]
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);
}

function buildCompanySearchQueries(companyName = "", context = "") {
  const normalizedName = normalizeWhitespace(companyName);
  const normalizedContext = normalizeWhitespace(context);
  return [
    `"${normalizedName}" official website ${normalizedContext} uk`,
    `${normalizedName} ${normalizedContext} official website`,
    `${normalizedName} ${normalizedContext} company`,
    `"${normalizedName}" ${normalizedContext}`
  ]
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);
}

function dedupeBy(items = [], keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function inferSector(combinedText = "") {
  const normalized = combinedText.toLowerCase();
  const sectorSignals = [
    { sector: "Software / Data", keywords: ["software", "saas", "analytics", "data", "cloud", "platform"] },
    { sector: "Precision Engineering", keywords: ["precision", "cnc", "machining", "tooling", "manufacturing"] },
    { sector: "Composite / Materials", keywords: ["composite", "carbon", "materials", "polymer", "laminate"] },
    { sector: "Media / Content", keywords: ["media", "video", "content", "creative", "brand"] },
    { sector: "Travel / Logistics", keywords: ["logistics", "freight", "shipping", "transport", "travel"] },
    { sector: "Education / STEM", keywords: ["education", "stem", "school", "learning", "youth"] }
  ];

  const winner = sectorSignals
    .map((entry) => ({
      sector: entry.sector,
      score: entry.keywords.filter((keyword) => normalized.includes(keyword)).length
    }))
    .sort((left, right) => right.score - left.score)[0];

  return winner?.score ? winner.sector : "";
}

function inferAskType(combinedText = "") {
  const normalized = combinedText.toLowerCase();
  const askSignals = [
    { askType: "software", keywords: ["software", "cloud", "analytics", "simulation", "digital"] },
    { askType: "machining", keywords: ["cnc", "machining", "milling", "turning", "precision"] },
    { askType: "manufacturing", keywords: ["manufacturing", "production", "factory", "fabrication"] },
    { askType: "materials", keywords: ["materials", "composite", "carbon", "polymer", "supplier"] },
    { askType: "media", keywords: ["media", "video", "marketing", "creative", "content"] },
    { askType: "travel", keywords: ["travel", "transport", "logistics", "freight", "shipping"] }
  ];

  const winner = askSignals
    .map((entry) => ({
      askType: entry.askType,
      score: entry.keywords.filter((keyword) => normalized.includes(keyword)).length
    }))
    .sort((left, right) => right.score - left.score)[0];

  return winner?.score ? winner.askType : "cash";
}

function collectSignals(combinedText = "") {
  const normalized = combinedText.toLowerCase();
  const signals = [];
  const rules = [
    ["STEM or education activity", ["stem", "education", "students", "school", "learning", "university", "college"]],
    ["Community or youth focus", ["community", "youth", "outreach", "charity", "volunteer", "mentorship"]],
    ["Innovation messaging", ["innovation", "future", "engineering", "technology", "r&d", "research", "development"]],
    ["Sustainability messaging", ["sustainability", "net zero", "carbon", "environment", "green", "eco"]],
    ["Brand or content partnership angle", ["brand", "audience", "content", "storytelling", "campaign", "marketing"]],
    ["Manufacturing capabilities", ["manufacturing", "production", "fabrication", "assembly", "cnc", "machining"]],
    ["Technical expertise", ["technical", "expertise", "specialized", "advanced", "precision", "quality"]],
    ["Partnership history", ["partnership", "collaboration", "sponsor", "support", "alliance"]]
  ];

  for (const [label, keywords] of rules) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      signals.push(label);
    }
  }

  return signals;
}

function buildHeuristicSummary({ companyName, sector, pages, signals, contacts, emails }) {
  const intro = sector
    ? `${companyName || "This company"} looks closest to the ${sector} space based on its public website copy.`
    : `${companyName || "This company"} has public website copy that suggests a general commercial partnership target.`;
  const pageNote = pages.length
    ? ` Pages scanned included ${pages
        .slice(0, 4)
        .map((page) => page.label || new URL(page.url).pathname || page.url)
        .join(", ")}.`
    : "";
  const signalNote = signals.length ? ` Useful sponsor-fit signals: ${signals.join(", ")}.` : "";
  const contactNote = contacts.length
    ? ` A likely contact is ${contacts[0].name}${contacts[0].role ? ` (${contacts[0].role})` : ""}.`
    : emails.length
      ? ` No clear named contact was found, but at least one public email address is available.`
      : " No public contact email was found in the pages scanned.";

  return `${intro}${pageNote}${signalNote}${contactNote}`.trim();
}

function buildPersonalization({ companyName, sector, signals, contacts, recommendedAskType }) {
  const intro = contacts[0]?.name
    ? `Open by addressing ${contacts[0].name}${contacts[0].role ? ` and mention their ${contacts[0].role} role` : ""}.`
    : `Open by referencing ${companyName || "the company"} directly rather than using a generic sponsorship pitch.`;
  const sectorAngle = sector
    ? ` Frame the partnership around the ${sector} angle, highlighting how Atomic's STEM Racing team can showcase real-world applications of ${sector} in building and racing high-performance vehicles.`
    : "";
  const signalAngle = signals.length
    ? ` Mention ${signals[0].toLowerCase()} if it fits your ask, because it appears in the public website copy.`
    : "";
  const askAngle = recommendedAskType && recommendedAskType !== "cash"
    ? ` Consider asking for ${recommendedAskType} sponsorship, as their business expertise in ${recommendedAskType} can directly support our race car development and STEM education goals.`
    : "";
  const stemHook = " Emphasize how sponsorship helps fund student engineers learning cutting-edge skills in design, fabrication, and competition.";

  return `${intro}${sectorAngle}${signalAngle}${askAngle}${stemHook}`.trim();
}

function buildFieldSuggestions({ sector, recommendedAskType, signals, contacts, emails }) {
  const suggestions = [];
  if (sector) {
    suggestions.push(`Sector: ${sector}`);
  }
  if (recommendedAskType) {
    suggestions.push(`Suggested ask type: ${recommendedAskType}`);
  }
  if (contacts[0]?.role) {
    suggestions.push(`Mention the ${contacts[0].role} role in the email`);
  }
  if (emails.length) {
    suggestions.push("Use the public contact email for the first draft");
  }
  if (signals[0]) {
    suggestions.push(`Reference ${signals[0].toLowerCase()} in the intro`);
  }
  return suggestions;
}

async function fetchResearchPage(url) {
  const headerProfiles = [
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Cache-Control": "no-cache"
    },
    {
      "User-Agent": "AtomicSponsorResearchBot/1.0 (+https://atomic.local)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  ];

  let lastResponse = null;
  for (const headers of headerProfiles) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
      headers
    });

    lastResponse = response;
    if (response.ok) {
      const html = await response.text();
      const finalUrl = response.url || url;
      const title = extractTitle(html);
      const description = extractMetaDescription(html);
      const text = normalizeWhitespace(stripHtml(html));

      return {
        url: finalUrl,
        title,
        description,
        text,
        html
      };
    }

    if (response.status !== 403 && response.status !== 429) {
      break;
    }
  }

  if (!lastResponse?.ok) {
    const error = new Error(`Could not load ${url} (${lastResponse?.status || "blocked"}).`);
    error.status = lastResponse?.status || 0;
    error.url = url;
    throw error;
  }
}

async function fetchBingSearchHtml(query = "") {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    throw new Error("Add a company name first.");
  }

  const response = await fetch(
    `https://www.bing.com/search?q=${encodeURIComponent(normalizedQuery)}&setlang=en-GB&cc=gb`,
    {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Could not search for ${normalizedQuery} (${response.status}).`);
  }

  return response.text();
}

async function fetchDuckDuckGoSearchHtml(query = "") {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    throw new Error("Add a company name first.");
  }

  const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(normalizedQuery)}&kl=uk-en`, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(9000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not search for ${normalizedQuery} (${response.status}).`);
  }

  return response.text();
}

function parseSearchResults(html = "") {
  const exclusions = [
    "bing.com",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "wikipedia.org",
    "glassdoor.com",
    "indeed.com",
    "zhihu.com",
    "baidu.com",
    "quora.com",
    "pinterest.com",
    "tiktok.com",
    "medium.com",
    "substack.com",
    "wordpress.com"
  ];
  const blocks = [...String(html || "").matchAll(/<li\b[^>]*class="[^"]*b_algo[^"]*"[\s\S]*?<\/li>/gi)];

  return blocks
    .map((match) => {
      const block = match[0] || "";
      const linkMatch =
        block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const normalized = normalizeSearchResultUrl(linkMatch?.[1] || "");
      if (!normalized) {
        return null;
      }

      try {
        const url = new URL(normalized);
        const hostname = url.hostname.toLowerCase();
        if (exclusions.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
          return null;
        }

        if (looksLikeArticlePath(url.toString()) && !looksLikeCompanyDirectoryResult(linkMatch?.[2] || "", snippetMatch?.[1] || "")) {
          return null;
        }

        return {
          website: url.toString(),
          title: normalizeWhitespace(stripHtml(linkMatch?.[2] || "")),
          snippet: normalizeWhitespace(stripHtml(snippetMatch?.[1] || ""))
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseDuckDuckGoSearchResults(html = "") {
  const exclusions = [
    "duckduckgo.com",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "wikipedia.org",
    "glassdoor.com",
    "indeed.com",
    "quora.com",
    "pinterest.com",
    "tiktok.com",
    "medium.com",
    "substack.com",
    "wordpress.com"
  ];
  const blocks = [...String(html || "").matchAll(/<div\b[^>]*class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi)];

  return blocks
    .map((match) => {
      const block = match[0] || "";
      const linkMatch =
        block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch =
        block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const normalized = normalizeSearchResultUrl(linkMatch?.[1] || "");
      if (!normalized) {
        return null;
      }

      try {
        const url = new URL(normalized);
        const hostname = url.hostname.toLowerCase();
        if (exclusions.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
          return null;
        }

        if (looksLikeArticlePath(url.toString()) && !looksLikeCompanyDirectoryResult(linkMatch?.[2] || "", snippetMatch?.[1] || "")) {
          return null;
        }

        return {
          website: url.toString(),
          title: normalizeWhitespace(stripHtml(linkMatch?.[2] || "")),
          snippet: normalizeWhitespace(stripHtml(snippetMatch?.[1] || ""))
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function fetchSearchResults(query = "") {
  const preferredProvider = (process.env.SEARCH_PROVIDER || "duckduckgo").trim().toLowerCase();
  const providers =
    preferredProvider === "bing"
      ? ["bing", "duckduckgo"]
      : preferredProvider === "duckduckgo"
        ? ["duckduckgo", "bing"]
        : ["duckduckgo", "bing"];

  let lastError = null;
  for (const provider of providers) {
    try {
      if (provider === "duckduckgo") {
        const html = await fetchDuckDuckGoSearchHtml(query);
        const parsed = parseDuckDuckGoSearchResults(html);
        if (parsed.length) {
          return parsed;
        }
      } else {
        const html = await fetchBingSearchHtml(query);
        const parsed = parseSearchResults(html);
        if (parsed.length) {
          return parsed;
        }
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

function tokenizeSearchTerms(value = "") {
  const stopWords = new Set(["the", "and", "for", "ltd", "limited", "company", "official"]);
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !stopWords.has(term));
}

function countMatchedTokens(tokens = [], haystack = "") {
  if (!tokens.length) {
    return 0;
  }

  return tokens.filter((token) => haystack.includes(token)).length;
}

function candidateLooksRelevant(candidate, { companyName = "", context = "", companySearchMode = "company" } = {}) {
  const companyTokens = tokenizeSearchTerms(companyName);
  const contextTokens = tokenizeSearchTerms(context);
  const haystack = `${candidate.companyName || ""} ${candidate.title || ""} ${candidate.snippet || ""} ${
    candidate.website || ""
  }`.toLowerCase();

  if (companySearchMode === "industry") {
    const industryMatches = countMatchedTokens(companyTokens, haystack);
    const contextMatches = countMatchedTokens(contextTokens, haystack);
    const looksLikeArticle =
      looksLikeArticlePath(candidate.website || "") ||
      /(blog|article|newsroom|insights?|press release|opinion|how to|guide)/i.test(haystack);
    const hasOfficialStyleSignal =
      /official|contact|about|team|company|group|services|solutions|ltd|limited|co\.uk|uk\b/.test(haystack) ||
      !looksLikeArticle;

    if (!companyTokens.length && !contextTokens.length) {
      return true;
    }

    if (industryMatches > 0 || contextMatches > 0) {
      return true;
    }

    return hasOfficialStyleSignal && !looksLikeArticle;
  }

  const companyMatches = countMatchedTokens(companyTokens, haystack);
  if (companyTokens.length === 1 && companyMatches < 1) {
    return false;
  }

  if (companyTokens.length > 1) {
    const minimum = Math.max(1, Math.ceil(companyTokens.length * 0.6));
    if (companyMatches < minimum) {
      return false;
    }
  }

  if (companySearchMode === "industry" && contextTokens.length) {
    const contextMatches = countMatchedTokens(contextTokens, haystack);
    return contextMatches > 0 || companyMatches >= Math.max(1, companyTokens.length);
  }

  return true;
}

function scoreCompanyCandidate(candidate, { companyName = "", context = "", companySearchMode = "company" } = {}) {
  const nameQuery = String(companyName || "").trim().toLowerCase();
  const contextTerms = String(context || "")
    .toLowerCase()
    .split(/[,/|]+|\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  const haystack = `${candidate.companyName || ""} ${candidate.title || ""} ${candidate.snippet || ""} ${candidate.website || ""}`.toLowerCase();

  let score = 0;
  if (nameQuery && haystack.includes(nameQuery)) {
    score += 6;
  }
  if (companySearchMode !== "industry" && candidate.companyName && candidate.companyName.toLowerCase() === nameQuery) {
    score += 4;
  }
  if (companySearchMode !== "industry" && candidate.website && candidate.website.toLowerCase().includes(nameQuery.replace(/\s+/g, ""))) {
    score += 3;
  }
  if (companySearchMode !== "industry" && candidate.title && candidate.title.toLowerCase().startsWith(nameQuery)) {
    score += 3;
  }

  if (companySearchMode === "industry") {
    const industryTokens = tokenizeSearchTerms(companyName);
    const industryMatches = countMatchedTokens(industryTokens, haystack);
    score += industryMatches * 3;
    if (/ltd|limited|group|official|contact|about us|services|solutions|co\.uk|uk\b/.test(haystack)) {
      score += 2;
    }
  }

  const contextScore = contextTerms.reduce(
    (total, term) => total + (haystack.includes(term) ? 2 : 0),
    0
  );
  score += companySearchMode === "industry" ? contextScore * 2 : contextScore;

  if (/official|home|about|contact/i.test(candidate.snippet || "")) {
    score += 1;
  }

  try {
    const url = new URL(candidate.website || "");
    const hostname = url.hostname.toLowerCase();
    const path = url.pathname || "/";
    const depth = path.split("/").filter(Boolean).length;
    if (path === "/" || depth === 0) {
      score += 6;
    } else if (depth === 1) {
      score += 1;
    }
    if (depth >= 2) {
      score -= 2;
    }

    if (/(personal|products?|services?|careers?|jobs|blog|news|docs|support|help|resources)/i.test(path)) {
      score -= 4;
    }

    if (looksLikeArticlePath(candidate.website || "")) {
      score -= 8;
    }

    if (/\.(pdf|docx?|xlsx?)$/i.test(path)) {
      score -= 8;
    }

    if (/^(api|app|login|portal)\./i.test(hostname) || /(login|signin|portal|account|card)/i.test(path)) {
      score -= 6;
    }
  } catch {
    // Ignore malformed URLs when scoring.
  }

  return score;
}

function truncateOneLine(text = "", maxLength = 150) {
  const normalized = normalizeWhitespace(text).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}…` : normalized;
}

function getSponsorFitLabel(score = 0) {
  if (score >= 28) {
    return "High sponsor fit";
  }

  if (score >= 18) {
    return "Good sponsor fit";
  }

  return "Possible sponsor fit";
}

function buildCompanyCandidateSummary(candidate, { combinedText = "", description = "" } = {}) {
  const preferred =
    truncateOneLine(description, 150) ||
    truncateOneLine(candidate.snippet || "", 150) ||
    truncateOneLine(candidate.title || "", 150);

  if (preferred) {
    return preferred;
  }

  const inferredSector = inferSector(combinedText);
  if (inferredSector) {
    return `Looks related to ${inferredSector.toLowerCase()} from the public site copy.`;
  }

  return "Public website found, but only limited company detail was visible in the first pass.";
}

async function enrichCompanyCandidateForSponsorship(candidate) {
  const baseScore = Number(candidate.score || 0);
  let score = baseScore;
  let summaryLine = truncateOneLine(candidate.snippet || candidate.title || candidate.companyName || "", 100);
  let fullSummary = "";
  let sponsorSignals = [];
  let sponsorEmail = "";

  try {
    const homePage = await fetchResearchPage(candidate.website || "");
    const scoutLinks = chooseResearchLinks(homePage).slice(0, 6);
    const extraPages = [];

    for (const link of scoutLinks) {
      try {
        const page = await fetchResearchPage(link.url);
        extraPages.push({
          ...page,
          label: link.label || page.title || new URL(page.url).pathname
        });
      } catch {
        // Ignore individual scout page misses and keep whatever public data we already have.
      }
    }

    const pages = [homePage, ...extraPages];
    const combinedText = pages
      .map((page) => `${page.title}\n${page.description}\n${textSnippet(page.text, 900)}`)
      .join("\n\n");
    const combinedLower = combinedText.toLowerCase();
    const labelHaystack = pages
      .map((page) => `${page.label || ""} ${page.title || ""} ${page.url || ""}`.toLowerCase())
      .join(" ");
    const emails = dedupeBy(
      pages.flatMap((page) => extractEmails(`${page.html}\n${page.text}`, page.url)),
      (entry) => entry.email
    );
    const likelySponsorEmail =
      emails.find((entry) =>
        /^(sponsor|sponsorship|partner|partnership|community|marketing|press|hello|info|contact)/i.test(
          String(entry.email || "").split("@")[0] || ""
        )
      ) || null;

    if (emails.length) {
      score += Math.min(6, emails.length * 2);
      sponsorSignals.push(`${emails.length} public email${emails.length === 1 ? "" : "s"} visible`);
      sponsorEmail = likelySponsorEmail?.email || emails[0]?.email || "";
    }

    if (likelySponsorEmail) {
      score += 8;
      sponsorSignals.push(`outreach-style email found: ${likelySponsorEmail.email}`);
    }

    if (
      /sponsor|sponsorship|partner with|partnership|community partners|support us|corporate support/i.test(
        combinedLower
      ) ||
      /sponsor|sponsorship|partnership|partners/.test(labelHaystack)
    ) {
      score += 8;
      sponsorSignals.push("partnership or sponsorship section found");
    }

    if (
      /contact us|get in touch|speak to our team|drop us a line/i.test(combinedLower) ||
      /\/contact\b/.test(labelHaystack)
    ) {
      score += 4;
      sponsorSignals.push("clear public contact route");
    }

    if (/stem|education|schools|students|community|youth|charity|outreach|sustainability/i.test(combinedLower)) {
      score += 3;
      sponsorSignals.push("community or education activity mentioned");
    }

    summaryLine = buildCompanyCandidateSummary(candidate, {
      combinedText,
      description: homePage.description || ""
    });
    fullSummary = truncateOneLine(
      [
        homePage.description || "",
        textSnippet(combinedText, 420),
        sponsorSignals.length ? `Signals: ${sponsorSignals.join(" | ")}.` : ""
      ]
        .filter(Boolean)
        .join(" "),
      420
    );
  } catch (error) {
    if (error?.status === 401 || error?.status === 403 || error?.status === 429) {
      score -= 2;
      sponsorSignals.push("site limited public scanning");
    }
  }

  return {
    ...candidate,
    score,
    summaryLine,
    fullSummary: fullSummary || truncateOneLine(candidate.snippet || candidate.title || "", 320),
    sponsorSignals: sponsorSignals.slice(0, 3),
    sponsorSignalsLine: truncateOneLine(sponsorSignals.slice(0, 2).join(" | "), 150),
    sponsorEmail,
    sponsorFitLabel: getSponsorFitLabel(score)
  };
}

async function rankCompanyCandidatesForIndustry(candidates = []) {
  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return await enrichCompanyCandidateForSponsorship(candidate);
      } catch {
        return {
          ...candidate,
          summaryLine: truncateOneLine(candidate.snippet || candidate.title || candidate.companyName || "", 150),
          sponsorSignals: [],
          sponsorSignalsLine: "",
          sponsorEmail: "",
          sponsorFitLabel: getSponsorFitLabel(candidate.score || 0)
        };
      }
    })
  );

  return enriched.sort((left, right) => right.score - left.score);
}

async function discoverCompanyCandidatesFromSearch({
  companyName = "",
  context = "",
  companySearchMode = "company"
} = {}) {
  const query = String(companyName || "").trim();
  if (!query) {
    throw new Error(companySearchMode === "industry" ? "Add an industry first." : "Add a company name first.");
  }

  const searchQueries = dedupeBy(
    companySearchMode === "industry" ? buildIndustrySearchQueries(query, context) : buildCompanySearchQueries(query, context),
    (entry) => entry.toLowerCase()
  );

  const collectedResults = [];
  for (const searchQuery of searchQueries) {
    try {
      collectedResults.push(...(await fetchSearchResults(searchQuery)));
    } catch {
      // Try the next query variant.
    }
  }

  let candidates = dedupeBy(
    collectedResults
      .map((result) => {
      const inferredName = inferCompanyNameFromSearchResult(result.title, result.website, companyName);
      const candidate = {
        id: crypto.randomUUID(),
        companyName: inferredName,
        website: result.website,
        title: result.title,
        snippet: result.snippet,
        areaLabel: "Search result"
      };

      return {
        ...candidate,
        score: scoreCompanyCandidate(candidate, { companyName, context, companySearchMode })
      };
    })
      .filter((candidate) => candidateLooksRelevant(candidate, { companyName, context, companySearchMode }))
      .filter((candidate) => candidate.score > 0),
    (candidate) => candidate.website
  )
    .sort((left, right) => right.score - left.score)
    .slice(0, companySearchMode === "industry" ? 14 : 8);

  if (!candidates.length) {
    throw new Error("Could not find likely company websites from that search. Try a more specific company name or context.");
  }

  if (companySearchMode === "industry") {
    candidates = await rankCompanyCandidatesForIndustry(candidates);
  }

  return candidates;
}

async function discoverExternalSponsorCandidates({ industry = "", context = "" } = {}) {
  const normalizedIndustry = String(industry || "").trim();
  if (!normalizedIndustry) {
    throw new Error("Add an industry first.");
  }

  const searchQueries = dedupeBy(
    [
      ...buildExternalSponsorSearchQueries(normalizedIndustry, context),
      ...buildIndustrySearchQueries(normalizedIndustry, context)
    ],
    (entry) => entry.toLowerCase()
  );

  const collectedResults = [];
  for (const searchQuery of searchQueries) {
    try {
      collectedResults.push(...(await fetchSearchResults(searchQuery)));
    } catch {
      // Continue searching via other query variants.
    }
  }

  let candidates = dedupeBy(
    collectedResults
      .map((result) => {
        const inferredName = inferCompanyNameFromSearchResult(result.title, result.website, normalizedIndustry);
        const candidate = {
          id: crypto.randomUUID(),
          companyName: inferredName,
          website: result.website,
          title: result.title,
          snippet: result.snippet,
          areaLabel: "External source"
        };

        return {
          ...candidate,
          score:
            scoreCompanyCandidate(candidate, {
              companyName: normalizedIndustry,
              context,
              companySearchMode: "industry"
            }) + 1
        };
      })
      .filter((candidate) =>
        candidateLooksRelevant(candidate, {
          companyName: normalizedIndustry,
          context,
          companySearchMode: "industry"
        })
      )
      .filter((candidate) => candidate.score > 0),
    (candidate) => candidate.website
  )
    .sort((left, right) => right.score - left.score)
    .slice(0, 18);

  if (!candidates.length) {
    throw new Error("No likely external sponsor matches were found for that industry.");
  }

  candidates = await rankCompanyCandidatesForIndustry(candidates);
  return candidates;
}

async function discoverCompanyWebsiteFromSearch(companyName = "", options = {}) {
  const candidates = await discoverCompanyCandidatesFromSearch({
    companyName,
    context: options.context || "",
    companySearchMode: options.companySearchMode || "company"
  });
  return candidates[0]?.website || "";
}

function chooseResearchLinks(homePage) {
  const baseUrl = homePage.url;
  const baseOrigin = new URL(baseUrl).origin;
  const pageHints = [
    "about",
    "about-us",
    "contact",
    "contact-us",
    "get-in-touch",
    "team",
    "people",
    "leadership",
    "staff",
    "our-team",
    "sponsor",
    "sponsorship",
    "partners",
    "partnership",
    "collaborate",
    "corporate",
    "support",
    "community",
    "sustainability",
    "csr",
    "responsibility",
    "education",
    "schools",
    "outreach",
    "careers",
    "news",
    "press",
    "media"
  ];

  const sameOriginLinks = extractLinks(homePage.html, baseUrl)
    .filter((link) => new URL(link.url).origin === baseOrigin)
    .map((link) => {
      const haystack = `${link.label} ${new URL(link.url).pathname}`.toLowerCase();
      const score = pageHints.reduce((total, hint) => total + (haystack.includes(hint) ? 1 : 0), 0);
      return { ...link, score };
    })
    .filter((link) => link.score > 0)
    .sort((left, right) => right.score - left.score);

  const guessedLinks = pageHints.map((hint) => {
    try {
      return { url: new URL(`/${hint}`, baseUrl).toString(), label: hint, score: 0.5 };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return dedupeBy([...sameOriginLinks, ...guessedLinks], (link) => link.url).slice(0, 10);
}

async function tryFetchResearchPages(seedUrl) {
  const warnings = [];
  const homePage = await fetchResearchPage(seedUrl).catch((error) => {
    if (error?.status === 401 || error?.status === 403 || error?.status === 429) {
      warnings.push(
        error.status === 429
          ? `The website rate-limited the finder while scanning ${seedUrl}.`
          : `The website blocked public page scanning for ${seedUrl} (${error.status}).`
      );
    }
    throw Object.assign(error, { warnings });
  });
  const extraPages = [];

  for (const link of chooseResearchLinks(homePage)) {
    try {
      const page = await fetchResearchPage(link.url);
      extraPages.push({
        ...page,
        label: link.label || page.title || new URL(page.url).pathname
      });
    } catch {
      // Skip pages that fail to load.
    }
  }

  return {
    pages: [
      {
        ...homePage,
        label: "home"
      },
      ...extraPages
    ],
    warnings
  };
}

function safeJsonParse(text = "") {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildBlockedResearchResult({
  companyName = "",
  website = "",
  searchMode = "website",
  context = "",
  companySearchMode = "company",
  warning = ""
} = {}) {
  const resolvedCompanyName =
    String(companyName || "").trim() || inferCompanyNameFromWebsite(website) || "Company";

  return {
    companyName: resolvedCompanyName,
    website,
    searchMode,
    context,
    companySearchMode,
    companyCandidates: [],
    contacts: [],
    emails: [],
    emailMatches: [],
    phones: [],
    pages: [],
    signals: [],
    sector: "",
    recommendedAskType: "",
    warnings: [warning || `The website blocked public page scanning for ${website}.`],
    summary: `We found the website, but it blocked automated public scanning. You can still save the company manually or try another public page from the same company.`,
    personalization: "Try using a generic outreach opener and fill in any named contacts manually if the site does not expose them publicly.",
    fieldSuggestions: ["Save the company manually and add any known contact details yourself."]
  };
}

async function maybeRefineWithGemini(researchDraft) {
  const useOllamaSetting = (process.env.USE_OLLAMA || "auto").toLowerCase();
  const useOllama = useOllamaSetting === "true" || useOllamaSetting === "auto";
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1:8b";

  if (!useOllama && !runtimeSecrets.geminiApiKey) {
    return null;
  }

  const prompt = {
    task: "You are an AI assistant helping the Atomic STEM Racing team personalize sponsor outreach emails. The team has an engineering and enterprise aspect with the design of a model stem racing car and the enterprise side with project management and sponsorship procurement and more. Analyze the company research data and generate highly specific, tailored advice for crafting sponsorship emails. Include: 1) How to open the email addressing key contacts, 2) Specific sponsorship asks based on the company's business (e.g., machining services for car parts, software for simulations), 3) Talking points that connect their products/services to STEM education and racing innovation, 4) How the partnership benefits both parties in the context of student engineering projects. Make suggestions concrete and actionable and give specific information about any companies being asked with context. Return JSON only.",
    required_shape: {
      summary: "string",
      sector: "string",
      recommendedAskType: "cash|materials|machining|manufacturing|software|media|travel|hybrid",
      personalization: "string",
      fieldSuggestions: ["string"]
    },
    input: researchDraft
  };

  if (useOllama) {
    try {
      const response = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: `${prompt.task}\n\nInput data:\n${JSON.stringify(prompt.input)}\n\nRespond with ONLY valid JSON matching this structure: ${JSON.stringify(prompt.required_shape)}`,
          stream: false,
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed (${response.status}).`);
      }

      const payload = await response.json();
      const text = payload.response || "";
      return safeJsonParse(text);
    } catch (error) {
      console.error("Ollama refinement failed:", error.message);
      if (!runtimeSecrets.geminiApiKey) {
        return null;
      }
    }
  }

  if (runtimeSecrets.geminiApiKey) {
    // Original Gemini flow
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        runtimeSecrets.geminiModel
      )}:generateContent?key=${encodeURIComponent(runtimeSecrets.geminiApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(prompt) }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini research request failed (${response.status}).`);
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    return safeJsonParse(text);
  }

  return null;
}


async function researchCompanyWebsite({
  companyName = "",
  website = "",
  searchMode = "website",
  context = "",
  companySearchMode = "company"
}) {
  if (searchMode === "company" && !String(website || "").trim()) {
    const companyCandidates = await discoverCompanyCandidatesFromSearch({
      companyName,
      context,
      companySearchMode
    });

    return {
      companyName,
      website: "",
      searchMode,
      context,
      companySearchMode,
      companyCandidates,
      contacts: [],
      emails: [],
      emailMatches: [],
      phones: [],
      pages: [],
      signals: [],
      sector: "",
      recommendedAskType: "",
      summary: companyCandidates.length
        ? companySearchMode === "industry"
          ? `Found ${companyCandidates.length} likely company matches, ranked by sponsorship-style public signals like contact routes, partnership pages, and visible emails.`
          : `Found ${companyCandidates.length} likely company matches. Pick one to scan its public pages for named contacts and emails.`
        : "No likely company matches were found.",
      personalization: "",
      fieldSuggestions: []
    };
  }

  const normalizedWebsite =
    String(website || "").trim()
      ? normalizeWebsiteUrl(website)
      : await discoverCompanyWebsiteFromSearch(companyName, { context, companySearchMode });
  let pageScan;
  try {
    pageScan = await tryFetchResearchPages(normalizedWebsite);
  } catch (error) {
    if (error?.status === 401 || error?.status === 403 || error?.status === 429) {
      return buildBlockedResearchResult({
        companyName,
        website: normalizedWebsite,
        searchMode,
        context,
        companySearchMode,
        warning:
          error?.warnings?.[0] ||
          `The website blocked public page scanning for ${normalizedWebsite} (${error.status}).`
      });
    }
    throw error;
  }

  const pages = pageScan.pages || [];
  const warnings = pageScan.warnings || [];
  const combinedText = pages.map((page) => `${page.title}\n${page.description}\n${textSnippet(page.text, 1600)}`).join("\n\n");
  const resolvedCompanyName =
    String(companyName || "").trim() ||
    normalizeWhitespace(pages[0]?.title?.split(/[|\-–—]/)[0]) ||
    inferCompanyNameFromWebsite(normalizedWebsite) ||
    "Company";
  const contacts = dedupeBy(
    pages.flatMap((page) => extractContactCandidates(page.text, page.url)),
    (contact) => `${contact.name}|${contact.role}`
  ).slice(0, 6);
  const publicEmails = dedupeBy(
    pages.flatMap((page) => extractEmails(`${page.html}\n${page.text}`, page.url)),
    (entry) => entry.email
  ).slice(0, 14);
  const inferredEmails = inferEmailCandidates({
    contacts,
    emails: publicEmails,
    website: normalizedWebsite
  });
  const emails = dedupeBy([...publicEmails, ...inferredEmails], (entry) => entry.email).slice(0, 18);
  const emailMatches = buildEmailMatches({ contacts, emails, pages });
  const phones = dedupeBy(
    pages.flatMap((page) => extractPhones(page.text, page.url)),
    (entry) => entry.phone
  ).slice(0, 5);
  const signals = collectSignals(combinedText);
  const sector = inferSector(combinedText);
  const recommendedAskType = inferAskType(combinedText);

  const draft = {
    companyName: resolvedCompanyName,
    website: normalizedWebsite,
    searchMode,
    context,
    companySearchMode,
    companyCandidates: [],
    pages: pages.map((page) => ({
      url: page.url,
      label: page.label || page.title || new URL(page.url).pathname,
      title: page.title,
      description: page.description
    })),
    contacts,
    emails,
    emailMatches,
    phones,
    sector,
    recommendedAskType,
    warnings,
    signals,
    summary: buildHeuristicSummary({
      companyName: resolvedCompanyName,
      sector,
      pages,
      signals,
      contacts,
      emails
    }),
    personalization: buildPersonalization({
      companyName: resolvedCompanyName,
      sector,
      signals,
      contacts,
      recommendedAskType
    }),
    fieldSuggestions: buildFieldSuggestions({
      sector,
      recommendedAskType,
      signals,
      contacts,
      emails
    })
  };

  try {
    const refined = await maybeRefineWithGemini({
      companyName: resolvedCompanyName,
      website: normalizedWebsite,
      pages: draft.pages,
      contacts,
      emails,
      phones,
      signals,
      combinedSnippet: textSnippet(combinedText, 10000)
    });

    if (refined) {
      return {
        ...draft,
        summary: refined.summary || draft.summary,
        sector: refined.sector || draft.sector,
        recommendedAskType: refined.recommendedAskType || draft.recommendedAskType,
        personalization: refined.personalization || draft.personalization,
        fieldSuggestions:
          Array.isArray(refined.fieldSuggestions) && refined.fieldSuggestions.length
            ? refined.fieldSuggestions
            : draft.fieldSuggestions
      };
    }
  } catch {
    // Fall back to heuristic research if the optional Gemini layer fails.
  }

  return draft;
}

function trimForPrompt(value = "", maxLength = 1800) {
  const text = normalizeWhitespace(String(value || ""));
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

async function runAtomicWebResearch(question = "") {
  const results = await fetchSearchResults(question);
  const topResults = dedupeBy(results, (entry) => entry.website).slice(0, 5);
  const research = [];

  for (const item of topResults.slice(0, 3)) {
    try {
      const page = await fetchResearchPage(item.website);
      research.push({
        title: item.title || page.title || item.website,
        website: item.website,
        summary: trimForPrompt(page.description || page.text || item.snippet || "", 1100),
        source: "web"
      });
    } catch {
      research.push({
        title: item.title || item.website,
        website: item.website,
        summary: trimForPrompt(item.snippet || "Public result found but page could not be fully scanned.", 600),
        source: "search"
      });
    }
  }

  return research;
}

function buildAtomicFallbackAnswer({ question = "", mode = "research", research = [], companies = [] } = {}) {
  const lines = [];
  lines.push(`### Atomic Intelligence (${mode})`);
  lines.push(`Question: ${question}`);

  if (research.length) {
    lines.push("\nTop findings:");
    for (const item of research) {
      lines.push(`- **${item.title}** - ${item.summary}`);
      lines.push(`  Source: ${item.website}`);
    }
  } else {
    lines.push("\nI could not find reliable public sources in this pass.");
  }

  if (Array.isArray(companies) && companies.length) {
    const shortlisted = companies
      .slice(0, 3)
      .map((company) => `- ${company.companyName} (${company.status || "prospect"})`)
      .join("\n");
    lines.push("\nCurrent tracked companies snapshot:");
    lines.push(shortlisted);
  }

  lines.push("\nSuggested next step: send me a company name + location + sponsor context and I will return a tighter outreach angle.");
  return lines.join("\n");
}

async function generateAtomicIntelligenceAnswer({ question = "", mode = "research", companies = [] } = {}) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) {
    throw new Error("Ask a question first.");
  }

  const research = await runAtomicWebResearch(cleanQuestion);
  const useOllamaSetting = (process.env.USE_OLLAMA || "auto").toLowerCase();
  const useOllama = useOllamaSetting === "true" || useOllamaSetting === "auto";
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1:8b";

  if (useOllama) {
    try {
      const prompt = [
        "You are Atomic Intelligence, an elite but concise sponsorship research copilot for a STEM racing team.",
        "Respond in clean markdown.",
        "Give:",
        "1) a short direct answer",
        "2) 3 practical actions",
        "3) sponsor outreach angle",
        "4) cite which source links you used",
        `Mode: ${mode}`,
        `Question: ${cleanQuestion}`,
        `Research: ${JSON.stringify(research)}`,
        `Tracked companies snapshot: ${JSON.stringify((companies || []).slice(0, 8))}`
      ].join("\n");

      const response = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (response.ok) {
        const payload = await response.json();
        const answer = String(payload.response || "").trim();
        if (answer) {
          return {
            answer,
            research
          };
        }
      }
    } catch {
      // fall through to deterministic fallback
    }
  }

  return {
    answer: buildAtomicFallbackAnswer({
      question: cleanQuestion,
      mode,
      research,
      companies
    }),
    research
  };
}

function stripMarkdownFences(value = "") {
  return String(value || "").replace(/^```[a-zA-Z]*\s*/i, "").replace(/```$/i, "").trim();
}

function buildEmailAssistFallback({
  mode = "first_outreach",
  companyName = "the company",
  contactName = "",
  instruction = ""
} = {}) {
  const namedContact = contactName ? `${contactName}` : "there";
  if (mode === "continue") {
    return {
      continuation: `I’d love to share a short, tailored plan for how this partnership could deliver clear value for ${companyName} this season.`,
      notes: "Continuation generated from your current draft context."
    };
  }

  const followUp =
    mode === "follow_up"
      ? `Hi ${namedContact},\n\nI hope you're well. I wanted to follow up on my previous message about a potential partnership with Atomic.`
      : `Hi ${namedContact},\n\nI’m reaching out from Atomic to explore a potential sponsorship partnership with ${companyName}.`;

  const body = `${followUp}\n\nWe’d love to discuss how we can align with your goals and create measurable value through our outreach, STEM engagement, and race season visibility.\n\nIf helpful, I can share a concise sponsorship options overview and suggested next steps.\n\nBest regards,\nAtomic Partnerships`;
  return {
    replacementBody: body,
    subjectSuggestion:
      mode === "follow_up"
        ? `Following up: partnership with ${companyName}`
        : `Partnership opportunity: Atomic x ${companyName}`,
    notes: instruction ? `Used your instruction: ${instruction}` : "Fallback draft generated."
  };
}

async function generateAtomicEmailAssist({
  mode = "first_outreach",
  company = {},
  contact = {},
  subject = "",
  html = "",
  plainText = "",
  instruction = ""
} = {}) {
  const companyName = String(company?.companyName || company?.name || "").trim() || "the company";
  const contactName = String(contact?.name || "").trim();
  const contactRole = String(contact?.role || "").trim();
  const contextSnippet = textSnippet(stripHtml(String(html || "")) || plainText || "", 3000);

  const useOllamaSetting = (process.env.USE_OLLAMA || "auto").toLowerCase();
  const useOllama = useOllamaSetting === "true" || useOllamaSetting === "auto";
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1:8b";

  if (useOllama) {
    try {
      const prompt = [
        "You are an elite sponsorship email writing assistant for a STEM racing team.",
        "Write practical, concise, natural UK-English outreach copy.",
        "Return STRICT JSON only with keys:",
        '{"subjectSuggestion":"", "replacementBody":"", "continuation":"", "notes":""}',
        "Rules:",
        "- If mode is continue: only fill continuation (1-2 sentences).",
        "- If mode is first_outreach or follow_up: fill replacementBody as plain text email body.",
        "- Keep tone professional, warm, and specific.",
        `Mode: ${mode}`,
        `Company: ${companyName}`,
        `Contact name: ${contactName || "unknown"}`,
        `Contact role: ${contactRole || "unknown"}`,
        `Current subject: ${subject || "none"}`,
        `User instruction: ${instruction || "none"}`,
        `Current draft context: ${contextSnippet || "none"}`
      ].join("\n");

      const response = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (response.ok) {
        const payload = await response.json();
        const raw = stripMarkdownFences(String(payload.response || "").trim());
        const parsed = JSON.parse(raw);
        return {
          subjectSuggestion: String(parsed.subjectSuggestion || "").trim(),
          replacementBody: String(parsed.replacementBody || "").trim(),
          continuation: String(parsed.continuation || "").trim(),
          notes: String(parsed.notes || "").trim()
        };
      }
    } catch {
      // fallback below
    }
  }

  return buildEmailAssistFallback({
    mode,
    companyName,
    contactName,
    instruction
  });
}

function encodeBase64Url(value = "") {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getHeaderValue(headers = [], name) {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractMessageBodies(payload) {
  const result = {
    text: "",
    html: ""
  };

  function walk(part) {
    if (!part) {
      return;
    }

    if (part.parts?.length) {
      part.parts.forEach(walk);
    }

    if (!part.body?.data) {
      return;
    }

    const decoded = decodeBase64Url(part.body.data);
    if (part.mimeType === "text/html" && !result.html) {
      result.html = decoded;
    }

    if (part.mimeType === "text/plain" && !result.text) {
      result.text = decoded;
    }
  }

  walk(payload);
  return result;
}

function summarizeMessage(message) {
  const headers = message.payload?.headers || [];
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet || "",
    internalDate: message.internalDate,
    subject: getHeaderValue(headers, "Subject"),
    from: getHeaderValue(headers, "From"),
    to: getHeaderValue(headers, "To"),
    date: getHeaderValue(headers, "Date")
  };
}

async function getGmailProfile() {
  return gmailRequest("users/me/profile");
}

async function listGmailMessages(query = "", maxResults = 15) {
  const search = new URLSearchParams({
    maxResults: String(maxResults)
  });
  if (query) {
    search.set("q", query);
  }

  const listResponse = await gmailRequest(`users/me/messages?${search.toString()}`);
  const ids = listResponse.messages || [];

  const messages = await Promise.all(
    ids.map((item) =>
      gmailRequest(`users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
    )
  );

  return messages.map(summarizeMessage);
}

async function getGmailMessage(messageId) {
  const message = await gmailRequest(`users/me/messages/${messageId}?format=full`);
  const headers = message.payload?.headers || [];
  const bodies = extractMessageBodies(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    subject: getHeaderValue(headers, "Subject"),
    from: getHeaderValue(headers, "From"),
    to: getHeaderValue(headers, "To"),
    date: getHeaderValue(headers, "Date"),
    snippet: message.snippet || "",
    textBody: bodies.text,
    htmlBody: bodies.html
  };
}

async function sendGmailMessage({ to, subject, htmlBody, textBody }) {
  const profile = await getGmailProfile();
  const parts = [
    `From: ${profile.emailAddress}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${htmlBody ? "text/html" : "text/plain"}; charset=UTF-8`,
    "",
    htmlBody || textBody || ""
  ];

  const raw = encodeBase64Url(parts.join("\r\n"));
  return gmailRequest("users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw })
  });
}

async function revokeStoredToken() {
  const token = readStoredToken();
  if (token?.access_token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token: token.refresh_token || token.access_token
        })
      });
    } catch {
      // Ignore revoke failures when clearing the local token cache.
    }
  }

  clearStoredToken();
}

async function handleGmailStatus(response) {
  try {
    const token = await getValidGmailToken();
    if (!token?.access_token) {
      sendJson(response, 200, { connected: false });
      return;
    }

    const profile = await getGmailProfile();
    sendJson(response, 200, {
      connected: true,
      emailAddress: profile.emailAddress,
      messagesTotal: profile.messagesTotal,
      threadsTotal: profile.threadsTotal
    });
  } catch (error) {
    sendJson(response, 200, {
      connected: false,
      error: error.message
    });
  }
}

function getAppOrigin(request) {
  const host = request.headers.host || "localhost:3000";
  const proto = request.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}`;
}

async function handleRequest(request, response) {
  setSecurityHeaders(response);

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const cookies = parseCookies(request);

  if (request.method === "GET" && url.pathname === "/auth/google/start") {
    try {
      requireGoogleConfig();
      const state = crypto.randomBytes(24).toString("hex");
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", runtimeSecrets.clientId);
      authUrl.searchParams.set("redirect_uri", runtimeSecrets.redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", gmailScopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      sendRedirect(response, authUrl.toString(), {
        "Set-Cookie": createCookie("gmail_oauth_state", encodeURIComponent(state), request, {
          maxAge: 600,
          path: "/auth/google"
        })
      });
    } catch (error) {
      sendRedirect(response, `${getAppOrigin(request)}/?gmail_error=${encodeURIComponent(error.message)}`);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/auth/google/callback") {
    try {
      requireGoogleConfig();
      const expectedState = cookies.gmail_oauth_state || "";
      const returnedState = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";

      if (!code || !expectedState || expectedState !== returnedState) {
        throw new Error("Google sign-in state check failed.");
      }

      const token = await exchangeCodeForToken(code);
      writeStoredToken(token);

      const profile = await getGmailProfile();
      if (
        runtimeSecrets.allowedEmail &&
        profile.emailAddress.toLowerCase() !== runtimeSecrets.allowedEmail
      ) {
        await revokeStoredToken();
        throw new Error(`Please connect the team mailbox: ${runtimeSecrets.allowedEmail}`);
      }

      sendRedirect(response, `${getAppOrigin(request)}/?gmail=connected`, {
        "Set-Cookie": createCookie("gmail_oauth_state", "", request, {
          maxAge: 0,
          path: "/auth/google"
        })
      });
    } catch (error) {
      sendRedirect(response, `${getAppOrigin(request)}/?gmail_error=${encodeURIComponent(error.message)}`);
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/gmail/status") {
    await handleGmailStatus(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/gmail/messages") {
    try {
      const messages = await listGmailMessages(url.searchParams.get("q") || "");
      sendJson(response, 200, { messages });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/gmail/messages/")) {
    try {
      const messageId = url.pathname.split("/").pop();
      const message = await getGmailMessage(messageId);
      sendJson(response, 200, { message });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/gmail/send") {
    try {
      const body = await readJsonBody(request);
      if (!body.to || !body.subject || (!body.htmlBody && !body.textBody)) {
        sendJson(response, 400, {
          error: "To, subject, and a message body are required."
        });
        return;
      }

      await sendGmailMessage(body);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/gmail/disconnect") {
    try {
      await revokeStoredToken();
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/atomic-intelligence/chat") {
    try {
      const body = await readJsonBody(request);
      const result = await generateAtomicIntelligenceAnswer({
        question: body.question || "",
        mode: body.mode || "research",
        companies: Array.isArray(body.companies) ? body.companies.slice(0, 30) : []
      });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Atomic Intelligence could not complete that request."
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/atomic-intelligence/email-assist") {
    try {
      const body = await readJsonBody(request);
      const mode = String(body.mode || "first_outreach").trim();
      const result = await generateAtomicEmailAssist({
        mode,
        company: body.company || {},
        contact: body.contact || {},
        subject: body.subject || "",
        html: body.html || "",
        plainText: body.plainText || "",
        instruction: body.instruction || ""
      });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Email assist could not complete that request."
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/company-research") {
    try {
      const body = await readJsonBody(request);
      const result = await researchCompanyWebsite({
        companyName: body.companyName || "",
        website: body.website || "",
        searchMode: body.searchMode || "website",
        context: body.context || "",
        companySearchMode: body.companySearchMode || "company"
      });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/external-sponsor-search") {
    try {
      const body = await readJsonBody(request);
      let industry = String(body.industry || "").trim();
      const context = String(body.context || "").trim();
      const website = String(body.website || "").trim();
      const companyName = String(body.companyName || "").trim();

      if (!industry && website) {
        try {
          const websiteDraft = await researchCompanyWebsite({
            companyName,
            website,
            searchMode: "website",
            context,
            companySearchMode: "company"
          });
          industry = String(websiteDraft.sector || "").trim() || String(companyName || "").trim();
        } catch {
          // Fall back to company name or domain-derived label below.
        }
      }

      if (!industry && companyName) {
        industry = companyName;
      }

      if (!industry && website) {
        industry = inferCompanyNameFromWebsite(website);
      }

      const companyCandidates = await discoverExternalSponsorCandidates({
        industry,
        context
      });

      sendJson(response, 200, {
        companyName: industry,
        website: website || "",
        searchMode: "company",
        context,
        companySearchMode: "industry",
        companyCandidates,
        contacts: [],
        emails: [],
        emailMatches: [],
        phones: [],
        pages: [],
        signals: [],
        sector: "",
        recommendedAskType: "",
        summary: `Found ${companyCandidates.length} likely external sponsor targets for ${industry}, ranked by public sponsorship-fit signals.`,
        personalization: "",
        fieldSuggestions: []
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/config.js") {
    response.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    response.end(getRuntimeConfigScript());
    return;
  }

  if (!existsSync(distDir)) {
    sendText(response, 500, "Build output not found. Run the build step before starting the server.");
    return;
  }

  try {
    const filePath = await resolveRequestPath(url.pathname);
    // Use no-cache for HTML files (index.html, SPA), short cache for app
    const cacheStrategy = filePath.endsWith(".html") ? "no-cache" : filePath.match(/\.\w+$/) && !filePath.match(/\.[a-f0-9]{8,}/) ? "short" : "default";
    sendFile(response, filePath, cacheStrategy);
  } catch (error) {
    sendText(response, 500, `Server error: ${error.message}`);
  }
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (String(request.url || "").startsWith("/api/")) {
      sendJson(response, 500, {
        error: "The company finder hit an unexpected server error. Please try again."
      });
      return;
    }

    sendText(response, 500, `Server error: ${error.message}`);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sponsor portal listening on port ${port}`);
});
