#!/usr/bin/env node
/**
 * 全流程串联测试 — 顺序执行步骤1→2→3→4
 *
 * 步骤2 需要 AI_API_KEY 环境变量
 * 步骤4 需要 ffmpeg
 *
 * 用法: node tests/run-all.mjs
 */
import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const steps = [
  { n: 1, script: "run-step-01.mjs", label: "抓取数据", skipWithout: null },
  { n: 2, script: "run-step-02.mjs", label: "AI 加工数据", skipWithout: "AI_API_KEY" },
  { n: 3, script: "run-step-03.mjs", label: "生成图片素材", skipWithout: null },
  { n: 4, script: "run-step-04.mjs", label: "生成视频", skipWithout: null },
];

console.log("═══════════════════════════════════════");
console.log("  Doc Flip — 全流程测试");
console.log("═══════════════════════════════════════\n");

let passed = 0;
let skipped = 0;
let failed = 0;

for (const step of steps) {
  if (step.skipWithout && !process.env[step.skipWithout]) {
    console.log(`○ 步骤${step.n} ${step.label} — 跳过 (缺 ${step.skipWithout})`);
    skipped++;
    continue;
  }

  console.log(`\n▶ 步骤${step.n} ${step.label}`);
  console.log("─".repeat(40));

  try {
    execFileSync("node", [join(__dirname, step.script)], {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 120000,
    });
    console.log(`\n✓ 步骤${step.n} 通过`);
    passed++;
  } catch (e) {
    console.error(`\n✗ 步骤${step.n} 失败`);
    failed++;
  }
}

console.log("\n" + "═".repeat(50));
console.log(`  结果: ${passed} 通过, ${skipped} 跳过, ${failed} 失败`);
console.log("═".repeat(50));

process.exit(failed > 0 ? 1 : 0);
