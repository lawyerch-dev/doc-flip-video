import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "assets");
fs.mkdirSync(ASSETS, { recursive: true });

const templatePath = process.argv[3] || path.join(__dirname, "..", "template.json");
const articlePath = process.argv[2] || path.join(__dirname, "..", "article.json");
const T = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
const A = JSON.parse(fs.readFileSync(articlePath, "utf-8"));

const S = T.style;
const W = S.width, H = S.height;
const MARGIN = S.margin;
const MAX_TEXT_W = W - MARGIN * 2;
const FONT = S.font.split(",").map(f => `"${f.trim()}"`).join(",");

// ── Helpers ──
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function wrapText(ctx, text, maxWidth, firstMaxWidth) {
  if (!text) return [];
  const firstW = firstMaxWidth || maxWidth;
  const lines = [];
  let line = "";
  let isFirstLine = true;
  for (const char of text) {
    const limit = isFirstLine ? firstW : maxWidth;
    const test = line + char;
    if (ctx.measureText(test).width > limit && line) {
      lines.push(line);
      line = char;
      isFirstLine = false;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function highlightLines(ctx, lines, lineXs, y, lh, fontSize, keyword, withHighlights, bodyCfg) {
  const positions = [];
  if (!keyword || lines.length === 0) return positions;
  const charMap = [];
  for (let li = 0; li < lines.length; li++) {
    for (let ci = 0; ci < lines[li].length; ci++) {
      charMap.push({ line: li, offset: ci });
    }
  }
  const originalText = lines.join("");
  const kwStart = originalText.indexOf(keyword);
  if (kwStart === -1) return positions;
  const kwEnd = kwStart + keyword.length;
  const ranges = [];
  let curLine = -1, curStart = -1;
  for (let i = kwStart; i < kwEnd; i++) {
    const { line, offset } = charMap[i];
    if (line !== curLine) {
      if (curLine >= 0) ranges.push({ line: curLine, startOffset: curStart, endOffset: charMap[i - 1].offset + 1 });
      curLine = line;
      curStart = offset;
    }
  }
  if (curLine >= 0) ranges.push({ line: curLine, startOffset: curStart, endOffset: charMap[kwEnd - 1].offset + 1 });
  for (const r of ranges) {
    const line = lines[r.line];
    const prefix = line.substring(0, r.startOffset);
    const matched = line.substring(r.startOffset, r.endOffset);
    const bx = lineXs[r.line] + ctx.measureText(prefix).width;
    const bw = ctx.measureText(matched).width;
    const ly = y + r.line * lh;
    if (withHighlights) {
      ctx.fillStyle = bodyCfg.highlightColor;
      roundRect(ctx, bx - 4, ly - fontSize * 0.3, bw + 8, fontSize * 1.2, 3); ctx.fill();
      ctx.fillStyle = bodyCfg.highlightTextColor;
      ctx.font = `bold ${fontSize}px ${FONT}`;
      ctx.fillText(matched, bx, ly);
      ctx.font = `${fontSize}px ${FONT}`;
    }
    positions.push({ x: bx - 4, y: ly - fontSize * 0.3, w: bw + 8, h: fontSize * 1.2 });
  }
  return positions;
}

// ── Top section ──
function drawTop(ctx) {
  const top = T.top;
  const meta = A.meta;
  // Logo
  ctx.fillStyle = top.logo.background;
  roundRect(ctx, top.logo.x, top.logo.y, top.logo.width, top.logo.height, top.logo.radius); ctx.fill();
  ctx.fillStyle = top.logo.color;
  ctx.font = `bold ${top.logo.size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(meta.logo, top.logo.x + top.logo.width / 2, top.logo.y + top.logo.height / 2);
  // Title
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = top.title.color;
  ctx.font = `${top.title.bold ? "bold " : ""}${top.title.size}px ${FONT}`;
  ctx.fillText(meta.logo, top.title.x, top.title.y);
  // Tagline
  ctx.fillStyle = top.tagline.color;
  ctx.font = `${top.tagline.size}px ${FONT}`;
  ctx.fillText("｜" + meta.tagline, top.tagline.x, top.tagline.y);
  // Issue
  ctx.fillStyle = top.issue.color;
  ctx.font = `${top.issue.size}px ${FONT}`;
  ctx.fillText(meta.issue, top.issue.x, top.issue.y);
  // Double line
  ctx.strokeStyle = top.line.color;
  ctx.lineWidth = top.line.width;
  ctx.beginPath(); ctx.moveTo(MARGIN, top.line.y); ctx.lineTo(W - MARGIN, top.line.y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(MARGIN, top.line.y + top.line.gap); ctx.lineTo(W - MARGIN, top.line.y + top.line.gap); ctx.stroke();
}

// ── Bottom section ──
function drawBottom(ctx, contentEndY) {
  const bot = T.bottom;
  const lineY = Math.max(contentEndY + 30, H - bot.bottomMargin);
  ctx.strokeStyle = bot.line.color;
  ctx.lineWidth = bot.line.width;
  ctx.beginPath(); ctx.moveTo(MARGIN, lineY); ctx.lineTo(W - MARGIN, lineY); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(MARGIN, lineY + bot.line.gap); ctx.lineTo(W - MARGIN, lineY + bot.line.gap); ctx.stroke();
  ctx.fillStyle = bot.color;
  ctx.font = `${bot.size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(A.content.footer, W / 2, lineY + bot.gapFromLine);
}

// ── Cover (middle section) ──
function generateCover() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = S.background; ctx.fillRect(0, 0, W, H);
  drawTop(ctx);

  const mid = T.middle;
  const ac = A.cover;
  ctx.font = `bold ${mid.headline.size}px ${FONT}`;
  const headlineLines = wrapText(ctx, ac.headline, MAX_TEXT_W);
  const headlineH = headlineLines.length * mid.headline.lineHeight;
  const blockH = mid.tag.height + mid.spacing.tagToHeadline + headlineH + mid.spacing.headlineToSource + mid.source.lineHeight * 2;
  const areaTop = T.top.line.y + T.top.line.gap + mid.paddingTop;
  const areaBottom = H - T.bottom.bottomMargin - 60;
  let y = areaTop + (areaBottom - areaTop - blockH) / 2;

  // Tag
  ctx.fillStyle = mid.tag.background;
  roundRect(ctx, MARGIN, y, mid.tag.width, mid.tag.height, mid.tag.radius); ctx.fill();
  ctx.fillStyle = mid.tag.color;
  ctx.font = `${mid.tag.bold ? "bold " : ""}${mid.tag.size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(mid.tag.text, MARGIN + mid.tag.paddingX, y + mid.tag.height / 2);
  // Headline
  y += mid.tag.height + mid.spacing.tagToHeadline;
  ctx.fillStyle = mid.headline.color;
  ctx.font = `${mid.headline.bold ? "bold " : ""}${mid.headline.size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  for (const line of headlineLines) { ctx.fillText(line, MARGIN, y); y += mid.headline.lineHeight; }
  // Source
  y += mid.spacing.headlineToSource;
  ctx.fillStyle = mid.source.color;
  ctx.font = `${mid.source.size}px ${FONT}`;
  const srcLines = wrapText(ctx, ac.source, MAX_TEXT_W);
  for (const line of srcLines) { ctx.fillText(line, MARGIN, y); y += mid.source.lineHeight; }

  drawBottom(ctx, y);
  return canvas;
}

// ── Content (middle section) ──
function generateContent(withHighlights) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = S.background; ctx.fillRect(0, 0, W, H);
  drawTop(ctx);

  const mid = T.middle;
  const ac = A.content;
  const body = mid.body;
  const hlPositions = [];
  const indent = body.indent === "auto" ? ctx.measureText("　　").width : (body.indent || 0);

  // Center calculation
  let totalLines = 0;
  ctx.font = `bold ${mid.contentTitle.size}px ${FONT}`;
  totalLines += wrapText(ctx, ac.title, MAX_TEXT_W).length;
  ctx.font = `bold ${mid.contentSubtitle.size}px ${FONT}`;
  totalLines += wrapText(ctx, ac.subtitle, MAX_TEXT_W).length;
  totalLines += 1;
  for (const para of ac.paragraphs) {
    if (!para.text) { totalLines += 0.6; continue; }
    ctx.font = para.bold ? `bold ${body.fontSize + 4}px ${FONT}` : `${body.fontSize}px ${FONT}`;
    const useIndent = !para.bold;
    totalLines += wrapText(ctx, para.text, MAX_TEXT_W, useIndent ? MAX_TEXT_W - indent : MAX_TEXT_W).length;
  }
  totalLines += 3;
  const contentH = totalLines * body.lineHeight;
  const areaTop = T.top.line.y + T.top.line.gap + mid.paddingTop;
  const areaBottom = H - T.bottom.bottomMargin - 60;
  let y = areaTop + Math.max(20, (areaBottom - areaTop - contentH) / 2);

  ctx.textAlign = "left"; ctx.textBaseline = "top";

  // Title
  ctx.fillStyle = mid.contentTitle.color;
  ctx.font = `${mid.contentTitle.bold ? "bold " : ""}${mid.contentTitle.size}px ${FONT}`;
  const titleLines = wrapText(ctx, ac.title, MAX_TEXT_W);
  const titleXs = titleLines.map(() => MARGIN);
  for (let i = 0; i < titleLines.length; i++) ctx.fillText(titleLines[i], MARGIN, y + i * mid.contentTitle.lineHeight);
  if (ac.titleHighlight) hlPositions.push(...highlightLines(ctx, titleLines, titleXs, y, mid.contentTitle.lineHeight, mid.contentTitle.size, ac.titleHighlight, withHighlights, body));
  y += titleLines.length * mid.contentTitle.lineHeight;

  // Subtitle
  ctx.fillStyle = mid.contentSubtitle.color;
  ctx.font = `${mid.contentSubtitle.bold ? "bold " : ""}${mid.contentSubtitle.size}px ${FONT}`;
  const subLines = wrapText(ctx, ac.subtitle, MAX_TEXT_W);
  const subXs = subLines.map(() => MARGIN);
  for (let i = 0; i < subLines.length; i++) ctx.fillText(subLines[i], MARGIN, y + i * mid.contentSubtitle.lineHeight);
  if (ac.subtitleHighlight) hlPositions.push(...highlightLines(ctx, subLines, subXs, y, mid.contentSubtitle.lineHeight, mid.contentSubtitle.size, ac.subtitleHighlight, withHighlights, body));
  y += subLines.length * mid.contentSubtitle.lineHeight;

  // Spacing (no separator line)
  y += 50;

  // Body
  for (const para of ac.paragraphs) {
    if (!para.text) { y += body.lineHeight * 0.6; continue; }
    const isBold = para.bold;
    ctx.font = isBold ? `bold ${body.fontSize + 4}px ${FONT}` : `${body.fontSize}px ${FONT}`;
    const useIndent = !isBold;
    const lines = wrapText(ctx, para.text, MAX_TEXT_W, useIndent ? MAX_TEXT_W - indent : MAX_TEXT_W);
    const lineXs = lines.map((_, li) => MARGIN + (useIndent && li === 0 ? indent : 0));
    for (let li = 0; li < lines.length; li++) {
      ctx.fillStyle = isBold ? body.boldColor : body.color;
      ctx.fillText(lines[li], lineXs[li], y + li * body.lineHeight);
    }
    if (para.highlight) hlPositions.push(...highlightLines(ctx, lines, lineXs, y, body.lineHeight, body.fontSize, para.highlight, withHighlights, body));
    y += lines.length * body.lineHeight;
  }

  // Source
  y += mid.sourceText.gapFromContent;
  ctx.fillStyle = mid.sourceText.color;
  ctx.font = `${mid.sourceText.size}px ${FONT}`;
  const srcLines = wrapText(ctx, ac.source, MAX_TEXT_W);
  for (const line of srcLines) { ctx.fillText(line, MARGIN, y); y += mid.sourceText.lineHeight; }

  drawBottom(ctx, y);
  return { canvas, hlPositions };
}

// ── Generate ──
const coverCanvas = generateCover();
fs.writeFileSync(path.join(ASSETS, "page_cover.png"), coverCanvas.toBuffer("image/png"));

const { canvas: plainCanvas } = generateContent(false);
fs.writeFileSync(path.join(ASSETS, "page_content_plain.png"), plainCanvas.toBuffer("image/png"));

const { canvas: hlCanvas, hlPositions } = generateContent(true);
fs.writeFileSync(path.join(ASSETS, "page_content_hl.png"), hlCanvas.toBuffer("image/png"));
fs.writeFileSync(path.join(ASSETS, "hl_positions.json"), JSON.stringify(hlPositions));

console.log(`✅ Generated: cover + content (plain & hl) + ${hlPositions.length} highlights`);
