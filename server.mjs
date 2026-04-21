import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

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

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
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

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);

  if (!existsSync(distDir)) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Build output not found. Run the build step before starting the server.");
    return;
  }

  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const filePath = await resolveRequestPath(url.pathname);
    sendFile(response, filePath);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Sponsor portal listening on port ${port}`);
});
