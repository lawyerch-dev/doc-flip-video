/**
 * 模板渲染引擎
 *
 * 加载 yft-design Fabric.js 模板 JSON + 文章数据 → 替换 {{变量}} → Puppeteer 截图 → PNG
 *
 * 用法：
 *   node index.mjs <template.json> [article.json] [--output path.png] [--dpi 2]
 *
 * 编程调用：
 *   import { renderTemplate } from './index.mjs';
 *   const png = await renderTemplate(templatePath, data, { output: 'out.png' });
 */
// puppeteer 从根目录 node_modules 导入（避免重复安装）
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Fabric.js：优先本地，fallback CDN ──
const FABRIC_LOCAL = path.join(__dirname, "node_modules", "fabric", "dist", "fabric.min.js");
const FABRIC_CDN = "https://cdn.jsdelivr.net/npm/fabric@6.4.1/dist/index.min.js";
function getFabricScriptTag() {
  if (fs.existsSync(FABRIC_LOCAL)) {
    return `<script>${fs.readFileSync(FABRIC_LOCAL, "utf-8")}<\/script>`;
  }
  return `<script src="${FABRIC_CDN}"><\/script>`;
}

// ── 字体注入（本地 HTTP 服务，避免 50MB base64 内联） ──
import http from "http";

const FONTS_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
const FONT_FILES = [
  ["NotoSansSC-Regular.otf", "Noto Sans SC", 400, "normal"],
  ["NotoSansSC-Bold.otf", "Noto Sans SC", 700, "normal"],
  ["MaShanZheng-Regular.ttf", "Ma Shan Zheng", 400, "normal"],
];

function startFontServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = req.url.slice(1);
      const fp = path.join(FONTS_DIR, file);
      if (fs.existsSync(fp)) {
        const ext = path.extname(file);
        res.writeHead(200, { "Content-Type": ext === ".otf" ? "font/otf" : "font/ttf" });
        fs.createReadStream(fp).pipe(res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function getFontFaceCSS(port) {
  return FONT_FILES.map(
    ([file, family, weight, style]) =>
      `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: ${style}; src: url(http://127.0.0.1:${port}/${file}) format('${path.extname(file).slice(1)}'); }`,
  ).join("\n");
}

// ── 核心：填充模板变量 ──

/**
 * 在 JSON 字符串层面替换 {{key}} 为数据值
 * 比 loadFromJSON 后遍历对象更可靠，避免 Fabric.js 内部状态干扰
 */
export function fillTemplate(templateJson, data) {
  const json = typeof templateJson === "string" ? templateJson : JSON.stringify(templateJson);
  return json.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] != null ? String(data[key]) : `{{${key}}}`;
  });
}

/**
 * 递归替换对象树中的文本（支持 group 嵌套）
 */
export function replaceTextRecursive(obj, data) {
  if (obj.text && typeof obj.text === "string") {
    obj.text = obj.text.replace(/\{\{(\w+)\}\}/g, (_, key) => (data[key] != null ? String(data[key]) : `{{${key}}}`));
  }
  if (obj.objects && Array.isArray(obj.objects)) {
    for (const child of obj.objects) replaceTextRecursive(child, data);
  }
}

/**
 * 从文章 JSON 提取扁平化数据对象
 */
export function extractArticleData(article) {
  const m = article.meta || {};
  const cover = article.cover || {};
  const content = article.content || {};
  const paras = content.paragraphs || [];

  return {
    issueNum: String(m.issueNumber || 0).padStart(3, "0"),
    dateText: `${m.year || 2026}年${String(m.month || 1).padStart(2, "0")}月${String(m.day || 1).padStart(2, "0")}日`,
    description: m.description || "",
    headline: cover.headline || "",
    coverSource: cover.source || "",
    contentTitle: content.title || "",
    contentSubtitle: content.subtitle || "",
    contentSource: content.source || "",
    ...Object.fromEntries(paras.slice(0, 5).map((p, i) => [`para${i + 1}`, p.text || ""])),
    ...Object.fromEntries(paras.slice(0, 5).map((p, i) => [`hl${i + 1}`, p.highlight || ""])),
    accent: "#cc0000",
    bgColor: "#ffffff",
    logoText: "法务",
    footerText: "关注我，了解更多法律新鲜事",
  };
}

// ── 渲染 ──

/**
 * 渲染模板为 PNG
 * @param {string} templatePath - 模板 JSON 文件路径
 * @param {object|string} dataOrPath - 数据对象 或 文章 JSON 路径
 * @param {object} opts - { output, dpi, width, height }
 * @returns {Buffer} PNG Buffer
 */
export async function renderTemplate(templatePath, dataOrPath, opts = {}) {
  const templateRaw = fs.readFileSync(templatePath, "utf-8");
  const template = JSON.parse(templateRaw);

  // 解析数据
  let data;
  if (typeof dataOrPath === "string") {
    data = extractArticleData(JSON.parse(fs.readFileSync(dataOrPath, "utf-8")));
  } else {
    data = dataOrPath || {};
  }

  // 在 JSON 字符串层面替换变量（顶层）
  const filledJson = fillTemplate(templateRaw, data);
  const filled = JSON.parse(filledJson);
  // 递归替换分组内的变量
  if (filled.objects) {
    for (const obj of filled.objects) replaceTextRecursive(obj, data);
  }

  // 画布尺寸：yft-design 的 width/height 在顶层
  // 注意：可能是缩放后的值，需要除以 zoom 还原
  const zoom = filled.zoom || 1;
  const width = opts.width || Math.round((filled.width || 1080) / zoom);
  const height = opts.height || Math.round((filled.height || 1840) / zoom);
  const dpi = opts.dpi || 2; // 默认 2x 超采样，与 engine 一致

  const pngBuffer = await renderWithPuppeteer(filled, width, height, dpi);

  if (opts.output) {
    fs.mkdirSync(path.dirname(opts.output), { recursive: true });
    fs.writeFileSync(opts.output, pngBuffer);
    console.log(`✅ ${opts.output} (${(pngBuffer.length / 1024).toFixed(0)}KB, ${width}×${height}@${dpi}x)`);
  }

  return pngBuffer;
}

// ── Puppeteer 渲染 ──

async function renderWithPuppeteer(template, width, height, dpi) {
  // 启动字体服务器
  const fontServer = await startFontServer();
  const fontPort = fontServer.address().port;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    const bgColor = template.background || template.workSpace?.color || "#ffffff";
    const fontFaceCSS = getFontFaceCSS(fontPort);
    const fabricTag = getFabricScriptTag();

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${bgColor}; }
  canvas { display: block; }
  ${fontFaceCSS}
</style>
${fabricTag}
</head><body>
<canvas id="c"></canvas>
<script>
const template = ${JSON.stringify(template)};

async function render() {
  const canvas = new fabric.Canvas('c', {
    width: ${width},
    height: ${height},
    backgroundColor: '${bgColor}',
    enableRetinaScaling: false,
  });

  // 背景图（如果有）
  if (template.backgroundImage) {
    await new Promise((resolve) => {
      fabric.Image.fromObject(template.backgroundImage).then((img) => {
        canvas.setBackgroundImage(img, () => {
          canvas.renderAll();
          resolve();
        });
      });
    });
  }

  // 加载所有对象
  await canvas.loadFromJSON(template);
  canvas.setWidth(${width});
  canvas.setHeight(${height});
  canvas.renderAll();

  // 导出 PNG（multiplier 控制 DPI）
  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: ${dpi},
  });
  window.__result = dataUrl;
  window.__done = true;
}

render().then(() => {
  window.__done = true;
}).catch(e => {
  window.__error = e.message;
  window.__done = true;
});
<\/script>
</body></html>`;

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForFunction("window.__done === true", { timeout: 30000 });

    const error = await page.evaluate(() => window.__error);
    if (error) throw new Error("渲染失败: " + error);

    const dataUrl = await page.evaluate(() => window.__result);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    return Buffer.from(base64, "base64");
  } finally {
    await browser.close();
    fontServer.close();
  }
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`用法: node index.mjs <template.json> [article.json] [--output path.png] [--dpi N]

示例:
  node index.mjs templates/cover.json data/articles/article-004.json --output cover.png

编程调用:
  import { renderTemplate, fillTemplate, extractArticleData } from "./index.mjs";
  const png = await renderTemplate("template.json", "article.json", { output: "out.png" });
`);
    process.exit(0);
  }

  const templatePath = args[0];
  let articlePath = null;
  let output = "output.png";
  let dpi = 2;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) output = args[++i];
    else if (args[i] === "--dpi" && args[i + 1]) dpi = Number(args[++i]);
    else if (!articlePath) articlePath = args[i];
  }

  try {
    const data = articlePath ? extractArticleData(JSON.parse(fs.readFileSync(articlePath, "utf-8"))) : {};
    const png = await renderTemplate(templatePath, data, { output, dpi });
    console.log(`✅ ${png.length} bytes`);
  } catch (e) {
    console.error("❌", e.message);
    process.exit(1);
  }
}
