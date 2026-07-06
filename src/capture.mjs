import puppeteer from "puppeteer";
import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1440, FPS = 60;

// Load config
const configPath = process.argv[2] || path.join(__dirname, '..', 'article.json');
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const tm = cfg.timing || {};

// Build timeline from config
let t = 0;
const T = [];
function add(name, dur, extra) { const end = t + dur; T.push({ end, fn: name, t0: t, dur, ...extra }); t = end; }
add('settle', tm.settle || 1.2, {});          // 封面入场（纸张落地）
add('cover', tm.cover || 2.0, {});            // 封面停留
add('curl',  tm.curl  || 2.5, {});            // 翻页 cover→plain
add('sweep', tm.sweep || 2.0, {});            // 荧光涂抹 plain→hl
add('blend', tm.final || 2.0, { val: 1 });   // 高亮停留
const TOTAL_SEC = T[T.length - 1].end;
const TOTAL_FRAMES = Math.ceil(TOTAL_SEC * FPS);

function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

function getFrame(sec) {
  for (const seg of T) {
    if (sec < seg.end) {
      if (seg.fn === 'cover') return 'cover()';
      if (seg.fn === 'blend') return `blend(${seg.val})`;
      const p = easeInOut((sec - seg.t0) / seg.dur);
      return `${seg.fn}(${p.toFixed(4)})`;
    }
  }
  return 'blend(1)';
}

function startServer(dir, port) {
  const types = { ".html": "text/html", ".png": "image/png", ".ico": "image/x-icon" };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      // Ignore favicon requests
      if (req.url === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      const fp = path.join(dir, req.url === "/" ? "src/renderer.html" : req.url);
      if (!fs.existsSync(fp)) { console.log(`  404: ${req.url}`); res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(port, () => resolve(srv));
  });
}

async function main() {
  const port = 18765;
  const srv = await startServer(path.join(__dirname, ".."), port);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  page.on("console", msg => { if (msg.type() === "error") console.log("  [page]", msg.text()); });

  await page.goto(`http://localhost:${port}/`, { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  console.log(`${TOTAL_FRAMES} frames (${TOTAL_SEC}s)...`);

  fs.mkdirSync(path.join(__dirname, "..", "output"), { recursive: true });
  const outFile = path.join(__dirname, "..", "output", "output.mp4");

  const ffmpeg = spawn("ffmpeg", [
    "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", `${FPS}`,
    "-i", "pipe:0",
    "-vf", "vflip",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  let lastPct = -1;

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const call = getFrame(f / FPS);
    const pixels = await page.evaluate(async (call, W, H) => {
      const [fn, ...args] = call.replace(')', '').split('(');
      window['__' + fn](...args.map(Number));
      const gl = document.getElementById("c").getContext("webgl");
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let b = "";
      for (let i = 0; i < buf.length; i += 8192) b += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      return btoa(b);
    }, call, W, H);

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
