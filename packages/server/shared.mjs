import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, execFile, execSync, spawn } from "child_process";
import { randomUUID } from "crypto";
import {
  ROOT,
  FRONTEND_DIR as WEB_DIR,
  ARTICLES_DIR as CONFIGS_DIR,
  TEMP_DIR,
  OUTPUT_DIR,
  TEMPLATES_DIR,
  TEMPLATE_PATH,
  SETTINGS_PATH,
} from "../../config/paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Settings: load from file, fallback to env vars ──
function loadSettings() {
  const defaults = {
    aiBaseUrl: "https://api.openai.com/v1",
    aiApiKey: "",
    aiModel: "deepseek-v4-flash",
    defaultDescription: "法理明如镜，务知天下事！",
    coverTagline: "法务视频",
    port: 33011,
    defaultSource: "https://www.chinacourt.cn/article/index/id/MzAwNDAwNTBIApMEAAA.shtml",
    enableScoring: false,
    sourceName: "中国法院网",
    headlinePrompt: "生成 3 个爆款标题（≤20字），有悬念、冲突或好奇心。只返回 JSON 数组。",
    scoringPrompt:
      "请根据以下标准为文章打分：\n- 话题热度和关注度（是否是近期热点）\n- 内容通俗程度（是否适合普通观众）\n- 实用价值（观众能否从中获得有用信息）\n- 故事性和吸引力（是否有具体案例或故事）",
  };
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
      return { ...defaults, ...saved };
    }
  } catch {}
  // Fallback to env vars if no settings file
  return {
    ...defaults,
    aiBaseUrl: process.env.AI_BASE_URL || defaults.aiBaseUrl,
    aiApiKey: process.env.AI_API_KEY || defaults.aiApiKey,
    aiModel: process.env.AI_MODEL || defaults.aiModel,
    port: parseInt(process.env.PORT, 10) || defaults.port,
  };
}

function saveSettings(s) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

let _settings = loadSettings();

export function getSettings() {
  return _settings;
}

export function updateSettings(s) {
  _settings = { ..._settings, ...s };
  saveSettings(_settings);
}

const PORT = process.env.PORT || _settings.port || 33011;

fs.mkdirSync(CONFIGS_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const defaultTemplate = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));

// ── MIME types ──
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

// ── Helpers ──
function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

export function errorResponse(res, message, status = 500, details = null) {
  json(res, { error: message, details, timestamp: new Date().toISOString() }, status);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function parseJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function nextIssueNumber() {
  const existing = fs
    .readdirSync(CONFIGS_DIR)
    .filter((f) => f.startsWith("article-") && f.endsWith(".json"))
    .map((f) => parseInt(f.match(/article-(\d+)\.json/)?.[1] || "0", 10));
  return (existing.length ? Math.max(...existing) : 0) + 1;
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

// ── Exports ──
export { ROOT, WEB_DIR, CONFIGS_DIR, TEMP_DIR, OUTPUT_DIR, TEMPLATES_DIR, TEMPLATE_PATH };
export { __dirname as DIRNAME };
export { MIME, json, readBody, parseJson, nextIssueNumber, today, defaultTemplate };
export { http, fs, path, fileURLToPath, execFileSync, execFile, execSync, spawn, randomUUID };
export { PORT, saveSettings };
