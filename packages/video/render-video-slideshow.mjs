#!/usr/bin/env node
// render-video-slideshow.mjs — 幻灯片风格视频模板
// 使用标准 xfade 转场（dissolve），不需要自定义 FFmpeg
// 节奏舒缓，适合信息型内容

import { execFileSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROOT, TEMP_DIR, OUTPUT_DIR } from "@doc-flip/shared";
import { getEffect } from "./effects.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load config ──
const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node render-video-slideshow.mjs <config.json>");
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

// ── Timing (slideshow 节奏) ──
const settleDur = 0.5;            // 首帧静置
const coverDur = tm.cover || 3.0; // 封面停留
const xfadeDur = 1.0;             // 转场时长
const sceneDur = tm.curl || 2.5;  // 每页停留 (复用 curl 字段)
const finalDur = tm.final || 1.5; // 尾部淡出

const totalDur = settleDur + coverDur + xfadeDur + sceneDur + xfadeDur + sceneDur + finalDur;

// ── Pick background music ──
const musicDir = path.join(ROOT, "assets", "music");
const musicFiles = fs.readdirSync(musicDir).filter((f) => f.match(/\.(mp3|wav|ogg|m4a)$/i));
const musicFile =
  musicFiles.length > 0 ? path.join(musicDir, musicFiles[Math.floor(Math.random() * musicFiles.length)]) : null;
if (musicFile) console.log(`🎵 ${path.basename(musicFile)}`);

console.log(`🔧 幻灯片模板: dissolve 转场（无 GLSL 依赖）`);

// ── 转场效果解析 ──
const st = cfg.meta?.sceneTransitions || [];

function resolveTransition(idx, defaultEffect) {
  const t = st[idx];
  if (!t || !t.effect) return defaultEffect;
  const eff = getEffect(t.effect);
  if (!eff) {
    console.warn(`⚠️  未知效果 "${t.effect}"，使用默认`);
    return defaultEffect;
  }
  // slideshow 用系统 ffmpeg，不支持 GLSL 着色器
  if (eff.shader.startsWith('gl_')) {
    console.warn(`⚠️  "${t.effect}" 是 GLSL 着色器，slideshow 不支持，降级为 dissolve`);
    return 'dissolve';
  }
  return eff.shader;
}

const t1 = resolveTransition(0, 'dissolve'); // settle → cover
const t2 = resolveTransition(1, 'dissolve'); // cover → plain
const t3 = resolveTransition(2, 'dissolve'); // plain → hl
console.log(`🔧 转场: ${t1} → ${t2} → ${t3}`);

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

// ── Build filter_complex ──
// Timeline:
//   [0] 纯色背景 settle
//   [1] cover (停留 coverDur，然后 dissolve 至下一张)
//   [2] plain (停留 sceneDur，然后 dissolve 至下一张)
//   [3] hl (停留 sceneDur，然后 fade out)

const f1 = settleDur;                        // settle → cover xfade offset
const f2 = f1 + xfadeDur + coverDur;         // cover → plain xfade offset
const f3 = f2 + xfadeDur + sceneDur;          // plain → hl xfade offset
const fadeOutStart = f3 + xfadeDur + sceneDur;

const videoFilters = [
  // 所有图片输入统一时长（避免提前截断）
  `[0:v]scale=${outW}:${outH}[v0]`,
  `[1:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${totalDur + 1},setpts=PTS-STARTPTS[v1]`,
  `[2:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${totalDur + 1},setpts=PTS-STARTPTS[v2]`,
  `[3:v]fps=${fps},scale=${outW}:${outH},setpts=PTS-STARTPTS,trim=duration=${totalDur + 1},setpts=PTS-STARTPTS[v3]`,
  // xfade 串联（不加 easing，兼容系统 ffmpeg）
  `[v0][v1]xfade=transition=${t1}:duration=${xfadeDur}:offset=0[s1]`,
  `[s1][v2]xfade=transition=${t2}:duration=${xfadeDur}:offset=${f2}[s2]`,
  `[s2][v3]xfade=transition=${t3}:duration=${xfadeDur}:offset=${f3}[s3]`,
  // 末尾淡出 + 裁剪到总时长
  `[s3]fade=t=out:st=${fadeOutStart}:d=${finalDur},trim=duration=${totalDur},setpts=PTS-STARTPTS[vout]`,
];
const filterComplex = videoFilters.join(";");

// ── Run pipeline ──
console.log(`🎬 生成: ${outFile}`);
console.log(`   ${outW}×${outH}, ~${totalDur.toFixed(1)}s`);

const start = Date.now();

const ffmpegArgs = [
  "-y",
];

// 所有输入放最前面
ffmpegArgs.push(
  "-f", "lavfi", "-i", `color=white:s=${outW}x${outH}:r=${fps}:d=${totalDur}`,
  "-loop", "1", "-t", String(totalDur), "-i", coverImg,
  "-loop", "1", "-t", String(totalDur), "-i", plainImg,
  "-loop", "1", "-t", String(totalDur), "-i", hlImg,
);

if (musicFile) {
  ffmpegArgs.push("-i", musicFile);
}

// filter + map + 编码选项放中间
ffmpegArgs.push(
  "-filter_complex", filterComplex,
  "-map", "[vout]",
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "16",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
);

if (musicFile) {
  ffmpegArgs.push("-c:a", "aac", "-b:a", "128k", "-shortest");
} else {
  ffmpegArgs.push("-an");
}

// 输出文件最后
ffmpegArgs.push(outFile);

try {
  execFileSync("ffmpeg", ffmpegArgs, { stdio: "inherit", timeout: 120000 });
  console.log(`\n✅ 完成 (${((Date.now() - start) / 1000).toFixed(1)}s): ${outFile}`);
} catch (e) {
  console.error(`\n❌ 失败: ${e.message}`);
  process.exit(1);
}

// ── Embed poster: extract first good frame as poster ──
try {
  const posterClip = outFile.replace(".mp4", ".poster-clip.mp4");
  const posterOut = outFile.replace(".mp4", ".poster-out.mp4");
  const posterTime = 1.5; // cover 完全可见后
  const posterFrame = outFile.replace(".mp4", "-poster.png");
  const oldPoster = outFile.replace(".mp4", "-poster.png");

  // 清理旧文件
  if (fs.existsSync(oldPoster)) fs.unlinkSync(oldPoster);
  if (fs.existsSync(posterClip)) fs.unlinkSync(posterClip);

  // 提取海报帧
  execFileSync("ffmpeg", ["-y", "-ss", String(posterTime), "-i", outFile, "-frames:v", "1", "-q:v", "2", posterFrame], {
    stdio: "pipe",
    timeout: 10000,
  });

  // 创建 1 帧视频片段
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

  // 拼贴：poster 帧 + 原始视频（跳过 settle）
  const concatArgs = [
    "-y",
    "-i",
    posterClip,
    "-ss",
    "1.5",
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
    "16",
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

  execFileSync("ffmpeg", concatArgs, { stdio: "pipe", timeout: 30000 });
  fs.renameSync(posterOut, outFile);
  fs.unlinkSync(posterClip);
  console.log(`🖼️  海报已置为视频首帧 (${posterTime.toFixed(2)}s 帧)`);
} catch (e) {
  console.warn("⚠️  海报嵌入失败:", e.message);
}
