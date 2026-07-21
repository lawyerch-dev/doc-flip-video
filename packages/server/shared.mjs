import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync, execFile, execSync, spawn } from "child_process";
import { randomUUID } from "crypto";

// ── Re-export shared paths, settings, and utils ──
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
  getSettings,
  updateSettings,
  saveSettings,
  nextIssueNumber,
  today,
  json,
  errorResponse,
  readBody,
  readBuffer,
  parseJson,
} from "@doc-flip/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || getSettings().port || 33011;

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

// ── Exports ──
export { ROOT, WEB_DIR, CONFIGS_DIR, TEMP_DIR, OUTPUT_DIR, PROJECTS_DIR, TEMPLATES_DIR, TEMPLATE_PATH };
export { __dirname as DIRNAME };
export { MIME, json, errorResponse, readBody, readBuffer, parseJson, nextIssueNumber, today, defaultTemplate };
export { http, fs, path, fileURLToPath, execFileSync, execFile, execSync, spawn, randomUUID };
export { PORT, getSettings, updateSettings, saveSettings };
