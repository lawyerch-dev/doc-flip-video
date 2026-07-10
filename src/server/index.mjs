import http from "http";
import fs from "fs";
import path from "path";

import { WEB_DIR, ROOT, MIME, json, PORT, getSettings } from "./shared.mjs";
import { register as scrapeRoutes } from "./routes/scrape.mjs";
import { register as aiRoutes } from "./routes/ai.mjs";
import { register as buildRoutes } from "./routes/build.mjs";
import { register as projectRoutes } from "./routes/project.mjs";

// ── Static file server ──
function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];
  urlPath = decodeURIComponent(urlPath);
  if (urlPath === "/" || urlPath === "/index.html") urlPath = "/index.html";

  let filePath = path.join(WEB_DIR, urlPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, urlPath);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_DIR, "index.html");
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  // Video: support range requests
  if (ext === ".mp4" && req.headers.range) {
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": stat.size });
  fs.createReadStream(filePath).pipe(res);
}

// ── Main handler ──
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const method = req.method;
  const urlPath = req.url.split("?")[0];
  const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;

  try {
    // Route dispatching — first match wins
    if (await scrapeRoutes(method, urlPath, req, res, params)) return;
    if (await aiRoutes(method, urlPath, req, res, params)) return;
    if (await buildRoutes(method, urlPath, req, res, params)) return;
    if (await projectRoutes(method, urlPath, req, res, params)) return;

    // ── Static files (SPA fallback) ──
    serveStatic(req, res);
  } catch (e) {
    console.error(`Error [${method} ${urlPath}]:`, e);
    json(res, { error: e.message }, 500);
  }
});

server.listen(PORT, () => {
  const settings = getSettings();
  console.log(`\n🚀 Doc Flip Video Studio`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   Original API (preserved):`);
  console.log(`   POST /generate   — Generate video (returns MP4 download)`);
  console.log(`   GET  /health     — Health check`);
  console.log(`\n   New Web UI API:`);
  console.log(`   POST /api/scrape         — Scrape article from URL`);
  console.log(`   POST /api/generate-config — AI generates config from text`);
  console.log(`   POST /api/refine          — AI refines config`);
  console.log(`   POST /api/preview         — Generate preview images`);
  console.log(`   POST /api/build           — Generate video`);
  console.log(`   GET  /api/status?issue=N  — Check video status`);
  console.log(`   AI: ${settings.aiApiKey ? settings.aiModel + ' @ ' + settings.aiBaseUrl : '\u26a0\ufe0f  \u672a\u914d\u7f6e AI\uff08\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u586b\u5199\uff09'}`);
});
