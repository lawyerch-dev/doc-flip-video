/**
 * render-template.mjs — 模板工坊渲染 API
 *
 * POST /api/render-template — JSON 模板定义 → h() 调用树 → Satori → PNG
 *
 * 请求体：
 * {
 *   "elements": [
 *     { "tag": "div", "style": { "position":"absolute","left":80,"top":750,... }, "text": "标题" },
 *     { "tag": "div", "style": {...}, "children": [
 *       { "tag": "span", "style": {...}, "text": "第" },
 *       { "tag": "span", "style": {...}, "text": "004" }
 *     ]}
 *   ]
 * }
 */
import satori from "satori";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { ROOT, json, errorResponse, parseJson } from "../shared.mjs";

// ── 字体 ──
const FONTS_DIR = path.join(ROOT, "assets", "fonts");
const FONT_DEFS = [
  ["NotoSansSC-Regular.otf", "Noto Sans SC", 400],
  ["NotoSansSC-Bold.otf", "Noto Sans SC", 700],
  ["MaShanZheng-Regular.ttf", "Ma Shan Zheng", 700],
];
const fonts = [];
for (const [file, family, weight] of FONT_DEFS) {
  const fp = path.join(FONTS_DIR, file);
  if (fs.existsSync(fp)) fonts.push({ name: family, data: fs.readFileSync(fp), weight, style: "normal" });
}

const W = 1080;
const H = 1840;

// ── h 函数：自动给 div 注入 display:flex ──
function h(type, style, ...children) {
  const flat = children.filter((c) => c != null && c !== false);
  const isDiv = type === "div";
  const merged = isDiv && style && !style.display ? { ...style, display: "flex" } : style;
  if (flat.length === 0) return { type, props: { style: merged || {}, children: "" } };
  if (flat.length === 1 && typeof flat[0] === "string")
    return { type, props: { style: merged || {}, children: flat[0] } };
  return { type, props: { style: merged || {}, children: flat } };
}

// ── JSON 元素 → h() 调用 ──
function buildElement(def) {
  if (!def) return null;
  const tag = def.tag || "div";
  const style = { ...(def.style || {}) };
  const kids = [];

  if (def.text != null) kids.push(String(def.text));
  if (def.children && Array.isArray(def.children)) {
    for (const child of def.children) {
      const el = buildElement(child);
      if (el) kids.push(el);
    }
  }

  return h(tag, style, ...kids);
}

// ── 构建根元素 ──
function buildRoot(elements) {
  const kids = [];
  for (const def of elements || []) {
    const el = buildElement(def);
    if (el) kids.push(el);
  }
  return h("div", { display: "flex", width: W, height: H, position: "relative", overflow: "hidden" }, ...kids);
}

// ── API 路由 ──
export async function register(method, urlPath, req, res) {
  if (method !== "POST" || urlPath !== "/api/render-template") return false;

  try {
    const body = await parseJson(req);
    const element = buildRoot(body.elements || []);

    const SCALE = 2;
    const svg = await satori(element, { width: W * SCALE, height: H * SCALE, fonts });
    const pngBuffer = await sharp(Buffer.from(svg)).resize(W, H, { kernel: "lanczos3" }).png().toBuffer();

    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length,
      "Cache-Control": "no-cache",
    });
    res.end(pngBuffer);
  } catch (e) {
    console.error("render-template error:", e.message);
    errorResponse(res, e.message, 500);
  }

  return true;
}
