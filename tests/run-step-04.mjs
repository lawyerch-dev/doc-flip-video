#!/usr/bin/env node
/**
 * 步骤4 测试 — 生成视频
 *
 * 用法: node tests/run-step-04.mjs [config.json]
 *   - 带配置: 用指定配置渲染视频
 *   - 无参数: 用 fixture 样本数据渲染
 *
 * 前置: 需要步骤3生成的图片（或已有 tests/output/temp/issue-099/ 目录）
 * 输出: tests/output/法务视频-099期.mp4
 */
import { existsSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "fixtures", "step-04-video");
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("═══════════════════════════════════════");
console.log("  步骤4 测试 — 生成视频");
console.log("═══════════════════════════════════════\n");

const configPath = process.argv[2] || join(FIXTURE_DIR, "sample-config.json");

if (!existsSync(configPath)) {
  console.error(`❌ 配置不存在: ${configPath}`);
  process.exit(1);
}

console.log(`📄 配置: ${configPath}\n`);

const ROOT = resolve(__dirname, "..");

// 检查 ffmpeg
try {
  execFileSync("which", ["ffmpeg"], { stdio: "ignore" });
  console.log("  ✓ ffmpeg 已安装");
} catch {
  console.error("❌ 需要 ffmpeg: brew install ffmpeg");
  process.exit(1);
}

const hasCustomFFmpeg = existsSync(join(ROOT, "packages", "backend", "orchestrator", "build", "ffmpeg-darwin-arm64"));
console.log(`  ${hasCustomFFmpeg ? "✓" : "○"} 自定义 FFmpeg: ${hasCustomFFmpeg ? "可用 (GLSL 转场)" : "未编译 (降级 dissolve)"}\n`);

// 步骤4 的 CLI: node packages/step-04-video/index.mjs <config.json>
// 它根据 config.meta.videoTemplate 路由到 render-video-{template}.mjs
const videoEntry = join(ROOT, "packages", "step-04-video", "index.mjs");
if (!existsSync(videoEntry)) {
  console.error(`❌ 视频入口不存在: ${videoEntry}`);
  process.exit(1);
}

console.log("🎬 生成视频...\n");
try {
  execFileSync("node", [videoEntry, configPath], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 60000,
    env: {
      ...process.env,
      DATA_DIR: join(OUTPUT_DIR, ".."),
    },
  });
  console.log(`\n✅ 视频生成完成`);
  console.log(`   输出目录: tests/output/`);
} catch (e) {
  console.error(`\n❌ 视频生成失败 (exit code: ${e.status})`);
  process.exit(1);
}
