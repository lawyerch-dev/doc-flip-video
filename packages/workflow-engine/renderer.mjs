/**
 * 素材渲染器 - 将文字、图片等素材渲染为 PNG图片
 *
 * 复用现有的 render-images.mjs 的渲染逻辑
 */

import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import { ROOT, TEMP_DIR, FRONTEND_ASSETS } from "../../config/paths.mjs";

const FONTS_DIR = path.join(FRONTEND_ASSETS, "fonts");

// ── 字体注册 ──

const FONT_FAMILY_MAP = {
  "NotoSansSC-Regular.otf": "Noto Sans SC",
  "NotoSansSC-Bold.otf": "Noto Sans SC",
  "NotoSansSC-Light.otf": "Noto Sans SC",
  "SourceHanSerifSC-Regular.otf": "Source Han Serif SC",
  "SourceHanSerifSC-Bold.otf": "Source Han Serif SC",
};

const FONT_WEIGHT_MAP = {
  Regular: 400,
  Bold: 700,
  Light: 300,
};

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered || !fs.existsSync(FONTS_DIR)) return;

  const files = fs.readdirSync(FONTS_DIR);
  for (const file of files) {
    if (!file.match(/\.(otf|ttf)$/i)) continue;

    const family = FONT_FAMILY_MAP[file];
    if (!family) continue;

    const weight = file.includes("Bold") ? 700 : file.includes("Light") ? 300 : 400;
    const fontPath = path.join(FONTS_DIR, file);

    try {
      registerFont(fontPath, { family, weight });
    } catch (e) {
      // 忽略已注册的字体
    }
  }
  fontsRegistered = true;
}

// ── 渲染工具函数 ──

/**
 * 自动换行
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
  const chars = [...text];
  const lines = [];
  let currentLine = "";

  for (const char of chars) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * 绘制圆角矩形
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── 文字渲染 ──

/**
 * 渲染文字为图片
 * @param {Object} content - 素材内容
 * @param {Object} canvas - 画布配置
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} 输出文件路径
 */
export async function renderText(content, canvas, outputDir) {
  registerFonts();

  const { width, height } = canvas;
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d");

  // 背景
  ctx.fillStyle = content.style?.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // 文字样式
  const fontSize = content.style?.fontSize || 48;
  const fontFamily = content.style?.font || "Noto Sans SC";
  const fontWeight = content.style?.bold ? "bold" : "normal";
  const color = content.style?.color || "#333333";
  const align = content.style?.align || "center";
  const lineHeight = fontSize * 1.5;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  // 计算位置
  const margin = 80;
  const maxWidth = width - margin * 2;
  const lines = wrapText(ctx, content.source, maxWidth);
  const totalHeight = lines.length * lineHeight;

  let x = align === "center" ? width / 2 : align === "right" ? width - margin : margin;
  let y = (height - totalHeight) / 2 + lineHeight / 2;

  // 绘制文字
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  // 保存
  const outputPath = path.join(outputDir, `text-${Date.now()}.png`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, c.toBuffer("image/png"));

  return outputPath;
}

// ── 图片渲染 ──

/**
 * 渲染图片（调整尺寸）
 * @param {Object} content - 素材内容
 * @param {Object} canvas - 画布配置
 * @param {string} outputDir - 输出目录
 * @returns {Promise<string>} 输出文件路径
 */
export async function renderImage(content, canvas, outputDir) {
  const { width, height } = canvas;
  const sourcePath = content.source;

  // 如果源文件不存在，返回错误
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`图片不存在: ${sourcePath}`);
  }

  // 如果尺寸匹配，直接复制
  // 否则需要调整尺寸（这里简化处理，实际可以用 sharp 等库）
  const outputPath = path.join(outputDir, `image-${Date.now()}.png`);

  // 简单复制（假设图片已经是正确尺寸）
  fs.copyFileSync(sourcePath, outputPath);

  return outputPath;
}

// ── 主渲染函数 ──

/**
 * 渲染素材节点
 * @param {Object} node - 素材节点
 * @param {Object} canvas - 画布配置
 * @param {string} tempDir - 临时目录
 * @returns {Promise<Object>} 渲染结果
 */
export async function renderMaterial(node, canvas, tempDir) {
  const { content } = node;

  // 创建临时目录
  const nodeTempDir = path.join(tempDir, node.id);
  fs.mkdirSync(nodeTempDir, { recursive: true });

  let mediaPath;
  let mediaType;

  switch (content.kind) {
    case "text":
      mediaPath = await renderText(content, canvas, nodeTempDir);
      mediaType = "image";
      break;

    case "image":
      mediaPath = await renderImage(content, canvas, nodeTempDir);
      mediaType = "image";
      break;

    case "video":
      // 视频直接使用源文件
      mediaPath = content.source;
      mediaType = "video";
      break;

    case "audio":
      // 音频直接使用源文件
      mediaPath = content.source;
      mediaType = "audio";
      break;

    default:
      throw new Error(`不支持的素材类型: ${content.kind}`);
  }

  // 计算总时长
  let totalDuration = content.duration || 0;
  if (content.kind === "text" || content.kind === "image") {
    // 图片素材的时长 = 所有效果时长之和
    totalDuration = node.effects.reduce((sum, effect) => sum + (effect.params?.duration || 0), 0);
  }

  return {
    id: node.id,
    path: mediaPath,
    mediaType,
    duration: totalDuration,
    effects: node.effects || [],
  };
}

/**
 * 批量渲染素材节点
 * @param {Object[]} nodes - 素材节点列表
 * @param {Object} canvas - 画布配置
 * @param {string} tempDir - 临时目录
 * @returns {Promise<Object[]>} 渲染结果列表
 */
export async function renderAllMaterials(nodes, canvas, tempDir) {
  const results = [];

  for (const node of nodes) {
    console.log(`  📄 渲染素材: ${node.name || node.id}`);
    const result = await renderMaterial(node, canvas, tempDir);
    results.push(result);
  }

  return results;
}
