import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, execFile, execSync, spawn } from "child_process";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const WEB_DIR = path.join(ROOT, "web");
const CONFIGS_DIR = path.join(ROOT, "configs");
const TEMP_DIR = path.join(ROOT, "temp");
const OUTPUT_DIR = path.join(ROOT, "output");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const TEMPLATE_PATH = path.join(ROOT, "template.json");

const SETTINGS_PATH = path.join(CONFIGS_DIR, "settings.json");

// ── Settings: load from file, fallback to env vars ──
function loadSettings() {
  const defaults = {
    aiBaseUrl: "https://api.openai.com/v1",
    aiApiKey: "",
    aiModel: "deepseek-v4-flash",
    defaultDescription: "法理明如镜，务知天下事！",
    coverTagline: "法务视频",
    port: 33011,
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
  _settings = s;
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
    req.on("data", c => (body += c));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function parseJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function nextIssueNumber() {
  const existing = fs.readdirSync(CONFIGS_DIR)
    .filter(f => f.startsWith("article-") && f.endsWith(".json"))
    .map(f => parseInt(f.match(/article-(\d+)\.json/)?.[1] || "0", 10));
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
