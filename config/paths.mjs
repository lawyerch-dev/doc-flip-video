/**
 * 项目中所有关键路径的集中配置。
 * 修改目录结构时只需更新此文件。
 */
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

// ── 包目录 ──
export const ENGINE_DIR = path.join(ROOT, "packages", "engine");
export const FRONTEND_DIR = path.join(ROOT, "packages", "frontend");
export const SERVER_DIR = path.join(ROOT, "packages", "server");
export const MCP_DIR = path.join(ROOT, "packages", "mcp");
export const WORKFLOW_ENGINE_DIR = path.join(ROOT, "packages", "workflow-engine");

// ── 数据目录（可通过 DATA_DIR 环境变量覆盖）──
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
export const ARTICLES_DIR = path.join(DATA_DIR, "articles");
export const TEMP_DIR = path.join(DATA_DIR, "temp");
export const OUTPUT_DIR = path.join(DATA_DIR, "output");

// ── 模板 ──
export const TEMPLATES_DIR = path.join(ENGINE_DIR, "templates");
export const TEMPLATE_PATH = path.join(TEMPLATES_DIR, "default.json");

// ── 引擎脚本 ──
export const RENDER_IMAGES_SCRIPT = path.join(ENGINE_DIR, "render-images.mjs");
export const ENGINE_ENTRY = path.join(ENGINE_DIR, "index.mjs");

// ── 素材 ──
export const FRONTEND_ASSETS = path.join(ROOT, "assets");

// ── 工作流 ──
export const WORKFLOW_RUNNER = path.join(WORKFLOW_ENGINE_DIR, "run.mjs");
export const WORKFLOW_TEMP = path.join(TEMP_DIR, "workflow-to-run.json");

// ── 配置 ──
export const SETTINGS_PATH = path.join(ROOT, "config", "settings.json");
