/**
 * generate.mjs — 简化视频生成入口
 *
 * 用法:
 *   import { generateVideo } from './packages/orchestrator/generate.mjs';
 *
 *   const result = await generateVideo({
 *     title: "快递丢件谁赔",
 *     source: "来源：中国法院网",
 *     paragraphs: [
 *       { text: "快递员没打通电话...", highlight: "快递员没打通电话" },
 *       { text: "用户下单时..." }
 *     ]
 *   });
 *   // => { videoPath, imageDir, issueNumber }
 *
 * 最小输入只需 title + paragraphs，其他自动填充。
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

// ── Paths (指向新包位置) ──
const ASSETS_DIR = path.join(ROOT, "assets");
const TEMPLATES_DIR = path.join(ROOT, "packages", "step-03-render", "templates");
const TEMP_DIR = path.join(ROOT, "data", "temp");
const OUTPUT_DIR = path.join(ROOT, "data", "output");
const ARTICLES_DIR = path.join(ROOT, "data", "articles");
const RENDER_IMAGES = path.join(ROOT, "packages", "step-03-render", "render-images.mjs");
const RENDER_VIDEO = path.join(ROOT, "packages", "step-04-video", "render-video.mjs");

// ── 自动编号：扫描已有文章取最大期号 +1 ──
function nextIssueNumber() {
  try {
    const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".json"));
    let max = 0;
    for (const f of files) {
      const m = f.match(/article-(\d+)\.json/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    // 也检查已生成的临时目录
    if (fs.existsSync(TEMP_DIR)) {
      for (const d of fs.readdirSync(TEMP_DIR)) {
        const m2 = d.match(/issue-(\d+)/);
        if (m2) max = Math.max(max, parseInt(m2[1], 10));
      }
    }
    return max + 1;
  } catch {
    return 1;
  }
}

// ── 标准化输入为完整 article 配置 ──
function normalizeConfig(input) {
  const now = new Date();

  // 支持两种输入：
  // 1. 简化格式：{ title, source, paragraphs, highlight? }
  // 2. 完整格式：直接就是 article JSON（有 meta/cover/content）
  if (input.meta && input.cover && input.content) {
    // 已经是完整配置，直接补全缺失字段
    if (!input.meta.issueNumber) input.meta.issueNumber = nextIssueNumber();
    if (!input.meta.year) input.meta.year = now.getFullYear();
    if (!input.meta.month) input.meta.month = now.getMonth() + 1;
    if (!input.meta.day) input.meta.day = now.getDate();
    if (!input.meta.template) input.meta.template = "default";
    if (!input.timing) {
      input.timing = { settle: 1.2, cover: 2, curl: 2.5, sweep: 2, hold: 1, final: 2 };
    }
    return input;
  }

  // 简化格式 → 完整格式
  const title = input.title || "未命名";
  const source = input.source || "";
  const paragraphs = input.paragraphs || [];

  return {
    meta: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      issueNumber: nextIssueNumber(),
      description: input.description || "法理明如镜，务知天下事！",
      template: input.template || "default",
    },
    timing: input.timing || { settle: 1.2, cover: 2, curl: 2.5, sweep: 2, hold: 1, final: 2 },
    cover: {
      headline: input.headline || title,
      source: source,
    },
    content: {
      title: title,
      subtitle: input.subtitle || "",
      paragraphs: paragraphs,
      source: source,
    },
  };
}

// ── 主函数 ──

/**
 * 生成公文风格视频
 *
 * @param {object} input - 简化或完整文章配置
 * @param {string} input.title - 文章标题（必需）
 * @param {string} [input.source] - 来源
 * @param {Array<{text: string, highlight?: string}>} input.paragraphs - 段落（必需）
 * @param {string} [input.headline] - 封面大标题（默认= title）
 * @param {string} [input.subtitle] - 副标题
 * @param {string} [input.description] - 顶部描述语
 * @param {string} [input.template] - 模板名（默认 "default"）
 * @param {object} [input.timing] - 各阶段时长
 * @param {object} [opts] - 选项
 * @param {string} [opts.outputDir] - 输出目录（默认 data/output）
 * @param {string} [opts.tempDir] - 临时目录（默认 data/temp）
 * @param {boolean} [opts.keepImages] - 是否保留中间图片（默认 false）
 * @returns {Promise<{videoPath: string, imageDir: string, issueNumber: number}>}
 */
export async function generateVideo(input, opts = {}) {
  const config = normalizeConfig(input);
  const issueNum = config.meta.issueNumber;
  const padded = String(issueNum).padStart(3, "0");

  const outDir = opts.outputDir || OUTPUT_DIR;
  const tmpDir = opts.tempDir || TEMP_DIR;

  // 写入临时配置文件
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  const configPath = path.join(ARTICLES_DIR, `article-${padded}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`📄 文章配置: ${configPath}`);
  console.log(`   期号: 第${padded}期 | 标题: ${config.cover.headline}`);

  // 解析模板路径（直接传给 render-images，不覆盖文件）
  const templateName = config.meta.template || "default";
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.json`);
  const resolvedTemplate = fs.existsSync(templatePath) ? templatePath : path.join(TEMPLATES_DIR, "default.json");

  // Step 1: 生成图片（第三个参数 = 模板路径）
  console.log("─── 生成图片 ───");
  execFileSync("node", [RENDER_IMAGES, configPath, resolvedTemplate], { stdio: "inherit" });

  // Step 2: 渲染视频
  console.log("─── 渲染视频 ───");
  execFileSync("node", [RENDER_VIDEO, configPath], { stdio: "inherit" });

  const videoPath = path.join(outDir, `法务视频-${padded}期.mp4`);
  const imageDir = path.join(tmpDir, `issue-${padded}`);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`视频文件未生成: ${videoPath}`);
  }

  console.log(`\n✅ 视频生成完成: ${videoPath}`);

  // 清理临时图片
  if (!opts.keepImages && fs.existsSync(imageDir)) {
    try {
      fs.rmSync(imageDir, { recursive: true, force: true });
      console.log(`🧹 已清理临时图片: ${imageDir}`);
    } catch {}
  }

  return { videoPath, imageDir, issueNumber: issueNum };
}

/**
 * 仅生成预览图片（不渲染视频）
 */
export async function generateImages(input, opts = {}) {
  const config = normalizeConfig(input);
  const issueNum = config.meta.issueNumber;
  const padded = String(issueNum).padStart(3, "0");

  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  const configPath = path.join(ARTICLES_DIR, `article-${padded}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const templateName = config.meta.template || "default";
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.json`);
  const resolvedTemplate = fs.existsSync(templatePath) ? templatePath : path.join(TEMPLATES_DIR, "default.json");

  execFileSync("node", [RENDER_IMAGES, configPath, resolvedTemplate], { stdio: "inherit" });

  const tmpDir = opts.tempDir || TEMP_DIR;
  const imageDir = path.join(tmpDir, `issue-${padded}`);
  return {
    imageDir,
    issueNumber: issueNum,
    images: {
      cover: path.join(imageDir, "cover.png"),
      plain: path.join(imageDir, "content-plain.png"),
      highlight: path.join(imageDir, "content-hl.png"),
    },
  };
}
