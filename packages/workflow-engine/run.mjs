#!/usr/bin/env node
/**
 * 简化工作流引擎 - CLI 入口
 *
 * 用法：
 *   node packages/workflow-engine/run.mjs <workflow.json> [--config <article.json>]
 *   node packages/workflow-engine/run.mjs --demo
 */

import fs from "fs";
import path from "path";
import { ROOT, TEMP_DIR } from "../../config/paths.mjs";
import { run, runFromFile } from "./engine.mjs";
import { createEmptyWorkflow, getDefaultCanvas } from "./types.mjs";

// ── 解析参数 ──

function parseArgs() {
  const args = process.argv.slice(2);
  let workflowPath = null;
  let configPath = null;
  let demo = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && args[i + 1]) {
      configPath = args[++i];
    } else if (args[i] === "--demo") {
      demo = true;
    } else if (!args[i].startsWith("--")) {
      workflowPath = args[i];
    }
  }

  // 解析相对路径
  if (workflowPath && !workflowPath.startsWith("/")) {
    workflowPath = path.join(ROOT, workflowPath);
  }
  if (configPath && !configPath.startsWith("/")) {
    configPath = path.join(ROOT, configPath);
  }

  return { workflowPath, configPath, demo };
}

// ── Demo 工作流 ──

function createDemoWorkflow(configPath) {
  // 读取文章配置
  let issueNum = "001";
  let coverPath = path.join(TEMP_DIR, "issue-001", "cover.png");
  let contentPlainPath = path.join(TEMP_DIR, "issue-001", "content-plain.png");
  let contentHlPath = path.join(TEMP_DIR, "issue-001", "content-hl.png");

  if (configPath && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    issueNum = String(config.meta?.issueNumber || 1).padStart(3, "0");
    coverPath = path.join(TEMP_DIR, `issue-${issueNum}`, "cover.png");
    contentPlainPath = path.join(TEMP_DIR, `issue-${issueNum}`, "content-plain.png");
    contentHlPath = path.join(TEMP_DIR, `issue-${issueNum}`, "content-hl.png");
  }

  return {
    name: `法务视频-${issueNum}期`,
    canvas: getDefaultCanvas(),
    variables: { issueNumber: parseInt(issueNum) },
    nodes: [
      {
        id: "cover",
        name: "封面",
        content: {
          kind: "image",
          source: coverPath,
        },
        effects: [
          { type: "hold", params: { duration: 2.0 } },
          {
            type: "transition",
            params: {
              duration: 2.5,
              transition: "page-curl",
              easing: "cubic-in-out",
            },
          },
        ],
      },
      {
        id: "content-plain",
        name: "内容页（普通）",
        content: {
          kind: "image",
          source: contentPlainPath,
        },
        effects: [
          { type: "hold", params: { duration: 3.0 } },
          {
            type: "transition",
            params: {
              duration: 2.0,
              transition: "wipeleft",
              easing: "cubic-in-out",
            },
          },
        ],
      },
      {
        id: "content-hl",
        name: "内容页（高亮）",
        content: {
          kind: "image",
          source: contentHlPath,
        },
        effects: [
          { type: "hold", params: { duration: 2.0 } },
          { type: "fade-out", params: { duration: 2.0 } },
        ],
      },
    ],
    audio: {
      source: path.join(ROOT, "assets", "music"),
      fadeIn: { duration: 2.0 },
      fadeOut: { duration: 3.0 },
    },
    output: {
      filename: `法务视频-${issueNum}期-v2.mp4`,
    },
  };
}

// ── 主函数 ──

async function main() {
  const { workflowPath, configPath, demo } = parseArgs();

  try {
    let result;

    if (demo) {
      // Demo 模式：使用预设工作流
      console.log("🎯 Demo 模式");
      const workflow = createDemoWorkflow(configPath);
      result = await run(workflow, { configPath });
    } else if (workflowPath) {
      // 从文件加载工作流
      console.log(`📂 加载工作流: ${workflowPath}`);
      result = await runFromFile(workflowPath, { configPath });
    } else {
      // 显示帮助
      console.log(`
简化工作流引擎 v2

用法：
  node packages/workflow-engine/run.mjs <workflow.json> [--config <article.json>]
  node packages/workflow-engine/run.mjs --demo [--config <article.json>]

示例：
  # 使用 demo 工作流
  node packages/workflow-engine/run.mjs --demo --config data/articles/article-001.json

  # 使用自定义工作流
  node packages/workflow-engine/run.mjs data/workflows/my-workflow.json

  # 查看可用转场
  node packages/workflow-engine/run.mjs --list-transitions
      `);
      process.exit(0);
    }

    console.log(`\n✅ 完成！`);
    console.log(`📁 输出: ${result.outputFile}`);
    console.log(`⏱️  时长: ${result.duration.toFixed(1)}s`);
  } catch (e) {
    console.error(`\n❌ 错误: ${e.message}`);
    process.exit(1);
  }
}

main();
