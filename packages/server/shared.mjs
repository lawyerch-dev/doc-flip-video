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
  PROJECTS_DIR,
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
    aiTemperature: 0.3,
    defaultDescription: "法理明如镜，务知天下事！",
    coverTagline: "法务视频",
    port: 33011,
    defaultSource: "https://www.chinacourt.cn/article/index/id/MzAwNDAwNTBIApMEAAA.shtml",
    enableScoring: false,
    sourceName: "中国法院网",
    headlinePrompt: "生成 3 个爆款标题（≤20字），有悬念、冲突或好奇心",
    contentPrompt:
      '你是一个法律短视频内容编辑专家。请从法律文章中提炼出让普通人想停下来看的短视频内容。\n\n核心原则：用日常称呼代替法律角色，每段 50-80 字。\n\n## 高亮铁律（违反则高亮消失）\nhighlight 必须是 explanation 的**原文连续片段**，逐字匹配，不能增删改。\n如果段落原文说"点"本人签收""，高亮写"点击"本人签收""就是错的——多了一个字，渲染引擎匹配不到。\n正例：原文"用户没选保价，就得按协议赔" → 高亮"用户没选保价"。\n无合适原文时 highlight 返回空字符串。\n禁用法律术语高亮。',
    publishPrompt:
      "你是一个短视频发布助手。生成发布用的标题和介绍。标题20字以内，介绍100字以内。末尾空一行后加5个以上话题标签，包含通用标签（#法律 #普法）和视频核心关键词标签。",
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
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

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
  return true;
}

export function errorResponse(res, message, status = 500, details = null) {
  return json(res, { error: message, details, timestamp: new Date().toISOString() }, status);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error("请求体不能超过 100MB"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error("请求体不能超过 100MB"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
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
export { ROOT, WEB_DIR, CONFIGS_DIR, TEMP_DIR, OUTPUT_DIR, PROJECTS_DIR, TEMPLATES_DIR, TEMPLATE_PATH };
export { __dirname as DIRNAME };
export { MIME, json, readBody, readBuffer, parseJson, nextIssueNumber, today, defaultTemplate };
export { http, fs, path, fileURLToPath, execFileSync, execFile, execSync, spawn, randomUUID };
export { PORT, saveSettings };
