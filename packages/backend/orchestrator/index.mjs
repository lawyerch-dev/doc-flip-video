#!/usr/bin/env node
/**
 * index.mjs — 视频构建入口
 *
 * node packages/orchestrator/index.mjs data/articles/article-001.json
 * → render-images.mjs + render-video.mjs
 */

import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

function main() {
  const args = process.argv.slice(2);
  let configPath = null;

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      configPath = args[i];
    }
  }

  if (configPath && !configPath.startsWith("/")) {
    configPath = path.join(ROOT, configPath);
  }
  if (!configPath) {
    configPath = path.join(ROOT, "data", "articles", "article-001.json");
  }

  console.log(`📄 Config: ${configPath}`);
  console.log("─── Generating images ───");
  execFileSync("node", [path.join(ROOT, "packages", "step-03-render", "render-images.mjs"), configPath], {
    stdio: "inherit",
  });
  console.log("─── Rendering video ───");
  const captureScript =
    process.env.CAPTURE === "puppeteer"
      ? path.join(ROOT, "packages", "step-04-video", "render-video-puppeteer.mjs")
      : path.join(ROOT, "packages", "step-04-video", "render-video.mjs");
  execFileSync("node", [captureScript, configPath], {
    stdio: "inherit",
  });
}

main();
