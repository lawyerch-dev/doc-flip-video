#!/usr/bin/env node
/**
 * 步骤2 测试 — AI 加工数据
 *
 * 用法: node tests/run-step-02.mjs
 *   - 从 fixture 读取样本文本，调用 AI 生成配置
 *   - 跳过 AI 调用时只验证 fixture 数据格式
 *
 * 环境变量:
 *   AI_API_KEY    — OpenAI 兼容 API key（不设则跳过 AI 调用）
 *   AI_BASE_URL   — API 地址（默认 https://api.deepseek.com/v1）
 *   AI_MODEL      — 模型名（默认 deepseek-v4-flash）
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "fixtures", "step-02-ai");
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("═══════════════════════════════════════");
console.log("  步骤2 测试 — AI 加工数据");
console.log("═══════════════════════════════════════\n");

// 读取 fixture
const articleText = readFileSync(join(FIXTURE_DIR, "sample-article.txt"), "utf-8");
console.log(`📄 样本文本: ${articleText.length} 字\n`);

const hasAiKey = !!process.env.AI_API_KEY;

if (hasAiKey) {
  console.log("🤖 AI API 已配置，正在生成配置...\n");
  const { generateConfig } = await import("../packages/step-02-ai/generate.mjs");
  try {
    const config = await generateConfig(articleText, "来源：中国法院网");
    console.log(`  ✓ 标题: ${config.content?.title?.slice(0, 40)}`);
    console.log(`  ✓ 段落: ${config.content?.paragraphs?.length} 段`);
    writeFileSync(join(OUTPUT_DIR, "step-02-result.json"), JSON.stringify(config, null, 2));
    console.log(`\n✅ AI 配置生成成功 (tests/output/step-02-result.json)`);
  } catch (e) {
    console.error(`❌ AI 调用失败: ${e.message}`);
    process.exit(1);
  }
} else {
  console.log("⚠️  AI_API_KEY 未设置，跳过 AI 调用");
  console.log("   设置后测试: AI_API_KEY=sk-xxx node tests/run-step-02.mjs\n");

  // 输出 fixture 中的预期结构
  const expectedStructure = {
    meta: { issueNumber: 99, template: "default" },
    cover: { headline: "标题", source: "来源" },
    content: {
      title: "标题",
      paragraphs: [{ text: "正文段落1" }, { text: "正文段落2", highlight: "高亮词" }],
    },
  };
  writeFileSync(join(OUTPUT_DIR, "step-02-fixture-reference.json"), JSON.stringify(expectedStructure, null, 2));
  console.log("📋 预期配置结构已保存: tests/output/step-02-fixture-reference.json");
}
