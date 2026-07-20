/**
 * 模板渲染 API 端点
 *
 * POST /api/render-template  — 模板 + 文章数据 → PNG
 *
 * 请求体：{ templateId: "cover-default", articleNum: 4 }
 *   或：{ templatePath: "...", data: { headline: "...", ... } }
 * 返回：PNG 图片
 */
import fs from "fs";
import path from "path";
import { ROOT, json, errorResponse, parseJson } from "../shared.mjs";

// 动态导入 template-render 包
let renderModule = null;
async function getRenderer() {
  if (!renderModule) {
    const modPath = path.join(ROOT, "packages/template-render/index.mjs");
    renderModule = await import(modPath);
  }
  return renderModule;
}

const TEMPLATES_DIR = path.join(ROOT, "packages/template-render/templates");
const ARTICLES_DIR = path.join(ROOT, "data/articles");

export async function register(method, urlPath, req, res) {
  // ── GET /api/templates-list ──
  if (method === "GET" && urlPath === "/api/templates-list") {
    try {
      const dir = path.join(ROOT, "packages/template-render/templates");
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
      const list = files.map((f) => {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
        return { id: f.replace(/\.json$/, ""), name: data._name || f.replace(/\.json$/, "") };
      });
      json(res, list);
    } catch {
      json(res, []);
    }
    return true;
  }

  // ── POST /api/render-template ──
  if (method !== "POST" || urlPath !== "/api/render-template") return false;

  try {
    const body = await parseJson(req);
    const { renderTemplate, extractArticleData } = await getRenderer();

    // 解析模板路径
    let templatePath;
    if (body.templateId) {
      templatePath = path.join(TEMPLATES_DIR, `${body.templateId}.json`);
    } else if (body.templatePath) {
      templatePath = path.resolve(ROOT, body.templatePath);
    } else {
      errorResponse(res, "Missing templateId or templatePath", 400);
      return true;
    }

    if (!fs.existsSync(templatePath)) {
      errorResponse(res, `Template not found: ${templatePath}`, 404);
      return true;
    }

    // 解析数据
    let data;
    if (body.articleNum != null) {
      const padded = String(body.articleNum).padStart(3, "0");
      const articlePath = path.join(ARTICLES_DIR, `article-${padded}.json`);
      if (fs.existsSync(articlePath)) {
        data = extractArticleData(JSON.parse(fs.readFileSync(articlePath, "utf-8")));
      } else {
        data = {};
      }
    } else if (body.data) {
      data = body.data;
    } else {
      data = {};
    }

    // 渲染
    const png = await renderTemplate(templatePath, data, { dpi: body.dpi || 2 });

    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": png.length,
      "Cache-Control": "no-cache",
    });
    res.end(png);
  } catch (e) {
    console.error("render-template error:", e.message);
    errorResponse(res, e.message, 500);
  }

  return true;
}
