#!/usr/bin/env node
/**
 * 步骤3 测试 — 生成图片素材
 *
 * 用法: node tests/run-step-03.mjs [config.json]
 *   - 带配置: 用指定配置渲染图片
 *   - 无参数: 用 fixture 样本数据渲染
 *
 * 输出: tests/output/issue-099/
 */
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "fixtures", "step-03-render");
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("═══════════════════════════════════════");
console.log("  步骤3 测试 — 生成图片素材");
console.log("═══════════════════════════════════════\n");

const configPath = process.argv[2] || join(FIXTURE_DIR, "sample-config.json");

if (!existsSync(configPath)) {
  console.error(`❌ 配置不存在: ${configPath}`);
  process.exit(1);
}

console.log(`📄 配置: ${configPath}\n`);

const ROOT = resolve(__dirname, "..");

// 步骤3 的 CLI: node packages/step-03-render/render-images.mjs <config.json> [template.json]
const renderScript = join(ROOT, "packages", "step-03-render", "render-images.mjs");
const templateDir = join(ROOT, "packages", "step-03-render", "templates");
const defaultTemplate = join(templateDir, "default.json");

if (!existsSync(renderScript)) {
  console.error(`❌ 渲染脚本不存在: ${renderScript}`);
  process.exit(1);
}

console.log("🎨 渲染图片...\n");
try {
  execFileSync("node", [renderScript, configPath, defaultTemplate], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 30000,
    env: {
      ...process.env,
      DATA_DIR: join(OUTPUT_DIR, ".."), // 输出到 tests/output/
    },
  });
  console.log(`\n✅ 图片渲染完成`);
  console.log(`   输出目录: tests/output/temp/issue-099/`);
} catch (e) {
  console.error(`\n❌ 渲染失败 (exit code: ${e.status})`);
  process.exit(1);
}
