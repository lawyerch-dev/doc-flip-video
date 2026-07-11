#!/usr/bin/env node
/**
 * workflow/run.mjs — 工作流引擎 CLI 入口
 *
 * 分两步：
 *   1. 调用 gen-pages.mjs 渲染页面图片
 *   2. 调用 workflow engine 构建视频
 *
 * 用法：
 *   node src/workflow/run.mjs workflows/article-default.json --config data/articles/article-001.json
 *   node src/workflow/run.mjs data/articles/article-001.json  （自动使用默认 workflow）
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

import { WorkflowEngine } from "./engine.mjs";
import { BUILTIN_PLUGINS } from "./plugins/index.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  let workflowPath = args[0] || 'data/temp/workflow-to-run.json';
  let configPath = null;
  let templatePath = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) configPath = args[++i];
    else if (args[i] === '--template' && args[i + 1]) templatePath = args[++i];
  }

  // Resolve relative paths
  for (const p of ['workflowPath', 'configPath', 'templatePath']) {
    const val = eval(p);
    if (val && !val.startsWith('/')) {
      eval(`${p} = path.join(ROOT, val)`);
    }
  }

  return { workflowPath, configPath, templatePath };
}

async function main() {
  const { workflowPath, configPath, templatePath } = parseArgs();

  // 1. 渲染页面图片（跳过如果已存在，避免双倍调用）
  if (configPath && fs.existsSync(configPath)) {
    const article = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const issueNum = String(article.meta?.issueNumber || 0).padStart(3, "0");
    const imgDir = path.join(ROOT, "data", "temp", `issue-${issueNum}`);
    const coverPath = path.join(imgDir, "cover.png");
    if (!fs.existsSync(coverPath)) {
      console.log("─── Generating images ───");
      const genPages = path.join(ROOT, "packages", "pipeline", "gen-pages.mjs");
      execFileSync("node", [genPages, configPath], { stdio: "inherit" });
    } else {
      console.log("  图片已存在，跳过渲染");
    }
  } else {
    console.log("⚠️  未指定 config，跳过图片渲染");
  }

  // 2. 加载工作流
  if (!fs.existsSync(workflowPath)) {
    console.error(`❌ 工作流文件不存在: ${workflowPath}`);
    process.exit(1);
  }
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf-8"));
  console.log(`📋 工作流: ${workflow.name || workflowPath}`);

  // 注入 article config 信息
  if (configPath && fs.existsSync(configPath)) {
    const article = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    workflow.variables = workflow.variables || {};
    workflow.variables.issueNumber = article.meta?.issueNumber || 0;
  }

  console.log("─── Rendering video ───");

  // 3. 创建并运行引擎
  const engine = new WorkflowEngine();
  engine.registerAll(BUILTIN_PLUGINS);

  const result = await engine.run(workflow, {
    configPath,
    templatePath,
    params: { configPath, templatePath },
  });

  console.log(`\n✅ 输出: ${result.outputFile}`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
