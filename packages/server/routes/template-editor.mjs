/**
 * 模板编辑器 API 路由
 *
 * POST /api/preview-template  — 根据样式配置渲染预览图
 * POST /api/save-template     — 保存自定义模板配置
 * GET  /api/template-styles   — 获取已保存的模板样式
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ROOT, json, errorResponse, parseJson } from "../shared.mjs";

const TEMPLATES_DIR = path.join(ROOT, "packages/engine/templates");
const STYLES_DIR = path.join(TEMPLATES_DIR, "styles");

// 确保目录存在
fs.mkdirSync(STYLES_DIR, { recursive: true });

// 默认文章数据（用于预览）
const DEFAULT_ARTICLE = {
  meta: { issueNumber: 1, year: 2026, month: 7, day: 20, description: "法理如镜，务知天下", template: "default" },
  cover: { headline: "预览标题文字示例", source: "来源：中国法院网" },
  content: {
    title: "预览标题文字示例",
    subtitle: "",
    source: "来源：中国法院网（2026-07-20）",
    paragraphs: [
      { text: "这是一段预览文字，用于展示模板效果。可以调整颜色、字号、间距等参数。", highlight: "展示模板效果" },
      { text: "第二段正文内容，支持高亮关键词显示。调整参数后实时预览。", highlight: "高亮关键词" },
    ],
  },
};

// 将样式配置写入临时 JSON，调用 render-satori-html.mjs 渲染
function renderWithStyle(view, styleConfig) {
  const tmpConfig = path.join(ROOT, "data/temp/editor-preview.json");

  // 用默认文章 + 自定义样式构建完整 config
  const config = JSON.parse(JSON.stringify(DEFAULT_ARTICLE));
  config._style = styleConfig;

  fs.writeFileSync(tmpConfig, JSON.stringify(config, null, 2));

  // 通过环境变量传递样式配置给渲染器
  const env = {
    ...process.env,
    SATORI_STYLE: JSON.stringify(styleConfig),
    SATORI_VIEW: view,
  };

  const script = path.join(ROOT, "packages/engine/render-preview.mjs");
  execFileSync("node", [script, tmpConfig], {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 10000,
    env,
  });

  const outPath = path.join(ROOT, "data/temp/editor-preview.png");
  if (!fs.existsSync(outPath)) throw new Error("渲染失败");
  return outPath;
}

export async function register(method, urlPath, req, res) {
  // ── POST /api/preview-template ──
  if (method === "POST" && urlPath === "/api/preview-template") {
    try {
      const { view, style } = await parseJson(req);
      if (!style) {
        errorResponse(res, "Missing style", 400);
        return true;
      }
      const pngPath = renderWithStyle(view || "cover", style);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(pngPath).pipe(res);
    } catch (e) {
      console.error("preview-template error:", e.message);
      errorResponse(res, e.message, 500);
    }
    return true;
  }

  // ── POST /api/save-template ──
  if (method === "POST" && urlPath === "/api/save-template") {
    try {
      const { name, style } = await parseJson(req);
      if (!name || !style) {
        errorResponse(res, "Missing name/style", 400);
        return true;
      }
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = path.join(STYLES_DIR, `${safeName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(style, null, 2));
      json(res, { ok: true, path: filePath });
    } catch (e) {
      errorResponse(res, e.message, 500);
    }
    return true;
  }

  // ── GET /api/template-styles ──
  if (method === "GET" && urlPath === "/api/template-styles") {
    try {
      const files = fs.readdirSync(STYLES_DIR).filter((f) => f.endsWith(".json"));
      const styles = files.map((f) => ({
        name: f.replace(/\.json$/, ""),
        ...JSON.parse(fs.readFileSync(path.join(STYLES_DIR, f), "utf-8")),
      }));
      json(res, styles);
    } catch {
      json(res, []);
    }
    return true;
  }

  return false;
}
