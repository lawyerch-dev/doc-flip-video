import puppeteer from "puppeteer";
import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 1920, H = 1080, FPS = 30;

// Timing per segment (seconds)
const COVER_SEC = 2.0;
const CURL_SEC = 2.5;
const HOLD_SEC = 1.5;
const WIPE_SEC = 2.5;
const FINAL_SEC = 1.5;

const TOTAL_SEC = COVER_SEC + CURL_SEC + HOLD_SEC + WIPE_SEC + FINAL_SEC;
const TOTAL_FRAMES = Math.ceil(TOTAL_SEC * FPS);

function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

function startServer(dir, port) {
  const types = { ".html": "text/html", ".png": "image/png", ".js": "text/javascript", ".json": "application/json" };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const fp = path.join(dir, req.url === "/" ? "src/renderer.html" : req.url);
      if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(port, () => resolve(srv));
  });
}

async function main() {
  const port = 18765;
  const srv = await startServer(path.join(__dirname, ".."), port);
  console.log(`Server :${port}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  page.on("console", msg => { if (msg.type() === "error") console.log("  [page]", msg.text()); });

  await page.goto(`http://localhost:${port}/`, { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  console.log(`Ready. ${TOTAL_FRAMES} frames (${TOTAL_SEC.toFixed(1)}s)...`);

  fs.mkdirSync(path.join(__dirname, "..", "output"), { recursive: true });
  const outFile = path.join(__dirname, "..", "output", "output.mp4");

  const ffmpeg = spawn("ffmpeg", [
    "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${W}x${H}`, "-r", `${FPS}`,
    "-i", "pipe:0",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    outFile,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  let lastPct = -1;

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const sec = f / FPS;
    let action, progress;

    if (sec < COVER_SEC) {
      // Show cover
      action = { type: "phase", phase: "cover", progress: 0 };
    } else if (sec < COVER_SEC + CURL_SEC) {
      // InvertedPageCurl: cover → content
      action = { type: "transition", name: "InvertedPageCurl", progress: easeInOut((sec - COVER_SEC) / CURL_SEC), from: "cover", to: "plain" };
    } else if (sec < COVER_SEC + CURL_SEC + HOLD_SEC) {
      // Hold on plain content (curl just showed plain)
      action = { type: "phase", phase: "hold", progress: 0 };
    } else if (sec < COVER_SEC + CURL_SEC + HOLD_SEC + WIPE_SEC) {
      // Marker sweep: plain → highlighted
      action = { type: "sweep", progress: easeInOut((sec - COVER_SEC - CURL_SEC - HOLD_SEC) / WIPE_SEC) };
    } else {
      // Final hold on highlighted
      action = { type: "phase", phase: "hold", progress: 1 };
    }

    const pixels = await page.evaluate(async (action) => {
      if (action.type === "sweep") {
        await window.__renderHighlightSweep('plain', 'hl', action.progress);
      } else if (action.type === "transition") {
        await window.__renderTransition(action.name, action.progress, action.from, action.to);
      } else {
        await window.__renderPhase(action.phase, action.progress);
      }
      const canvas = document.getElementById("c");
      const gl = canvas.getContext("webgl");
      const W = canvas.width, H = canvas.height;
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let binary = "";
      for (let i = 0; i < buf.length; i += 8192) {
        binary += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      }
      return btoa(binary);
    }, action);

    const rawBuf = Buffer.from(pixels, "base64");
    const ok = ffmpeg.stdin.write(rawBuf);
    if (!ok) await new Promise(r => ffmpeg.stdin.once("drain", r));

    const pct = Math.round((f + 1) / TOTAL_FRAMES * 100);
    if (pct !== lastPct) { process.stdout.write(`\r  ${pct}%`); lastPct = pct; }
  }

  ffmpeg.stdin.end();
  await new Promise((res, rej) => ffmpeg.on("close", c => c === 0 ? res() : rej(new Error(`exit ${c}`))));
  await browser.close();
  srv.close();
  console.log(`\n✅ → output/output.mp4`);
}

main().catch(e => { console.error(e); process.exit(1); });
