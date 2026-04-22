import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import crypto from "node:crypto";

const distDir = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT || 3000);

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
  allowedEmail: (process.env.GMAIL_ACCOUNT_EMAIL || "").trim().toLowerCase()
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

function sendFile(response, filePath) {
  const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
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

  if (!existsSync(distDir)) {
    sendText(response, 500, "Build output not found. Run the build step before starting the server.");
    return;
  }

  try {
    const filePath = await resolveRequestPath(url.pathname);
    sendFile(response, filePath);
  } catch (error) {
    sendText(response, 500, `Server error: ${error.message}`);
  }
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendText(response, 500, `Server error: ${error.message}`);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sponsor portal listening on port ${port}`);
});
