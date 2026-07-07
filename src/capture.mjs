import puppeteer from "puppeteer";
import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS = 60;

// Load template + config
const templatePath = path.join(__dirname, '..', 'template.json');
const tmpl = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
const W = tmpl.style.width, H = tmpl.style.height;

const configPath = process.argv[2] || path.join(__dirname, '..', 'article.json');
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const tm = cfg.timing || {};

// Build timeline
let t = 0;
const segments = [];
function add(name, dur, extra) { const end = t + dur; segments.push({ end, fn: name, t0: t, dur, ...extra }); t = end; }
add('settle', tm.settle || 1.2, {});
add('cover', tm.cover || 2.0, {});
add('curl',  tm.curl  || 2.5, {});
add('sweep', tm.sweep || 2.0, {});
add('blend', tm.hold || 1.0, { val: 1 }); // hold on highlighted content
add('blend', tm.final || 2.0, { val: 1 });
const TOTAL_SEC = segments[segments.length - 1].end;
const TOTAL_FRAMES = Math.ceil(TOTAL_SEC * FPS);

function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

// Pre-compute frame calls for in-page batching
const frameCalls = [];
for (let f = 0; f < TOTAL_FRAMES; f++) {
  const sec = f / FPS;
  for (const seg of segments) {
    if (sec < seg.end) {
      if (seg.fn === 'cover') { frameCalls.push('cover'); break; }
      if (seg.fn === 'blend') { frameCalls.push(`blend(${seg.val})`); break; }
      let p = easeInOut((sec - seg.t0) / seg.dur);
      // Skip white-screen phase: clamp settle progress to min 0.6
      if (seg.fn === 'settle') p = Math.max(p, 0.6);
      frameCalls.push(`${seg.fn}(${p.toFixed(4)})`);
      break;
    }
  }
}

function startServer(dir, port) {
  const types = { ".html": "text/html", ".png": "image/png", ".ico": "image/x-icon" };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      const fp = path.join(dir, urlPath === "/" ? "src/renderer.html" : urlPath);
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
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--disable-gpu-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
    ],
  });
  const page = await browser.newPage();
  // 1x viewport — renderer.html reads template for canvas size
  await page.setViewport({ width: W, height: H });
  page.on("console", msg => { if (msg.type() === "error") console.log("  [page]", msg.text()); });
  page.on("error", err => console.error("  [page error]", err.message));
  page.on("crash", () => console.error("  [page crash]"));

  const imgPath = `temp/issue-${String(cfg.meta.issueNumber).padStart(3, "0")}`;
  await page.goto(`http://localhost:${port}/?img=${encodeURIComponent(imgPath)}`, { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  console.log(`${TOTAL_FRAMES} frames (${TOTAL_SEC}s)...`);

  fs.mkdirSync(path.join(__dirname, "..", "output"), { recursive: true });
  const issueNum = String(cfg.meta.issueNumber).padStart(3, "0");
  const outFile = path.join(__dirname, "..", "output", `法务视频-${issueNum}期.mp4`);
  const progressPath = path.join(__dirname, "..", "temp", `issue-${issueNum}`, "progress.json");
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });

  // Pick random background music
  const musicDir = path.join(__dirname, '..', 'assets', 'music');
  const musicFiles = fs.readdirSync(musicDir).filter(f => f.match(/\.(mp3|wav|ogg|m4a)$/i));
  const musicFile = musicFiles.length > 0 ? path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]) : null;
  if (musicFile) console.log(`🎵 ${path.basename(musicFile)}`);

  // ffmpeg: decode JPEG, upscale 1x→2x with lanczos, add BGM at 30% volume
  const outW = W * 2, outH = H * 2;
  const ffmpegArgs = [
    "-y",
    "-f", "image2pipe", "-c:v", "mjpeg", "-r", `${FPS}`,
    "-i", "pipe:0",
  ];
  if (musicFile) {
    ffmpegArgs.push("-i", musicFile);
  }
  ffmpegArgs.push(
    "-vf", `scale=${outW}:${outH}:flags=lanczos`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "14",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  );
  if (musicFile) {
    ffmpegArgs.push(
      "-af", "volume=0.3",
      "-c:a", "aac", "-b:a", "128k",
      "-map", "0:v:0", "-map", "1:a:0",
      "-shortest",
    );
  }
  ffmpegArgs.push(outFile);
  const ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "inherit", "inherit"] });

  // Batch render: send frame calls to page, get JPEG frames back
  const BATCH = 60;
  let rendered = 0;

  for (let start = 0; start < TOTAL_FRAMES; start += BATCH) {
    const end = Math.min(start + BATCH, TOTAL_FRAMES);
    const batch = frameCalls.slice(start, end);

    const jpegBuffers = await page.evaluate(async (calls) => {
      const results = [];
      for (const call of calls) {
        const [fn, ...args] = call.replace(')', '').split('(');
        window['__' + fn](...args.map(Number));
        const canvas = document.getElementById("c");
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        results.push(dataUrl.split(',')[1]);
      }
      return results;
    }, batch);

    for (const b64 of jpegBuffers) {
      const ok = ffmpeg.stdin.write(Buffer.from(b64, 'base64'));
      if (!ok) await new Promise(r => ffmpeg.stdin.once('drain', r));
    }

    rendered += batch.length;
    process.stdout.write(`\r  ${Math.round(rendered / TOTAL_FRAMES * 100)}%`);
    try { fs.writeFileSync(progressPath, JSON.stringify({ rendered, total: TOTAL_FRAMES, pct: Math.round(rendered / TOTAL_FRAMES * 100) })); } catch {}
  }

  ffmpeg.stdin.end();
  await new Promise((res, rej) => ffmpeg.on("close", c => c === 0 ? res() : rej(new Error(`exit ${c}`))));
  // Mark progress complete
  try { fs.writeFileSync(progressPath, JSON.stringify({ rendered: TOTAL_FRAMES, total: TOTAL_FRAMES, pct: 100, done: true })); } catch {}

  // Embed cover image as video poster
  const issueNum2 = String(cfg.meta.issueNumber).padStart(3, "0");
  const coverPng = path.join(__dirname, '..', 'temp', `issue-${issueNum2}`, 'cover.png');
  if (fs.existsSync(coverPng)) {
    const tmpOut = outFile + '.tmp.mp4';
    const posterArgs = ['-y', '-i', outFile, '-i', coverPng,
      '-map', '0', '-map', '1', '-c', 'copy',
      '-disposition:v:1', 'attached_pic',
      '-movflags', '+faststart', tmpOut];
    await new Promise((res, rej) => {
      const p = spawn('ffmpeg', posterArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
      p.on('close', c => c === 0 ? res() : rej(new Error(`poster exit ${c}`)));
    });
    fs.renameSync(tmpOut, outFile);
    console.log('🖼️  Poster embedded');
  }

  await browser.close();
  srv.close();
  console.log(`\n✅ → output/output.mp4`);
}

main().catch(e => { console.error(e); process.exit(1); });
