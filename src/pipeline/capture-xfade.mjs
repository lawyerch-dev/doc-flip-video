#!/usr/bin/env node
// capture-xfade.mjs — Pure FFmpeg video generation using xfade-easing
// Requires custom FFmpeg build with xfade-easing (scripts/build-ffmpeg-xfade.sh)
// Falls back to standard FFmpeg with built-in transitions if custom build not found

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

// ── Find FFmpeg binary ──
function findFFmpeg() {
  const custom = path.join(ROOT, "build", "ffmpeg-custom");
  if (fs.existsSync(custom)) {
    try {
      const help = execFileSync(custom, ["-hide_banner", "--help", "filter=xfade"], { encoding: "utf-8", timeout: 5000 });
      if (help.includes("easing")) return { bin: custom, hasEasing: true };
    } catch {}
  }
  return { bin: "ffmpeg", hasEasing: false };
}

// ── Load config ──
const configPath = process.argv[2];
if (!configPath) { console.error("Usage: node capture-xfade.mjs <config.json>"); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const tm = cfg.timing || {};

const issueNum = String(cfg.meta.issueNumber).padStart(3, "0");
const imgDir = path.join(ROOT, "data", "temp", `issue-${issueNum}`);
const outDir = path.join(ROOT, "data", "output");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `法务视频-${issueNum}期.mp4`);

// ── Output dimensions ──
const outW = 1080, outH = 1840, fps = 30;

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
const musicFiles = fs.readdirSync(musicDir).filter(f => f.match(/\.(mp3|wav|ogg|m4a)$/i));
const musicFile = musicFiles.length > 0
  ? path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)])
  : null;
if (musicFile) console.log(`🎵 ${path.basename(musicFile)}`);

// ── Find FFmpeg ──
const { bin: ffmpeg, hasEasing } = findFFmpeg();
console.log(`🔧 FFmpeg: ${ffmpeg} (easing: ${hasEasing ? "✅" : "❌ built-in transitions"})`);

// ── Verify images ──
const coverImg = path.join(imgDir, "cover.png");
const plainImg = path.join(imgDir, "content-plain.png");
const hlImg = path.join(imgDir, "content-hl.png");
for (const img of [coverImg, plainImg, hlImg]) {
  if (!fs.existsSync(img)) { console.error(`❌ 缺少: ${img}`); process.exit(1); }
}

// ── Build filter_complex ──
const easing = hasEasing ? "easing=cubic-in-out:" : "";
const curlOffset = settleDur + coverDur;
const sweepOffset = curlOffset + curlDur;
const fadeOutStart = sweepOffset + sweepDur + holdDur;

const videoFilters = [
  // Scale all inputs
  `[0:v]scale=${outW}:${outH}:flags=lanczos[v0]`,
  `[1:v]fps=${fps},scale=${outW}:${outH}:flags=lanczos,setpts=PTS-STARTPTS,trim=duration=${coverDur},setpts=PTS-STARTPTS[v1]`,
  `[2:v]fps=${fps},scale=${outW}:${outH}:flags=lanczos,setpts=PTS-STARTPTS,trim=duration=${curlDur + sweepDur + 1},setpts=PTS-STARTPTS[v2]`,
  `[3:v]fps=${fps},scale=${outW}:${outH}:flags=lanczos,setpts=PTS-STARTPTS,trim=duration=${holdDur + finalDur + 1},setpts=PTS-STARTPTS[v3]`,
];

if (hasEasing) {
  videoFilters.push(
    `[v0][v1]xfade=${easing}transition=gl_doorway(reflection=0.4,perspective=0.2,depth=3):duration=${settleDur}:offset=0[s1]`,
    `[s1][v2]xfade=${easing}transition=gl_InvertedPageCurl:duration=${curlDur}:offset=${curlOffset}[s2]`,
    `[s2][v3]xfade=${easing}transition=wipeleft:duration=${sweepDur}:offset=${sweepOffset}[s3]`,
    `[s3]fade=t=out:st=${fadeOutStart}:d=${finalDur}[vout]`,
  );
} else {
  videoFilters.push(
    `[v0][v1]xfade=transition=fadeblack:duration=${settleDur}:offset=0[s1]`,
    `[s1][v2]xfade=transition=dissolve:duration=${curlDur}:offset=${curlOffset}[s2]`,
    `[s2][v3]xfade=transition=wipeleft:duration=${sweepDur}:offset=${sweepOffset}[s3]`,
    `[s3]fade=t=out:st=${fadeOutStart}:d=${finalDur}[vout]`,
  );
}

let filterComplex = videoFilters.join(";");

// ── Build args: all -i inputs FIRST, then output options ──
const inputs = [
  "-f", "lavfi", "-i", `color=white:s=${outW}x${outH}:r=${fps}:d=0.033`,
  "-loop", "1", "-t", String(coverDur), "-i", coverImg,
  "-loop", "1", "-t", String(curlDur + sweepDur + 1), "-i", plainImg,
  "-loop", "1", "-t", String(holdDur + finalDur + 1), "-i", hlImg,
];

if (musicFile) {
  inputs.push("-i", musicFile);
  filterComplex += `;[4:a]volume=0.3[abgm]`;
}

const outputOpts = [
  "-filter_complex", filterComplex,
  "-map", "[vout]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "14",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
];

if (musicFile) {
  outputOpts.push("-map", "[abgm]", "-shortest");
}

const args = ["-y", ...inputs, ...outputOpts, outFile];

// ── Run ──
console.log(`🎬 生成: ${outFile}`);
console.log(`   ${outW}×${outH}, ~${totalDur.toFixed(1)}s`);

try {
  const start = Date.now();
  execFileSync(ffmpeg, args, { stdio: "inherit", timeout: 120000 });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ 完成 (${elapsed}s): ${outFile}`);
} catch (e) {
  console.error(`\n❌ FFmpeg 失败: ${e.message}`);
  process.exit(1);
}
