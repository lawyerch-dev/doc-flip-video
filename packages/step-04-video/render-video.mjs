#!/usr/bin/env node
// render-video.mjs — 视频合成调度器
// 根据 config.meta.videoTemplate 转发到对应模板文件
// 默认为 flip-book，新增模板只需创建 render-video-{name}.mjs

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node render-video.mjs <config.json>");
  process.exit(1);
}

// 读取 config 获取 videoTemplate
const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const template = cfg.meta?.videoTemplate || "flip-book";

const scriptPath = path.join(__dirname, `render-video-${template}.mjs`);
if (!fs.existsSync(scriptPath)) {
  console.error(`❌ 未知的视频模板: ${template}`);
  console.error(`   期望文件: ${scriptPath}`);
  process.exit(1);
}

console.log(`🎬 视频模板: ${template}`);
execFileSync("node", [scriptPath, configPath], { stdio: "inherit" });
