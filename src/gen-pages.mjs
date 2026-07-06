import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JsBarcode from "jsbarcode";

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
      // Soft highlight background (rounded, translucent)
      ctx.fillStyle = bodyCfg.highlightColor || "rgba(255,210,0,0.35)";
      roundRect(ctx, bx - 4, ly - fontSize * 0.35, bw + 8, fontSize * 1.3, 4); ctx.fill();
      // Bold text on highlight
      ctx.fillStyle = bodyCfg.highlightTextColor || "#8b1a1a";
      ctx.font = `bold ${fontSize}px ${FONT}`;
      ctx.fillText(matched, bx, ly);
      ctx.font = `${fontSize}px ${FONT}`;
      // Underline accent
      const ulColor = bodyCfg.highlightUnderlineColor || "rgba(204,0,0,0.6)";
      ctx.strokeStyle = ulColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, ly + fontSize * 0.95);
      ctx.lineTo(bx + bw, ly + fontSize * 0.95);
      ctx.stroke();
    }
    positions.push({ x: bx - 4, y: ly - fontSize * 0.35, w: bw + 8, h: fontSize * 1.3 });
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
      const m = A.meta.issue.match(/\d+/);
      wmText = m ? `No.${m[0]}` : A.meta.issue;
    }
    ctx.save();
    ctx.globalAlpha = wm.opacity != null ? wm.opacity : 1;
    ctx.fillStyle = wm.color;
    ctx.font = `${wm.bold !== false ? "bold " : ""}${wm.size}px ${FONT}`;
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
  // Extract digits only (Code128B needs ASCII 32-127)
  const raw = bc.text === "auto" ? A.meta.issue : bc.text;
  const text = raw.replace(/[^0-9]/g, "") || "0000";

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
    ctx.font = `${bc.textSize || 14}px ${FONT}`;
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
  ctx.font = `bold ${logo.size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(logo.text, logo.x + logo.width / 2, logo.y + logo.height / 2);
  const sealBottom = logo.y + logo.height;

  // ── Issue number at absolute x,y ──
  const prefixFont = `bold ${issNum.prefixSize}px ${FONT}`;
  const numFont = `bold ${issNum.numberSize}px ${FONT}`;
  const numMatch = meta.issue.match(/第(\d+)期/);
  const num = numMatch ? numMatch[1] : "";
  const partGap = issNum.partSpacing || 8;

  let ix = issNum.x;
  ctx.textBaseline = "middle";
  ctx.fillStyle = issNum.color;
  ctx.font = prefixFont;
  ctx.textAlign = "left";
  ctx.fillText("第", ix, issNum.y);
  ix += ctx.measureText("第").width + partGap;
  ctx.fillStyle = issNum.numberColor;
  ctx.font = numFont;
  ctx.fillText(num, ix, issNum.y);
  ix += ctx.measureText(num).width + partGap;
  ctx.fillStyle = issNum.color;
  ctx.font = prefixFont;
  ctx.fillText("期", ix, issNum.y);
  const issBottom = issNum.y + issNum.numberSize / 2;

  // ── Date at absolute x,y ──
  ctx.fillStyle = dt.color;
  ctx.font = `${dt.size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(meta.date, dt.x, dt.y);

  // ── Description at absolute x,y ──
  let descBottom = dt.y + dt.size;
  if (meta.description) {
    ctx.fillStyle = desc.color;
    ctx.font = `${desc.bold ? "bold " : ""}${desc.size}px ${FONT}`;
    ctx.fillText(meta.description, desc.x, desc.y);
    descBottom = desc.y + desc.size;
  }

  // ── Double line (auto from all bottoms, or fixed y) ──
  const allBottom = Math.max(sealBottom, issBottom, dt.y + dt.size, descBottom);
  const lineY = top.line.auto ? (allBottom + (top.line.gapFromContent || 35)) : top.line.y;
  top.line.y = lineY;
  ctx.strokeStyle = top.line.color;
  ctx.lineWidth = top.line.width;
  ctx.beginPath(); ctx.moveTo(MARGIN, lineY); ctx.lineTo(W - MARGIN, lineY); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(MARGIN, lineY + top.line.gap); ctx.lineTo(W - MARGIN, lineY + top.line.gap); ctx.stroke();

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
  return (div.marginAbove || 0) + (div.marginBelow || 0) + dotR * 2;
}

// ── Bottom section ──
function drawBottom(ctx, contentEndY) {
  const bot = T.bottom;
  // Gray footer band
  const bandH = bot.band && bot.band.enabled ? bot.band.height : 0;
  const lineY = Math.max(contentEndY + 30, H - bot.bottomMargin - bandH);

  // Double line
  ctx.strokeStyle = bot.line.color;
  ctx.lineWidth = bot.line.width;
  ctx.beginPath(); ctx.moveTo(MARGIN, lineY); ctx.lineTo(W - MARGIN, lineY); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(MARGIN, lineY + bot.line.gap); ctx.lineTo(W - MARGIN, lineY + bot.line.gap); ctx.stroke();
  // Footer text
  ctx.fillStyle = bot.color;
  ctx.font = `${bot.size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(T.bottom.text, W / 2, lineY + bot.gapFromLine);

  // Gray band at bottom
  if (bot.band && bot.band.enabled) {
    const bandY = H - bandH;
    ctx.fillStyle = bot.band.color;
    ctx.fillRect(0, bandY, W, bandH);

    // QR placeholder
    const qr = bot.qrPlaceholder;
    if (qr && qr.enabled) {
      const qrX = qr.x != null ? qr.x : (W - MARGIN - qr.size - 20);
      const qrY = qr.y != null ? qr.y : (bandY + (bandH - qr.size - qr.labelSize - 8) / 2);
      // QR border box
      ctx.strokeStyle = qr.borderColor;
      ctx.lineWidth = 1.5;
      roundRect(ctx, qrX, qrY, qr.size, qr.size, 6); ctx.stroke();
      // "QR" placeholder text inside
      ctx.fillStyle = "#cccccc";
      ctx.font = `bold ${Math.round(qr.size * 0.28)}px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("QR", qrX + qr.size / 2, qrY + qr.size / 2);
      // Label below QR
      ctx.fillStyle = qr.labelColor;
      ctx.font = `${qr.labelSize}px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(qr.label, qrX + qr.size / 2, qrY + qr.size + 6);
    }
  }
}

// ── Cover (middle section) ──
function generateCover() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawBackground(ctx);
  drawTop(ctx);

  const mid = T.middle;
  const ac = A.cover;
  ctx.font = `bold ${mid.headline.size}px ${FONT}`;
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
  ctx.fillStyle = mid.tag.color;
  ctx.font = `${mid.tag.bold ? "bold " : ""}${mid.tag.size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(mid.tag.text, tagX + mid.tag.paddingX, tagY + mid.tag.height / 2);
  y = tagY + mid.tag.height;

  // Headline (absolute x,y or flow)
  const hlX = mid.headline.x != null ? mid.headline.x : MARGIN;
  const hlY = mid.headline.y != null ? mid.headline.y : (y + mid.spacing.tagToHeadline);
  ctx.fillStyle = mid.headline.color;
  ctx.font = `${mid.headline.bold ? "bold " : ""}${mid.headline.size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  for (let i = 0; i < headlineLines.length; i++) { ctx.fillText(headlineLines[i], hlX, hlY + i * mid.headline.lineHeight); }
  y = hlY + headlineLines.length * mid.headline.lineHeight;

  // Source (absolute x,y or flow)
  const srcX = mid.source.x != null ? mid.source.x : MARGIN;
  const srcY = mid.source.y != null ? mid.source.y : (y + mid.spacing.headlineToSource);
  ctx.fillStyle = mid.source.color;
  ctx.font = `${mid.source.size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  const srcLines = wrapText(ctx, ac.source, MAX_TEXT_W);
  for (let i = 0; i < srcLines.length; i++) { ctx.fillText(srcLines[i], srcX, srcY + i * mid.source.lineHeight); }
  y = srcY + srcLines.length * mid.source.lineHeight;

  drawBottom(ctx, y);
  return canvas;
}

// ── Content (middle section) ──
function generateContent(withHighlights) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawBackground(ctx);
  drawTop(ctx);

  const mid = T.middle;
  const ac = A.content;
  const body = mid.body;
  const hlPositions = [];
  const indent = body.indent === "auto" ? ctx.measureText("　　").width : (body.indent || 0);

  // Divider height estimation
  const div = mid.divider;
  const dividerH = div && div.enabled ? ((div.marginAbove || 0) + (div.marginBelow || 0) + (div.dotRadius || 2.5) * 2) : 0;

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
  const contentH = totalLines * body.lineHeight + dividerH;
  const areaTop = mid.y || (T.top.line.y + 40);
  const areaBottom = H - T.bottom.bottomMargin - 60;
  let y = areaTop + Math.max(20, (areaBottom - areaTop - contentH) / 2);

  ctx.textAlign = "left"; ctx.textBaseline = "top";

  // Title (absolute x,y or flow)
  const titleY = mid.contentTitle.y != null ? mid.contentTitle.y : y;
  const titleX = mid.contentTitle.x != null ? mid.contentTitle.x : MARGIN;
  ctx.fillStyle = mid.contentTitle.color;
  ctx.font = `${mid.contentTitle.bold ? "bold " : ""}${mid.contentTitle.size}px ${FONT}`;
  const titleLines = wrapText(ctx, ac.title, MAX_TEXT_W);
  const titleXs = titleLines.map(() => titleX);
  for (let i = 0; i < titleLines.length; i++) ctx.fillText(titleLines[i], titleX, titleY + i * mid.contentTitle.lineHeight);
  if (ac.titleHighlight) hlPositions.push(...highlightLines(ctx, titleLines, titleXs, titleY, mid.contentTitle.lineHeight, mid.contentTitle.size, ac.titleHighlight, withHighlights, body));
  y = titleY + titleLines.length * mid.contentTitle.lineHeight;

  // Subtitle (absolute x,y or flow)
  const subY = mid.contentSubtitle.y != null ? mid.contentSubtitle.y : y;
  const subX = mid.contentSubtitle.x != null ? mid.contentSubtitle.x : MARGIN;
  ctx.fillStyle = mid.contentSubtitle.color;
  ctx.font = `${mid.contentSubtitle.bold ? "bold " : ""}${mid.contentSubtitle.size}px ${FONT}`;
  const subLines = wrapText(ctx, ac.subtitle, MAX_TEXT_W);
  const subXs = subLines.map(() => subX);
  for (let i = 0; i < subLines.length; i++) ctx.fillText(subLines[i], subX, subY + i * mid.contentSubtitle.lineHeight);
  if (ac.subtitleHighlight) hlPositions.push(...highlightLines(ctx, subLines, subXs, subY, mid.contentSubtitle.lineHeight, mid.contentSubtitle.size, ac.subtitleHighlight, withHighlights, body));
  y = subY + subLines.length * mid.contentSubtitle.lineHeight;

  // Dot divider
  y += (div && div.enabled ? div.marginAbove : 40);
  drawDotDivider(ctx, y);
  y += (div && div.enabled ? (div.marginBelow + (div.dotRadius || 2.5) * 2) : 20);

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

  // Source (absolute x,y or flow)
  const srcY = mid.sourceText.y != null ? mid.sourceText.y : (y + mid.sourceText.gapFromContent);
  const srcX = mid.sourceText.x != null ? mid.sourceText.x : MARGIN;
  ctx.fillStyle = mid.sourceText.color;
  ctx.font = `${mid.sourceText.size}px ${FONT}`;
  const srcLines = wrapText(ctx, ac.source, MAX_TEXT_W);
  for (let i = 0; i < srcLines.length; i++) { ctx.fillText(srcLines[i], srcX, srcY + i * mid.sourceText.lineHeight); }
  y = srcY + srcLines.length * mid.sourceText.lineHeight;

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
