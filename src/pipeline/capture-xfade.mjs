#!/usr/bin/env node
// capture-xfade.mjs — Pure FFmpeg video generation using xfade-easing
// Uses custom FFmpeg for GLSL transitions, pipes to system FFmpeg for encoding

import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

// ── Find FFmpeg binaries ──
function findFFmpeg() {
  const custom = path.join(ROOT, "build", "ffmpeg-custom");
  const hasCustom = fs.existsSync(custom);
  return { custom, system: "ffmpeg", hasCustom };
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
const { custom: customFFmpeg, system: systemFFmpeg, hasCustom } = findFFmpeg();
if (hasCustom) {
  console.log(`🔧 自定义 FFmpeg: gl_swap + gl_InvertedPageCurl + wipeleft`);
} else {
  console.log(`🔧 系统 FFmpeg: fadeblack + dissolve + wipeleft`);
  console.log(`   💡 运行 bash scripts/build-ffmpeg-xfade.sh 可获得 curl 翻页效果`);
}

// ── Verify images ──
const coverImg = path.join(imgDir, "cover.png");
const plainImg = path.join(imgDir, "content-plain.png");
const hlImg = path.join(imgDir, "content-hl.png");
for (const img of [coverImg, plainImg, hlImg]) {
  if (!fs.existsSync(img)) { console.error(`❌ 缺少: ${img}`); process.exit(1); }
}

// ── Build filter_complex ──
const easing = "easing=cubic-in-out:";
const curlOffset = settleDur + coverDur;
const sweepOffset = curlOffset + curlDur;
const fadeOutStart = sweepOffset + sweepDur + holdDur;

const videoFilters = [
  `[0:v]scale=${outW}:${outH}[v0]`,
  `[1:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${coverDur},setpts=PTS-STARTPTS[v1]`,
  `[2:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${curlDur + sweepDur + 1},setpts=PTS-STARTPTS[v2]`,
  `[3:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${holdDur + finalDur + 1},setpts=PTS-STARTPTS[v3]`,
];

if (hasCustom) {
  videoFilters.push(
    `[v0][v1]xfade=${easing}transition='gl_swap(reflection=0.4,perspective=0.2,depth=3)':duration=${settleDur}:offset=0[s1]`,
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

const filterComplex = videoFilters.join(";");

// ── Run pipeline ──
console.log(`🎬 生成: ${outFile}`);
console.log(`   ${outW}×${outH}, ~${totalDur.toFixed(1)}s`);

const start = Date.now();

if (hasCustom) {
  // Custom FFmpeg → pipe (yuv4mpegpipe) → system FFmpeg (encode + audio)
  const customArgs = [
    "-y",
    "-f", "lavfi", "-i", `color=black:s=${outW}x${outH}:r=${fps}:d=0.033`,
    "-loop", "1", "-t", String(coverDur), "-i", coverImg,
    "-loop", "1", "-t", String(curlDur + sweepDur + 1), "-i", plainImg,
    "-loop", "1", "-t", String(holdDur + finalDur + 1), "-i", hlImg,
    "-filter_complex", filterComplex,
    "-map", "[vout]",
    "-c:v", "rawvideo", "-pix_fmt", "yuv420p",
    "-f", "yuv4mpegpipe", "-",
  ];

  const encodeArgs = [
    "-y", "-i", "pipe:0",
  ];
  if (musicFile) {
    encodeArgs.push("-i", musicFile);
  }
  encodeArgs.push(
    "-c:v", "libx264", "-preset", "slow", "-crf", "14",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  );
  if (musicFile) {
    encodeArgs.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  }
  encodeArgs.push(outFile);

  try {
    // Spawn custom FFmpeg (transitions) piped to system FFmpeg (encoding)
    const customProc = spawn(customFFmpeg, customArgs, { stdio: ["ignore", "pipe", "inherit"] });
    const encodeProc = spawn(systemFFmpeg, encodeArgs, { stdio: [customProc.stdout, "inherit", "inherit"] });

    await new Promise((resolve, reject) => {
      encodeProc.on("close", code => code === 0 ? resolve() : reject(new Error(`encode exit ${code}`)));
      customProc.on("close", code => { if (code !== 0) reject(new Error(`xfade exit ${code}`)); });
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ 完成 (${elapsed}s): ${outFile}`);
  } catch (e) {
    console.error(`\n❌ 失败: ${e.message}`);
    process.exit(1);
  }
} else {
  // Standard FFmpeg: all-in-one
  const args = [
    "-y",
    "-f", "lavfi", "-i", `color=black:s=${outW}x${outH}:r=${fps}:d=0.033`,
    "-loop", "1", "-t", String(coverDur), "-i", coverImg,
    "-loop", "1", "-t", String(curlDur + sweepDur + 1), "-i", plainImg,
    "-loop", "1", "-t", String(holdDur + finalDur + 1), "-i", hlImg,
    "-filter_complex", filterComplex,
    "-map", "[vout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  ];
  if (musicFile) {
    args.push("-i", musicFile, "-c:a", "aac", "-b:a", "128k", "-shortest");
  }
  args.push(outFile);

  try {
    execFileSync(systemFFmpeg, args, { stdio: "inherit", timeout: 120000 });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ 完成 (${elapsed}s): ${outFile}`);
  } catch (e) {
    console.error(`\n❌ 失败: ${e.message}`);
    process.exit(1);
  }
}

// ── Embed poster: extract 0.6s frame as video poster ──
try {
  const posterFrame = outFile + '.poster.png';
  const posterOut = outFile + '.poster.mp4';
  execFileSync(systemFFmpeg, ['-y', '-ss', '0.6', '-i', outFile, '-frames:v', '1', posterFrame], { stdio: 'pipe', timeout: 10000 });
  execFileSync(systemFFmpeg, ['-y', '-i', outFile, '-i', posterFrame, '-map', '0', '-map', '1', '-c', 'copy', '-disposition:v:1', 'attached_pic', '-movflags', '+faststart', posterOut], { stdio: 'pipe', timeout: 10000 });
  fs.renameSync(posterOut, outFile);
  fs.unlinkSync(posterFrame);
  console.log('🖼️  海报已嵌入 (0.6s 帧)');
} catch (e) {
  console.warn('⚠️  海报嵌入失败:', e.message);
}
