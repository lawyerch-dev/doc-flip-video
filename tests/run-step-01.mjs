#!/usr/bin/env node
/**
 * 步骤1 测试 — 抓取数据
 *
 * 用法: node tests/run-step-01.mjs [url]
 *   - 带 URL: 调用 API 抓取
 *   - 无参数: 使用 fixture 样本数据验证格式
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "fixtures", "step-01-scrape");
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("═══════════════════════════════════════");
console.log("  步骤1 测试 — 抓取数据");
console.log("═══════════════════════════════════════\n");

const url = process.argv[2];

if (!url) {
  // 验证 fixture 数据格式
  console.log("📋 使用 fixture 样本数据\n");

  const response = JSON.parse(readFileSync(join(FIXTURE_DIR, "sample-response.json"), "utf-8"));

  // 验证字段完整性
  const required = ["title", "text", "source", "url", "type"];
  const missing = required.filter((k) => !response[k]);
  if (missing.length > 0) {
    console.error(`❌ 样本数据缺少字段: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`  ✓ 标题: ${response.title.slice(0, 40)}...`);
  console.log(`  ✓ 来源: ${response.source}`);
  console.log(`  ✓ 正文: ${response.text.length} 字`);
  console.log(`  ✓ URL:  ${response.url}`);
  console.log(`\n✅ 样本数据验证通过\n`);

  writeFileSync(join(OUTPUT_DIR, "step-01-result.json"), JSON.stringify(response, null, 2));
  console.log(`  结果已保存: tests/output/step-01-result.json`);
} else {
  // 通过 API 测试真实抓取（需要服务运行中）
  console.log(`🌐 抓取: ${url}\n`);
  const BASE = process.env.API_BASE || "http://localhost:33011";
  try {
    const r = await fetch(`${BASE}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    console.log(`  ✓ 标题: ${data.title?.slice(0, 40)}...`);
    console.log(`  ✓ 正文: ${data.text?.length} 字`);
    console.log(`  ✓ 来源: ${data.source}`);
    writeFileSync(join(OUTPUT_DIR, "step-01-result.json"), JSON.stringify(data, null, 2));
    console.log(`\n✅ 抓取成功 (tests/output/step-01-result.json)`);
  } catch (e) {
    console.error(`❌ 抓取失败: ${e.message}`);
    console.error(`   提示: 确保服务在 ${BASE} 运行中`);
    process.exit(1);
  }
}
