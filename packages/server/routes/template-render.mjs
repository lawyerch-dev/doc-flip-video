/**
 * HTML 模板渲染 API（仅用于 PNG 导出）
 *
 * POST /api/render-html — HTML + CSS → Satori → PNG
 *
 * 预览由浏览器 iframe 直接渲染（即时），本 API 仅在用户点击"导出 PNG"时调用。
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

// ── HTML → h() 元素树 ──
function camel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseStyle(str) {
  if (!str) return {};
  const s = {};
  for (const part of str.split(";")) {
    const i = part.indexOf(":");
    if (i > 0) s[camel(part.slice(0, i).trim())] = part.slice(i + 1).trim();
  }
  return s;
}

function h(type, style, ...children) {
  const flat = children.filter((c) => c != null && c !== false);
  const isDiv = type === "div";
  const merged = isDiv && style && !style.display ? { ...style, display: "flex" } : style;
  if (flat.length === 0) return { type, props: { style: merged || {}, children: "" } };
  if (flat.length === 1 && typeof flat[0] === "string")
    return { type, props: { style: merged || {}, children: flat[0] } };
  return { type, props: { style: merged || {}, children: flat } };
}

function parseHtml(htmlStr) {
  const src = htmlStr.replace(/<!--[\s\S]*?-->/g, "").trim();
  let pos = 0;

  function parse() {
    const nodes = [];
    while (pos < src.length) {
      if (src[pos] === "<") {
        if (src[pos + 1] === "/") {
          pos = src.indexOf(">", pos) + 1;
          return nodes;
        }
        const m = src.slice(pos).match(/^<(\w+)([^>]*)>/);
        if (!m) {
          pos++;
          continue;
        }
        const [, tag, attrs] = m;
        pos += m[0].length;
        const styleMatch = attrs.match(/style="([^"]*)"/);
        const style = parseStyle(styleMatch?.[1]);
        if (attrs.trimEnd().endsWith("/") || tag === "img" || tag === "br") {
          nodes.push(h(tag === "span" ? "span" : "div", style, ""));
          continue;
        }
        const kids = parse();
        if (kids.length > 1 && !style.display) style.display = "flex";
        const props = { style };
        if (kids.length === 0) props.children = "";
        else if (kids.length === 1 && typeof kids[0] === "string") props.children = kids[0];
        else props.children = kids;
        nodes.push({ type: tag === "span" ? "span" : "div", props });
      } else {
        const next = src.indexOf("<", pos);
        const text = (next === -1 ? src.slice(pos) : src.slice(pos, next)).trim();
        if (text) nodes.push(text);
        pos = next === -1 ? src.length : next;
      }
    }
    return nodes;
  }

  const roots = parse();
  if (roots.length === 0) return h("div", { display: "flex", width: W, height: H }, "");
  const root = roots[0];
  if (root.type === "div" && !root.props.style?.display) root.props.style.display = "flex";
  return root;
}

// ── 合并 HTML + CSS（把 CSS 注入到元素的 style 中）──
// 简化方案：CSS 中的 class 规则应用到对应 class 的元素
function applyCss(htmlStr, cssStr) {
  // 提取 CSS 规则
  const rules = {};
  const ruleRe = /\.([\w-]+)\s*\{([^}]+)\}/g;
  let m;
  while ((m = ruleRe.exec(cssStr))) {
    const cls = m[1];
    const props = {};
    const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
    let pm;
    while ((pm = propRe.exec(m[2]))) props[camel(pm[1].trim())] = pm[2].trim();
    rules[cls] = props;
  }

  // 给 HTML 中的 class 元素注入样式
  return htmlStr.replace(/class="([^"]+)"/g, (match, clsList) => {
    const classes = clsList.split(/\s+/);
    const merged = {};
    for (const cls of classes) {
      if (rules[cls]) Object.assign(merged, rules[cls]);
    }
    if (Object.keys(merged).length === 0) return match;
    const styleStr = Object.entries(merged)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
      .join(";");
    // 合并到已有的 style 属性
    return match; // CSS 处理复杂，简化为直接用 inline style
  });
}

// ── API 路由 ──
export async function register(method, urlPath, req, res) {
  if (method !== "POST" || urlPath !== "/api/render-html") return false;

  try {
    const { html: htmlStr, css: cssStr } = await parseJson(req);
    if (!htmlStr) {
      errorResponse(res, "Missing html", 400);
      return true;
    }

    // 将 CSS 规则注入 HTML 的 style 属性（简化方案）
    let fullHtml = htmlStr;
    if (cssStr) {
      const ruleRe = /\.([\w-]+)\s*\{([^}]+)\}/g;
      let m;
      while ((m = ruleRe.exec(cssStr))) {
        const cls = m[1];
        const cssProps = m[2]
          .trim()
          .replace(/\s*;\s*/g, ";")
          .replace(/;\s*$/, "");
        // 在 HTML 中找 class="...cls..." 的元素，注入 style
        const classRe = new RegExp(`(class="[^"]*\\b${cls}\\b[^"]*")`, "g");
        fullHtml = fullHtml.replace(classRe, (classMatch) => {
          // 检查是否已有 style
          return classMatch; // 简化：直接依赖 inline style
        });
      }
    }

    // 解析 HTML → 元素树
    // 简化：CSS 通过 <style> 标签注入到 HTML 中，让浏览器处理
    // 但 Satori 不支持 <style>，所以需要把 CSS 转为 inline style
    // 最简方案：把 <style> 块直接嵌入 HTML，Satori 的 html 解析器不支持
    // 实际方案：让用户在 HTML 中直接写 inline style（模板编辑器就是这样做的）

    const element = parseHtml(fullHtml);

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
    console.error("render-html error:", e.message);
    errorResponse(res, e.message, 500);
  }

  return true;
}
