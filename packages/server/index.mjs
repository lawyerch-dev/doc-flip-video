import http from "http";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── Catch hidden crashes ──
process.on('uncaughtException', (e) => { console.error('[uncaughtException]', e); });
process.on('unhandledRejection', (e) => { console.error('[unhandledRejection]', e); });

import { WEB_DIR, ROOT, MIME, json, PORT, getSettings } from "./shared.mjs";
import { register as scrapeRoutes } from "./routes/scrape.mjs";
import { register as aiRoutes } from "./routes/ai.mjs";
import { register as buildRoutes } from "./routes/build.mjs";
import { register as projectRoutes } from "./routes/project.mjs";
import { register as workflowRoutes } from "./routes/workflow.mjs";

const STUDIO_PORT = 5173;

// ── Proxy to Studio dev server ──
function proxyToStudio(req, res) {
  const url = req.url;
  const proxyReq = http.request({
    hostname: "localhost",
    port: STUDIO_PORT,
    path: url,
    method: req.method,
    headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Studio 未启动，请运行: pnpm studio:flow");
  });
  req.pipe(proxyReq);
}

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
const requestHandler = async (req, res) => {
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
    if (urlPath.startsWith("/workflow")) {
      proxyToStudio(req, res);
      return;
    }
    if (await scrapeRoutes(method, urlPath, req, res, params)) return;
    if (await aiRoutes(method, urlPath, req, res, params)) return;
    if (await buildRoutes(method, urlPath, req, res, params)) return;
    if (await projectRoutes(method, urlPath, req, res, params)) return;
    if (await workflowRoutes(method, urlPath, req, res, params)) return;
    serveStatic(req, res);
  } catch (e) {
    console.error(`Error [${method} ${urlPath}]:`, e);
    json(res, { error: e.message }, 500);
  }
};

function startServer(retries = 10) {
  const server = http.createServer(requestHandler);
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

  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      if (retries <= 0) {
        console.error(`Port ${PORT} still busy, giving up.`);
        process.exit(1);
      }
      // Try to kill the process holding the port
      try { execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`); } catch {}
      console.log(`Port ${PORT} busy, killing old process and retrying (${retries} left)...`);
      server.close();
      setTimeout(() => startServer(retries - 1), 500);
    } else {
      console.error('Server error:', e);
      process.exit(1);
    }
  });
}

startServer();
