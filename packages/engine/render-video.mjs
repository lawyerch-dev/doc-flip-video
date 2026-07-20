#!/usr/bin/env node
// render-video.mjs — Pure FFmpeg video generation using xfade-easing
// Uses custom FFmpeg for GLSL transitions, pipes to system FFmpeg for encoding

import { execFileSync, spawn } from "child_process";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROOT, TEMP_DIR, OUTPUT_DIR } from "../../config/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Find FFmpeg binaries ──
function findFFmpeg() {
  const platform = `${process.platform}-${process.arch}`.replace("win32", "windows");
  const platformBin = path.join(__dirname, "build", `ffmpeg-${platform}`);
  const genericBin = path.join(__dirname, "build", "ffmpeg-custom");
  if (fs.existsSync(platformBin)) return platformBin;
  if (fs.existsSync(genericBin)) return genericBin;
  console.error(`\n❌ 缺少自定义 FFmpeg: ${platformBin}`);
  console.error(`   运行: bash scripts/build-ffmpeg-xfade.sh`);
  console.error(`   或从 GitHub Releases 下载对应平台二进制到 packages/engine/build/\n`);
  process.exit(1);
}

// ── Generate glow strip PNG (matching video-renderer.html SWEEP shader) ──
function generateGlowStrip(width, height, stripWidth) {
  const canvas = createCanvas(stripWidth, height);
  const ctx = canvas.getContext("2d");

  // Yellow glow gradient: bright center → transparent edges
  // Matches shader: vec3(1.0, 0.9, 0.3) * glow * 0.5
  // Luminous glow: white-hot center, warm yellow halo
  // Simulates additive light: bright white core, soft yellow falloff
  const grad = ctx.createLinearGradient(0, 0, stripWidth, 0);
  // Center: near-white, high opacity (luminous)
  grad.addColorStop(0, "rgba(255,255,240,0)");
  grad.addColorStop(0.25, "rgba(255,240,180,0.08)");
  grad.addColorStop(0.4, "rgba(255,230,130,0.3)");
  grad.addColorStop(0.47, "rgba(255,245,220,0.7)");
  grad.addColorStop(0.5, "rgba(255,255,250,0.95)");
  grad.addColorStop(0.53, "rgba(255,245,220,0.7)");
  grad.addColorStop(0.6, "rgba(255,230,130,0.3)");
  grad.addColorStop(0.75, "rgba(255,240,180,0.08)");
  grad.addColorStop(1, "rgba(255,255,240,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, stripWidth, height);

  return canvas.toBuffer("image/png");
}
// ── Load config ──
const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node render-video.mjs <config.json>");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const tm = cfg.timing || {};

const issueNum = String(cfg.meta.issueNumber).padStart(3, "0");
const imgDir = path.join(TEMP_DIR, `issue-${issueNum}`);
const outDir = OUTPUT_DIR;
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `法务视频-${issueNum}期.mp4`);

// ── Output dimensions ──
const outW = 1080,
  outH = 1840,
  fps = 30;

// ── Timing ──
const settleDur = tm.settle || 1.2;
const coverDur = tm.cover || 2.0;
const curlDur = tm.curl || 2.5;
const sweepDur = tm.sweep || 2.0;
const holdDur = tm.hold || 1.0;
const finalDur = tm.final || 2.0;
const totalDur = settleDur + coverDur + curlDur + sweepDur + holdDur + finalDur;

// ── Pick background music ──
const musicDir = path.join(ROOT, "assets", "music");
const musicFiles = fs.readdirSync(musicDir).filter((f) => f.match(/\.(mp3|wav|ogg|m4a)$/i));
const musicFile =
  musicFiles.length > 0 ? path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]) : null;
if (musicFile) console.log(`🎵 ${path.basename(musicFile)}`);

// ── Find FFmpeg ──
const customFFmpeg = findFFmpeg();
console.log(`🔧 自定义 FFmpeg: gl_swap + gl_InvertedPageCurl + sweep-glow`);

// ── Verify images ──
const coverImg = path.join(imgDir, "cover.png");
const plainImg = path.join(imgDir, "content-plain.png");
const hlImg = path.join(imgDir, "content-hl.png");
for (const img of [coverImg, plainImg, hlImg]) {
  if (!fs.existsSync(img)) {
    console.error(`❌ 缺少: ${img}`);
    process.exit(1);
  }
}

// ── Generate glow strip image ──
const glowStripW = Math.round(outW * 0.06); // ~64px, matches shader falloff width
const glowStripPath = path.join(imgDir, "glow-strip.png");
const glowPng = generateGlowStrip(outW, outH, glowStripW);
fs.writeFileSync(glowStripPath, glowPng);
console.log(`✨ 光晕条: ${glowStripW}px`);
// ── Build filter_complex ──
const easing = "easing=cubic-in-out:";
const curlOffset = settleDur + coverDur;
const sweepOffset = curlOffset + curlDur;
const fadeOutStart = sweepOffset + sweepDur + holdDur;

// Cover must last until curl xfade starts (not just coverDur)
const coverInputDur = curlOffset + 0.1;

const videoFilters = [
  `[0:v]scale=${outW}:${outH}[v0]`,
  `[1:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${totalDur + 1},setpts=PTS-STARTPTS[v1]`,
  `[2:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${totalDur + 1},setpts=PTS-STARTPTS[v2]`,
  `[3:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${totalDur + 1},setpts=PTS-STARTPTS[v3]`,
];

// Glow strip input [4:v]
videoFilters.push(`[4:v]format=rgba[glow]`);
videoFilters.push(
  `[v0][v1]xfade=${easing}transition='gl_swap(reflection=0.4,perspective=0.2,depth=3)':duration=${settleDur}:offset=0[s1]`,
  `[s1][v2]xfade=${easing}transition=gl_InvertedPageCurl:duration=${curlDur}:offset=${curlOffset}[s2]`,
  `[s2][v3]xfade=${easing}transition=wiperight:duration=${sweepDur}:offset=${sweepOffset}[s3]`,
);

// Overlay glow strip: moves left→right during sweep phase with cubic-in-out easing
// to match the wiperight xfade easing curve
videoFilters.push(
  `[s3][glow]overlay=x='if(between(t,${sweepOffset},${sweepOffset + sweepDur}),` +
    `(if(lt((t-${sweepOffset})/${sweepDur},0.5),4*pow((t-${sweepOffset})/${sweepDur},3),1-pow(-2*(t-${sweepOffset})/${sweepDur}+2,3)/2))*${outW}-${glowStripW / 2},-${glowStripW})':y=0:format=auto[s4]`,
  `[s4]fade=t=out:st=${fadeOutStart}:d=${finalDur},trim=duration=${totalDur},setpts=PTS-STARTPTS[vout]`,
);
const filterComplex = videoFilters.join(";");

// ── Run pipeline ──
console.log(`🎬 生成: ${outFile}`);
console.log(`   ${outW}×${outH}, ~${totalDur.toFixed(1)}s`);

const start = Date.now();

const customArgs = [
  "-y",
  "-f",
  "lavfi",
  "-i",
  `color=white:s=${outW}x${outH}:r=${fps}:d=${settleDur}`,
  "-loop",
  "1",
  "-t",
  String(totalDur + 1),
  "-i",
  coverImg,
  "-loop",
  "1",
  "-t",
  String(totalDur + 1),
  "-i",
  plainImg,
  "-loop",
  "1",
  "-t",
  String(totalDur + 1),
  "-i",
  hlImg,
  "-loop",
  "1",
  "-t",
  String(totalDur),
  "-i",
  glowStripPath,
  "-filter_complex",
  filterComplex,
  "-map",
  "[vout]",
  "-c:v",
  "rawvideo",
  "-pix_fmt",
  "yuv420p",
  "-f",
  "yuv4mpegpipe",
  "-",
];

const encodeArgs = ["-y", "-i", "pipe:0"];
if (musicFile) encodeArgs.push("-i", musicFile);
encodeArgs.push("-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
if (musicFile) encodeArgs.push("-c:a", "aac", "-b:a", "128k", "-shortest");
encodeArgs.push(outFile);

try {
  const customProc = spawn(customFFmpeg, customArgs, { stdio: ["ignore", "pipe", "inherit"] });
  const encodeProc = spawn("ffmpeg", encodeArgs, { stdio: [customProc.stdout, "inherit", "inherit"] });
  await new Promise((resolve, reject) => {
    encodeProc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`encode exit ${code}`))));
    customProc.on("close", (code) => {
      if (code !== 0) reject(new Error(`xfade exit ${code}`));
    });
  });
  console.log(`\n✅ 完成 (${((Date.now() - start) / 1000).toFixed(1)}s): ${outFile}`);
} catch (e) {
  console.error(`\n❌ 失败: ${e.message}`);
  process.exit(1);
}

// ── Embed poster: extract settle midpoint frame and insert as first video frame ──
try {
  const posterClip = outFile.replace(".mp4", ".poster-clip.mp4");
  const posterOut = outFile.replace(".mp4", ".poster-out.mp4");
  // Extract poster at 0.6s (mid-settle: white exiting, cover entering)
  const posterTime = 0.6;
  // Clean up old poster files
  const oldPoster = outFile.replace(".mp4", "-poster.png");
  if (fs.existsSync(oldPoster)) fs.unlinkSync(oldPoster);
  const posterFrame = outFile.replace(".mp4", "-poster.png");
  // Extract poster frame from the full video
  execFileSync("ffmpeg", ["-y", "-ss", String(posterTime), "-i", outFile, "-frames:v", "1", "-q:v", "2", posterFrame], {
    stdio: "pipe",
    timeout: 10000,
  });
  // Create a 1-frame video clip from poster
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      posterFrame,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "14",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
      "-t",
      "0.033",
      posterClip,
    ],
    { stdio: "pipe", timeout: 10000 },
  );
  // Concat: poster frame + original video starting from 0.3s (skip settle start)
  // First frame is poster (macOS thumbnail), video starts from mid-settle
  // Build args dynamically — only include audio mapping if video has audio
  const concatArgs = [
    "-y",
    "-i",
    posterClip,
    "-ss",
    "0.3",
    "-i",
    outFile,
    "-filter_complex",
    "[0:v]setpts=PTS-STARTPTS[poster];[1:v]setpts=PTS-STARTPTS+0.033/TB[video];[poster][video]concat=n=2:v=1:a=0[outv]",
    "-map",
    "[outv]",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "14",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];
  // Only add audio mapping if music is present
  if (musicFile) {
    concatArgs.push("-map", "1:a", "-c:a", "copy");
  }
  concatArgs.push(posterOut);

  execFileSync(systemFFmpeg, concatArgs, { stdio: "pipe", timeout: 30000 });
  fs.renameSync(posterOut, outFile);
  fs.unlinkSync(posterClip);
  console.log(`🖼️  海报已置为视频首帧 (${posterTime.toFixed(2)}s 帧)`);
} catch (e) {
  console.warn("⚠️  海报嵌入失败:", e.message);
}
