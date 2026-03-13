import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function logStep(message) {
  console.log(`- ${message}`);
}

export function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function attachPageDiagnostics(page, label = "page") {
  page.on("pageerror", (error) => {
    console.log(`[${label}:pageerror] ${error?.stack || error?.message || error}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`[${label}:console:${message.type()}] ${message.text()}`);
    }
  });
}

export async function createStaticServer(root = projectRoot) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = path.resolve(root, `.${relativePath}`);
      if (!filePath.startsWith(root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const body = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      response.writeHead(200, {
        "content-type": mimeTypes[ext] || "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === "ENOENT" ? 404 : 500);
      response.end(error?.code === "ENOENT" ? "Not found" : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

export async function closeStaticServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    console.error("Playwright 尚未安裝。先執行 `npm install -D playwright`，再執行 `npx playwright install chromium`。");
    throw error;
  }
}

export async function bootDebugPage(page, baseUrl, routeIndex = 0) {
  await page.goto(`${baseUrl}/?debug=1&mute=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__tinyAirplanes?.getSnapshot));
  await page.evaluate((selectedRoute) => {
    localStorage.clear();
    window.__tinyAirplanes.resetProgress();
    window.__tinyAirplanes.setDebug(true);
    window.__tinyAirplanes.setAudio(false);
    window.__tinyAirplanes.setUnlockedRoute(selectedRoute);
    window.__tinyAirplanes.selectRoute(selectedRoute);
  }, routeIndex);
}

export async function getSnapshot(page) {
  return page.evaluate(() => window.__tinyAirplanes.getSnapshot());
}
