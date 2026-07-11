#!/usr/bin/env node
/**
 * index.mjs — 视频构建入口
 *
 * 默认（向后兼容）：
 *   node packages/engine/index.mjs data/articles/article-001.json
 *   → render-images.mjs + render-video.mjs
 *
 * 工作流模式（--workflow 显式指定）：
 *   node packages/engine/index.mjs --workflow workflows/article-default.json --config data/articles/article-001.json
 *   → render-images.mjs + workflow engine
 */

import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

function main() {
  const args = process.argv.slice(2);
  let useWorkflow = args.includes("--workflow");
  let workflowPath = null;
  let configPath = null;

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workflow" && args[i + 1]) {
      workflowPath = args[++i];
    } else if (args[i] === "--config" && args[i + 1]) {
      configPath = args[++i];
    } else if (!args[i].startsWith("--")) {
      configPath = args[i];
    }
  }

  // 解析 config 路径
  if (configPath && !configPath.startsWith("/")) {
    configPath = path.join(ROOT, configPath);
  }
  // 默认 config
  if (!configPath) {
    configPath = path.join(ROOT, "data", "articles", "article-001.json");
  }

  if (useWorkflow && workflowPath) {
    // 工作流模式
    if (workflowPath && !workflowPath.startsWith("/")) {
      workflowPath = path.join(ROOT, workflowPath);
    }

    console.log(`📄 Config: ${configPath}`);
    console.log(`📋 Workflow: ${workflowPath}`);

    // 渲染页面
    console.log("─── Generating images ───");
    execFileSync("node", [path.join(__dirname, "render-images.mjs"), configPath], {
      stdio: "inherit",
    });

    // 运行工作流引擎
    console.log("─── Rendering video (workflow) ───");
    execFileSync("node", [path.join(ROOT, "packages", "workflow-engine", "run.mjs"), workflowPath, "--config", configPath], {
      stdio: "inherit",
    });
  } else {
    // 旧流水线模式（向后兼容）
    console.log(`📄 Config: ${configPath}`);
    console.log("─── Generating images ───");
    execFileSync("node", [path.join(__dirname, "render-images.mjs"), configPath], {
      stdio: "inherit",
    });
    console.log("─── Rendering video ───");
    const captureScript =
      process.env.CAPTURE === "puppeteer" ? "render-video-puppeteer.mjs" : "render-video.mjs";
    execFileSync("node", [path.join(__dirname, captureScript), configPath], {
      stdio: "inherit",
    });
  }
}

main();
