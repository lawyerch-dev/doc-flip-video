import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JsBarcode from "jsbarcode";
import { FRONTEND_ASSETS } from "../../config/paths.mjs";

const ASSETS = FRONTEND_ASSETS;
const FONTS_DIR = path.join(ASSETS, "fonts");
fs.mkdirSync(ASSETS, { recursive: true });

// Register fonts from assets/fonts directory
// Map filenames (e.g. NotoSansSC-Regular.otf) to proper CSS family names with weights
const FONT_FAMILY_MAP = {
  'NotoSansSC': 'Noto Sans SC',
  'NotoSansCJKSC': 'Noto Sans CJK SC',
  'MaShanZheng': 'Ma Shan Zheng',
};
const FONT_WEIGHT_MAP = { 'Regular': 400, 'Bold': 700, 'Light': 300 };

if (fs.existsSync(FONTS_DIR)) {
  const fontFiles = fs.readdirSync(FONTS_DIR);
  for (const file of fontFiles) {
    if (!file.endsWith('.ttf') && !file.endsWith('.otf') && !file.endsWith('.ttc')) continue;
    const fontPath = path.join(FONTS_DIR, file);
    try {
      const baseName = file.replace(/\.(ttf|otf|ttc)$/, '');
      let familyKey = baseName;
      let weight = 400;
      for (const [suffix, w] of Object.entries(FONT_WEIGHT_MAP)) {
        if (baseName.endsWith(suffix)) {
          familyKey = baseName.slice(0, -suffix.length).trim();
          weight = w;
          break;
        }
      }
      const cssFamily = FONT_FAMILY_MAP[familyKey] || familyKey;
      registerFont(fontPath, { family: cssFamily, weight });
    } catch (e) {
      // Ignore registration errors
    }
  }
}

const templatePath = process.argv[3] || path.join(__dirname, "templates", "default.json");
const articlePath = process.argv[2] || path.join(__dirname, "..", "article.json");
const T = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
const A = JSON.parse(fs.readFileSync(articlePath, "utf-8"));

const S = T.style;
const W = S.width, H = S.height;
const OUTPUT_W = 1080, OUTPUT_H = 1440; // Fixed output size
const MARGIN = S.margin;
const MAX_TEXT_W = W - MARGIN * 2;
const FONT = S.font.split(",").map(f => `"${f.trim()}"`).join(",");

// ── Format helpers (assemble display strings from granular meta) ──
function formatDate(m) {
  return `${m.year}年${String(m.month).padStart(2, "0")}月${String(m.day).padStart(2, "0")}日`;
}
function formatIssue(m) {
  return `第${String(m.issueNumber).padStart(3, "0")}期`;
}
function formatIssueFull(m) {
  return `${m.year}年总第${String(m.issueNumber).padStart(3, "0")}期`;
}

// ── Helpers ──
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ── Common helpers ──
function makeFont(size, bold, font) {
  return `${bold ? "bold " : ""}${size}px ${font || FONT}`;
}

function resolvePos(cfg, defaultX, defaultY) {
  return {
    x: cfg.x != null ? cfg.x : defaultX,
    y: cfg.y != null ? cfg.y : defaultY
  };
}

function text(ctx, content, cfg, defaults) {
  const d = defaults || {};
  const size = cfg.size ?? d.size ?? 28;
  const color = cfg.color ?? d.color ?? "#666666";
  const font = cfg.font ?? d.font ?? FONT;
  const bold = cfg.bold ?? d.bold ?? false;
  const align = cfg.align ?? d.align ?? "left";
  const baseline = cfg.baseline ?? d.baseline ?? "top";
  ctx.fillStyle = color;
  ctx.font = makeFont(size, bold, font);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
}

function drawDoubleLine(ctx, y, cfg) {
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = cfg.width;
  ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(W - MARGIN, y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(MARGIN, y + cfg.gap); ctx.lineTo(W - MARGIN, y + cfg.gap); ctx.stroke();
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

function highlightLines(ctx, lines, lineXs, y, lh, fontSize, keyword, withHighlights, bodyCfg, isBold, drawFontSize) {
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
  // Use the exact same font as the original text for accurate measureText
  const srcFont = makeFont(drawFontSize || fontSize, isBold);
  for (const r of ranges) {
    const line = lines[r.line];
    const prefix = line.substring(0, r.startOffset);
    const matched = line.substring(r.startOffset, r.endOffset);
    ctx.font = srcFont;
    const bx = lineXs[r.line] + ctx.measureText(prefix).width;
    const bw = ctx.measureText(matched).width;
    const ly = y + r.line * lh;
    if (withHighlights) {
      // Erase original text with white rect
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, bx - 8, ly - fontSize * 0.1, bw + 16, fontSize * 1.5, 4); ctx.fill();
      // Draw yellow highlight
      ctx.fillStyle = bodyCfg.highlightColor || "#FFD700";
      roundRect(ctx, bx - 6, ly - 2, bw + 12, fontSize * 1.4, 4); ctx.fill();
      // Draw red text
      ctx.fillStyle = bodyCfg.highlightTextColor || "#cc0000";
      ctx.font = makeFont(fontSize, true);
      ctx.fillText(matched, bx, ly);
    }
    positions.push({ x: bx - 6, y: ly - 2, w: bw + 12, h: fontSize * 1.4 });
  }
  return positions;
}

// ── Draw background (gradient + watermark + left band) ──
function drawBackground(ctx) {
  const bg = S.background;
  if (typeof bg === "string") {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  } else {
    // Vertical gradient from top to bottom
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bg.top);
    grad.addColorStop(1, bg.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  // Watermark
  const wm = S.watermark;
  if (wm && wm.enabled) {
    // Dynamic watermark: derive from issue number
    let wmText = wm.text;
    if (wmText === "auto") {
      wmText = `No.${String(A.meta.issueNumber).padStart(3, "0")}`;
    }
    ctx.save();
    ctx.globalAlpha = wm.opacity != null ? wm.opacity : 1;
    ctx.fillStyle = wm.color;
    ctx.font = makeFont(wm.size, wm.bold !== false);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.translate(wm.x, wm.y);
    ctx.rotate(wm.rotate != null ? wm.rotate : -0.18);
    ctx.fillText(wmText, 0, 0);
    ctx.restore();
  }
  // Left accent band
  const lb = S.leftBand;
  if (lb && lb.enabled) {
    ctx.fillStyle = lb.color;
    ctx.fillRect(lb.inset, 0, lb.width, H);
  }
}

// ── Barcode ──
function drawBarcode(ctx) {
  const bc = T.barcode;
  if (!bc || !bc.enabled) return;
  // Extract year-month + issue number for barcode (e.g. "202607458")
  const raw = bc.text === "auto" ? null : bc.text;
  let text;
  if (raw) {
    text = raw.replace(/[^0-9A-Za-z\-]/g, "");
  } else {
    const ymd = `${A.meta.year}${String(A.meta.month).padStart(2,"0")}${String(A.meta.day).padStart(2,"0")}`;
    text = ymd + A.meta.issueNumber; // "20260701458"
  }

  // Offscreen canvas for barcode
  const barcodeCanvas = createCanvas(bc.width, bc.height + (bc.textSize || 14) + 8);
  try {
    JsBarcode(barcodeCanvas, text, {
      format: "CODE128",
      width: 2,
      height: bc.height,
      displayValue: true,
      fontSize: bc.textSize || 14,
      textMargin: 4,
      lineColor: bc.barColor || "#333333",
      background: bc.bgColor || "transparent",
      textAlign: "center",
      margin: 0
    });
    ctx.drawImage(barcodeCanvas, bc.x, bc.y);
  } catch (e) {
    ctx.fillStyle = bc.textColor || "#999999";
    ctx.font = makeFont(bc.textSize || 14, false);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(text, bc.x + bc.width / 2, bc.y);
  }
}

// ── Top section ──
function drawTop(ctx) {
  const top = T.top;
  const meta = A.meta;
  // Header band background
  const hb = S.headerBand;
  if (hb && hb.enabled) {
    ctx.fillStyle = hb.color;
    ctx.fillRect(0, 0, W, hb.height);
  }

  const logo = top.logo;
  const issNum = top.issueNumber;
  const dt = top.date;
  const desc = top.description;

  // ── Draw seal at absolute x,y ──
  ctx.fillStyle = logo.background;
  roundRect(ctx, logo.x, logo.y, logo.width, logo.height, logo.radius); ctx.fill();
  ctx.fillStyle = logo.color;
  const logoFont = logo.font || FONT;
  const chars = logo.text.split("");
  const firstScale = logo.firstCharScale || 1;
  if (chars.length > 1 && firstScale !== 1) {
    const baseSize = logo.size;
    const bigSize = Math.round(baseSize * firstScale);
    const smallSize = baseSize;
    const centerY = logo.y + logo.height / 2;
    ctx.font = makeFont(bigSize, true, logoFont);
    const w0 = ctx.measureText(chars[0]).width;
    ctx.font = makeFont(smallSize, true, logoFont);
    const restWidths = chars.slice(1).map(c => ctx.measureText(c).width);
    const gap = 6;
    const totalW = w0 + gap + restWidths.reduce((a, b) => a + b, 0);
    let cx = logo.x + (logo.width - totalW) / 2;
    const firstOffY = logo.firstCharOffsetY || 0;
    const otherOffY = logo.otherCharOffsetY || 0;
    ctx.font = makeFont(bigSize, true, logoFont);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(chars[0], cx, centerY + bigSize * firstOffY);
    cx += w0 + gap;
    ctx.font = makeFont(smallSize, true, logoFont);
    for (let i = 1; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, centerY + smallSize * otherOffY);
      cx += restWidths[i - 1];
    }
  } else {
    ctx.font = makeFont(logo.size, true, logoFont);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(logo.text, logo.x + logo.width / 2, logo.y + logo.height / 2);
  }
  const sealBottom = logo.y + logo.height;

  // ── Issue number at absolute x,y ──
  const num = String(meta.issueNumber).padStart(3, "0");
  const partGap = issNum.partSpacing || 8;
  let ix = issNum.x;
  ctx.textBaseline = "middle";
  text(ctx, "第", { color: issNum.color, size: issNum.prefixSize, bold: true, align: "left", baseline: "middle" });
  ctx.fillText("第", ix, issNum.y);
  ix += ctx.measureText("第").width + partGap;
  text(ctx, num, { color: issNum.numberColor, size: issNum.numberSize, bold: true, align: "left", baseline: "middle" });
  ctx.fillText(num, ix, issNum.y);
  ix += ctx.measureText(num).width + partGap;
  text(ctx, "期", { color: issNum.color, size: issNum.prefixSize, bold: true, align: "left", baseline: "middle" });
  ctx.fillText("期", ix, issNum.y);
  const issBottom = issNum.y + issNum.numberSize / 2;

  // ── Date at absolute x,y ──
  text(ctx, formatDate(meta), dt, { align: "left" });
  ctx.fillText(formatDate(meta), dt.x, dt.y);

  // ── Description at absolute x,y ──
  let descBottom = dt.y + dt.size;
  if (meta.description) {
    text(ctx, meta.description, desc, { align: "left" });
    ctx.fillText(meta.description, desc.x, desc.y);
    descBottom = desc.y + desc.size;
  }

  // ── Double line (absolute y) ──
  drawDoubleLine(ctx, top.line.y, top.line);

  // Barcode (top-right)
  drawBarcode(ctx);
}

// ── Dot divider ──
function drawDotDivider(ctx, y) {
  const div = T.middle.divider;
  if (!div || !div.enabled) return 0;
  const startX = MARGIN + 20;
  const endX = W - MARGIN - 20;
  const dotR = div.dotRadius || 2.5;
  const gap = div.dotGap || 16;
  ctx.fillStyle = div.color;
  for (let x = startX; x < endX; x += gap) {
    ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill();
  }
  return dotR * 2;
}

// ── Bottom section ──
function drawBottom(ctx) {
  const bot = T.bottom;
  const bandH = bot.band && bot.band.enabled ? bot.band.height : 0;
  const lineY = bot.line.y != null ? bot.line.y : (H - bot.bottomMargin - bandH);
  const qrImg = bot.qrImage;
  const qr = bot.qrPlaceholder;
  const lowestY = [
    qrImg?.enabled ? qrImg.y : null,
    qr?.enabled ? qr.y : null,
    bot.text?.y
  ].filter(v => v != null);
  const bandY = bot.band && bot.band.enabled ? Math.min(...lowestY) - 10 : 0;

  // Double line
  drawDoubleLine(ctx, lineY, bot.line);

  // Footer text config
  const txt = bot.text || {};
  const txtContent = txt.content || bot.text || "";
  const txtSize = txt.size || bot.size || 28;
  const txtColor = txt.color || bot.color || "#666666";
  const txtFont = txt.font || FONT;
  const txtBold = txt.bold != null ? txt.bold : false;
  const txtX = txt.x === "center" ? W / 2 : (txt.x != null ? txt.x : W / 2);
  const txtY = txt.y != null ? txt.y : (lineY + bot.gapFromLine);

  // Gray band framing QR area (drawn before text so text is on top)
  if (bot.band && bot.band.enabled) {
    ctx.fillStyle = bot.band.color;
    ctx.fillRect(0, bandY, W, bandH);

    // QR image or placeholder
    const qrImg = bot.qrImage;
    const qr = bot.qrPlaceholder;
    if (qrImg && qrImg.enabled && qrImg._img) {
      const qrX = qrImg.x != null ? qrImg.x : (W - MARGIN - qrImg.size - 20);
      const qrY = qrImg.y != null ? qrImg.y : (bandY + (bandH - qrImg.size - qrImg.labelSize - 8) / 2);
      ctx.drawImage(qrImg._img, qrX, qrY, qrImg.size, qrImg.size);
      text(ctx, qrImg.label, { size: qrImg.labelSize, color: qrImg.labelColor, align: "center" });
      ctx.fillText(qrImg.label, qrX + qrImg.size / 2, qrY + qrImg.size + 6);
    } else if (qr && qr.enabled) {
      const qrX = qr.x != null ? qr.x : (W - MARGIN - qr.size - 20);
      const qrY = qr.y != null ? qr.y : (bandY + (bandH - qr.size - qr.labelSize - 8) / 2);
      ctx.strokeStyle = qr.borderColor;
      ctx.lineWidth = 1.5;
      roundRect(ctx, qrX, qrY, qr.size, qr.size, 6); ctx.stroke();
      text(ctx, "QR", { size: Math.round(qr.size * 0.28), color: "#cccccc", bold: true, align: "center", baseline: "middle" });
      ctx.fillText("QR", qrX + qr.size / 2, qrY + qr.size / 2);
      text(ctx, qr.label, { size: qr.labelSize, color: qr.labelColor, align: "center" });
      ctx.fillText(qr.label, qrX + qr.size / 2, qrY + qr.size + 6);
    }
  }

  // Footer text (drawn last so it's always on top)
  text(ctx, txtContent, { size: txtSize, color: txtColor, font: txtFont, bold: txtBold, align: "center" });
  ctx.fillText(txtContent, txtX, txtY);
}

// ── Cover (middle section) ──
function generateCover() {
  const SCALE = 2;
  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  drawBackground(ctx);
  drawTop(ctx);

  const mid = T.middle;
  const ac = A.cover;
  ctx.font = makeFont(mid.headline.size, true);
  const headlineLines = wrapText(ctx, ac.headline, MAX_TEXT_W);
  const headlineH = headlineLines.length * mid.headline.lineHeight;
  const blockH = mid.tag.height + mid.spacing.tagToHeadline + headlineH + mid.spacing.headlineToSource + mid.source.lineHeight * 2;
  const areaTop = mid.y || (T.top.line.y + 40);
  const areaBottom = H - T.bottom.bottomMargin - 60;
  let y = areaTop + (areaBottom - areaTop - blockH) / 2;

  // Tag (absolute x,y or flow)
  const tagX = mid.tag.x != null ? mid.tag.x : MARGIN;
  const tagY = mid.tag.y != null ? mid.tag.y : y;
  ctx.fillStyle = mid.tag.background;
  roundRect(ctx, tagX, tagY, mid.tag.width, mid.tag.height, mid.tag.radius); ctx.fill();
  text(ctx, mid.tag.text, mid.tag, { align: "left", baseline: "middle" });
  ctx.fillText(mid.tag.text, tagX + mid.tag.paddingX, tagY + mid.tag.height / 2);
  y = tagY + mid.tag.height;

  // Headline (absolute x,y or flow)
  const hlX = mid.headline.x != null ? mid.headline.x : MARGIN;
  const hlY = mid.headline.y != null ? mid.headline.y : (y + mid.spacing.tagToHeadline);
  text(ctx, null, mid.headline, { align: "left" });
  for (let i = 0; i < headlineLines.length; i++) { ctx.fillText(headlineLines[i], hlX, hlY + i * mid.headline.lineHeight); }
  y = hlY + headlineLines.length * mid.headline.lineHeight;

  // Source (absolute x,y or flow)
  const srcX = mid.source.x != null ? mid.source.x : MARGIN;
  const srcY = mid.source.y != null ? mid.source.y : (y + mid.spacing.headlineToSource);
  text(ctx, null, mid.source, { align: "left" });
  const srcLines = wrapText(ctx, ac.source, MAX_TEXT_W);
  for (let i = 0; i < srcLines.length; i++) { ctx.fillText(srcLines[i], srcX, srcY + i * mid.source.lineHeight); }
  y = srcY + srcLines.length * mid.source.lineHeight;

  drawBottom(ctx);
  return canvas;
}

// ── Content (middle section) ──
function generateContent(withHighlights) {
  const SCALE = 2;
  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  drawBackground(ctx);
  drawTop(ctx);

  const mid = T.middle;
  const ac = A.content;
  const body = mid.body;
  const hlPositions = [];
  const indent = body.indent === "auto" ? ctx.measureText("　　").width : (body.indent || 0);

  // Divider (absolute y)
  const div = mid.divider;

  // Center calculation
  let totalLines = 0;
  ctx.font = makeFont(mid.contentTitle.size, true);
  totalLines += wrapText(ctx, ac.title, MAX_TEXT_W).length;
  ctx.font = makeFont(mid.contentSubtitle.size, true);
  totalLines += wrapText(ctx, ac.subtitle, MAX_TEXT_W).length;
  totalLines += 1;
  for (const para of ac.paragraphs) {
    if (!para.text) { totalLines += 0.6; continue; }
    ctx.font = makeFont(para.bold ? body.fontSize + 4 : body.fontSize, para.bold);
    const useIndent = !para.bold;
    totalLines += wrapText(ctx, para.text, MAX_TEXT_W, useIndent ? MAX_TEXT_W - indent : MAX_TEXT_W).length;
  }
  totalLines += 3;
  const contentH = totalLines * body.lineHeight;
  const areaTop = mid.y || (T.top.line.y + 40);
  const areaBottom = H - T.bottom.bottomMargin - 60;
  let y = areaTop + Math.max(20, (areaBottom - areaTop - contentH) / 2);

  ctx.textAlign = "left"; ctx.textBaseline = "top";

  // Title (absolute x,y or flow)
  const titleY = mid.contentTitle.y != null ? mid.contentTitle.y : y;
  const titleX = mid.contentTitle.x != null ? mid.contentTitle.x : MARGIN;
  text(ctx, null, mid.contentTitle, { align: "left" });
  const titleLines = wrapText(ctx, ac.title, MAX_TEXT_W);
  const titleXs = titleLines.map(() => titleX);
  for (let i = 0; i < titleLines.length; i++) ctx.fillText(titleLines[i], titleX, titleY + i * mid.contentTitle.lineHeight);
  if (ac.titleHighlight) hlPositions.push(...highlightLines(ctx, titleLines, titleXs, titleY, mid.contentTitle.lineHeight, mid.contentTitle.size, ac.titleHighlight, withHighlights, body, mid.contentTitle.bold, mid.contentTitle.size));
  y = titleY + titleLines.length * mid.contentTitle.lineHeight;

  // Subtitle (absolute x,y or flow)
  const subY = mid.contentSubtitle.y != null ? mid.contentSubtitle.y : y;
  const subX = mid.contentSubtitle.x != null ? mid.contentSubtitle.x : MARGIN;
  text(ctx, null, mid.contentSubtitle, { align: "left" });
  const subLines = wrapText(ctx, ac.subtitle, MAX_TEXT_W);
  const subXs = subLines.map(() => subX);
  for (let i = 0; i < subLines.length; i++) ctx.fillText(subLines[i], subX, subY + i * mid.contentSubtitle.lineHeight);
  if (ac.subtitleHighlight) hlPositions.push(...highlightLines(ctx, subLines, subXs, subY, mid.contentSubtitle.lineHeight, mid.contentSubtitle.size, ac.subtitleHighlight, withHighlights, body, mid.contentSubtitle.bold, mid.contentSubtitle.size));
  y = subY + subLines.length * mid.contentSubtitle.lineHeight;

  // Dot divider (absolute y)
  if (div && div.enabled) drawDotDivider(ctx, div.y);

  // Body (centered below divider)
  const bodyAreaTop = (div && div.enabled ? div.y + (div.dotRadius || 2.5) * 2 + 20 : y);
  y = bodyAreaTop + Math.max(20, (areaBottom - bodyAreaTop - contentH) / 2);

  // Body
  for (const para of ac.paragraphs) {
    if (!para.text) { y += body.lineHeight * 0.6; continue; }
    const isBold = para.bold;
    ctx.font = makeFont(isBold ? body.fontSize + 4 : body.fontSize, isBold);
    const useIndent = !isBold;
    const lines = wrapText(ctx, para.text, MAX_TEXT_W, useIndent ? MAX_TEXT_W - indent : MAX_TEXT_W);
    const lineXs = lines.map((_, li) => MARGIN + (useIndent && li === 0 ? indent : 0));
    for (let li = 0; li < lines.length; li++) {
      ctx.fillStyle = isBold ? body.boldColor : body.color;
      ctx.fillText(lines[li], lineXs[li], y + li * body.lineHeight);
    }
    if (para.highlight) hlPositions.push(...highlightLines(ctx, lines, lineXs, y, body.lineHeight, body.fontSize, para.highlight, withHighlights, body, isBold, isBold ? body.fontSize + 4 : body.fontSize));
    y += lines.length * body.lineHeight;
  }

  // Source (absolute x,y or flow)
  const srcY = mid.sourceText.y != null ? mid.sourceText.y : (y + mid.sourceText.gapFromContent);
  const srcX = mid.sourceText.x != null ? mid.sourceText.x : MARGIN;
  text(ctx, null, mid.sourceText, { align: "left" });
  const srcLines = wrapText(ctx, ac.source, MAX_TEXT_W);
  for (let i = 0; i < srcLines.length; i++) { ctx.fillText(srcLines[i], srcX, srcY + i * mid.sourceText.lineHeight); }
  y = srcY + srcLines.length * mid.sourceText.lineHeight;

  drawBottom(ctx);
  return { canvas, hlPositions };
}

// ── Load QR image if configured ──
async function loadQrImage() {
  const qrImg = T.bottom?.qrImage;
  if (qrImg && qrImg.enabled && qrImg.src) {
    const imgPath = path.join(__dirname, "../..", qrImg.src);
    if (fs.existsSync(imgPath)) {
      qrImg._img = await loadImage(imgPath);
      console.log(`✅ Loaded QR image: ${imgPath}`);
    } else {
      console.warn(`⚠️  QR image not found: ${imgPath}`);
    }
  }
}

// ── Resize helper (for supersampling) ──
function resizeCanvas(srcCanvas, targetW, targetH) {
  const out = createCanvas(targetW, targetH);
  const octx = out.getContext("2d");
  octx.drawImage(srcCanvas, 0, 0, targetW, targetH);
  return out;
}

// ── Generate ──
(async () => {
await loadQrImage();
const coverCanvas = generateCover();
const { canvas: plainCanvas } = generateContent(false);
const { canvas: hlCanvas, hlPositions } = generateContent(true);

const issueNum = String(A.meta.issueNumber).padStart(3, "0");
const tempDir = path.join(__dirname, "../..", "data", "temp", `issue-${issueNum}`);
fs.mkdirSync(tempDir, { recursive: true });

const coverPath = path.join(tempDir, "cover.png");
const plainPath = path.join(tempDir, "content-plain.png");
const hlPath = path.join(tempDir, "content-hl.png");

fs.writeFileSync(coverPath, resizeCanvas(coverCanvas, OUTPUT_W, OUTPUT_H).toBuffer("image/png"));
fs.writeFileSync(plainPath, resizeCanvas(plainCanvas, OUTPUT_W, OUTPUT_H).toBuffer("image/png"));
fs.writeFileSync(hlPath, resizeCanvas(hlCanvas, OUTPUT_W, OUTPUT_H).toBuffer("image/png"));

console.log(`✅ Generated → temp/issue-${issueNum}/: cover.png, content-plain.png, content-hl.png`);
console.log(`   Highlights: ${hlPositions.length}`);
})();
