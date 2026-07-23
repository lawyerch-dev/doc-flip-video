/**
 * 项目中所有关键路径的集中配置。
 * 修改目录结构时只需更新此文件。
 */
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");

// ── 包目录 ──
export const ENGINE_DIR = path.join(ROOT, "packages", "engine");
export const FRONTEND_DIR = path.join(ROOT, "packages", "frontend");
export const SERVER_DIR = path.join(ROOT, "packages", "server");
export const MCP_DIR = path.join(ROOT, "packages", "mcp");

// ── 数据目录（可通过 DATA_DIR 环境变量覆盖）──
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
export const ARTICLES_DIR = path.join(DATA_DIR, "articles");
export const TEMP_DIR = path.join(DATA_DIR, "temp");
export const OUTPUT_DIR = path.join(DATA_DIR, "output");
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");

// ── 模板 ──
export const TEMPLATES_DIR = path.join(ROOT, "packages", "render", "templates");
export const TEMPLATE_PATH = path.join(TEMPLATES_DIR, "default.json");

// ── 视频模板 ──
export const VIDEO_TEMPLATES_DIR = path.join(ROOT, "packages", "video");

// ── 渲染脚本 ──
export const RENDER_IMAGES_SCRIPT = path.join(ROOT, "packages", "render", "render-images.mjs");
export const RENDER_SATORI_SCRIPT = path.join(ROOT, "packages", "render", "render-satori.mjs");
export const ENGINE_ENTRY = path.join(ENGINE_DIR, "index.mjs");

// ── 素材 ──
export const ROOT_ASSETS = path.join(ROOT, "assets");

// ── 配置 ──
export const SETTINGS_PATH = path.join(ROOT, "config", "settings.json");
