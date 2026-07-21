/**
 * render-satori.mjs — 基于 Satori 的模板渲染引擎
 *
 * 替代 render-images.mjs 的 Canvas 2D 方案。
 * 用法：node render-satori.mjs <configPath> [templatePath]
 *
 * 输出：data/temp/issue-XXX/{cover,content-plain,content-hl}.png
 */
import satori from "satori";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { ROOT_ASSETS, ROOT, TEMP_DIR, TEMPLATE_PATH, ARTICLES_DIR } from "@doc-flip/shared";

// ── 字体加载 ──
const FONTS_DIR = path.join(ROOT_ASSETS, "fonts");
const FONT_FILES = {
  regular: "NotoSansSC-Regular.otf",
  bold: "NotoSansSC-Bold.otf",
  calligraphy: "MaShanZheng-Regular.ttf",
};

const fonts = [];
for (const [key, file] of Object.entries(FONT_FILES)) {
  const fp = path.join(FONTS_DIR, file);
  if (fs.existsSync(fp)) {
    const data = fs.readFileSync(fp);
    const weight = key === "regular" ? 400 : 700;
    const family = key === "calligraphy" ? "Ma Shan Zheng" : "Noto Sans SC";
    fonts.push({ name: family, data, weight, style: "normal" });
  }
}

if (fonts.length === 0) {
  console.error("❌ 未找到字体文件，请运行 npm run fonts 或手动放置到 assets/fonts/");
  process.exit(1);
}

// ── 读取参数 ──
const configPath = process.argv[2] || path.join(ARTICLES_DIR, "article-001.json");
const templatePath = process.argv[3] || TEMPLATE_PATH;

const T = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
const A = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const S = T.style;
const W = S.width;
const H = S.height;
const MARGIN = S.margin;
const FONT_FAMILY = "Noto Sans SC";
const CALLIGRAPHY = "Ma Shan Zheng";

// ── h 函数：Satori 元素构造器 ──
// Satori 要求有多子节点的 div 必须显式声明 display。
// 为安全起见，所有 div 默认加 display: flex，span/img 不加。
function h(type, style, ...children) {
  const flat = children.filter((c) => c != null && c !== false);
  const isDiv = type === "div";
  const mergedStyle = isDiv && !style?.display ? { ...style, display: "flex" } : style;
  if (flat.length === 0) return { type, props: { style: mergedStyle, children: "" } };
  if (flat.length === 1 && typeof flat[0] === "string")
    return { type, props: { style: mergedStyle, children: flat[0] } };
  return { type, props: { style: mergedStyle, children: flat } };
}

function text(content, cfg, defaults = {}) {
  const size = cfg.size ?? defaults.size ?? 28;
  const color = cfg.color ?? defaults.color ?? "#666";
  const bold = cfg.bold ?? defaults.bold ?? false;
  const font = cfg.font ?? defaults.font ?? FONT_FAMILY;
  return h(
    "div",
    {
      fontSize: size,
      color,
      fontWeight: bold ? 700 : 400,
      fontFamily: font,
    },
    String(content),
  );
}

// ── 格式化辅助 ──
function formatDate(m) {
  return `${m.year}年${String(m.month).padStart(2, "0")}月${String(m.day).padStart(2, "0")}日`;
}
function formatIssue(m) {
  return `第${String(m.issueNumber).padStart(3, "0")}期`;
}

// ── 公共元素：背景、水印、装饰条 ──
function backgroundElements() {
  const els = [];
  // 背景
  if (typeof S.background === "string") {
    els.push(h("div", { position: "absolute", left: 0, top: 0, width: W, height: H, backgroundColor: S.background }));
  }
  // 水印
  const wm = S.watermark;
  if (wm?.enabled) {
    const wmText = wm.text === "auto" ? `No.${String(A.meta.issueNumber).padStart(3, "0")}` : wm.text;
    els.push(
      h(
        "div",
        {
          position: "absolute",
          left: wm.x,
          top: wm.y,
          fontSize: wm.size,
          color: wm.color,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          transform: `rotate(${((wm.rotate || -0.18) * 180) / Math.PI}deg)`,
          opacity: wm.opacity ?? 0.04,
          whiteSpace: "nowrap",
        },
        wmText,
      ),
    );
  }
  // 左侧装饰条
  const lb = S.leftBand;
  if (lb?.enabled) {
    els.push(
      h("div", { position: "absolute", left: lb.inset, top: 0, width: lb.width, height: H, backgroundColor: lb.color }),
    );
  }
  // 顶部白色区域
  const hb = S.headerBand;
  if (hb?.enabled) {
    els.push(
      h("div", { position: "absolute", left: 0, top: 0, width: W, height: hb.height, backgroundColor: hb.color }),
    );
  }
  return els;
}

// ── 公共元素：顶部区域（Logo、期号、日期、描述、双线） ──
function topElements() {
  const top = T.top;
  const logo = top.logo;
  const issNum = top.issueNumber;
  const dt = top.date;
  const desc = top.description;
  const num = String(A.meta.issueNumber).padStart(3, "0");
  const els = [];

  // Logo 印章
  els.push(
    h(
      "div",
      {
        position: "absolute",
        left: logo.x,
        top: logo.y,
        width: logo.width,
        height: logo.height,
        backgroundColor: logo.background,
        borderRadius: logo.radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      h(
        "span",
        {
          fontSize: logo.size,
          color: logo.color,
          fontFamily: CALLIGRAPHY,
          fontWeight: 700,
        },
        logo.text,
      ),
    ),
  );

  // 期号
  els.push(
    h(
      "div",
      {
        position: "absolute",
        left: issNum.x,
        top: issNum.y - issNum.numberSize / 2,
        display: "flex",
        alignItems: "center",
      },
      text("第", { size: issNum.prefixSize, color: issNum.color, bold: true }),
      h("div", { width: issNum.partSpacing || 8 }),
      text(num, { size: issNum.numberSize, color: issNum.numberColor, bold: true }),
      h("div", { width: issNum.partSpacing || 8 }),
      text("期", { size: issNum.prefixSize, color: issNum.color, bold: true }),
    ),
  );

  // 日期
  els.push(
    h(
      "div",
      { position: "absolute", left: dt.x, top: dt.y, fontSize: dt.size, color: dt.color, fontFamily: FONT_FAMILY },
      formatDate(A.meta),
    ),
  );

  // 描述
  if (A.meta.description) {
    els.push(
      h(
        "div",
        {
          position: "absolute",
          left: desc.x,
          top: desc.y,
          fontSize: desc.size,
          color: desc.color,
          fontWeight: desc.bold ? 700 : 400,
          fontFamily: FONT_FAMILY,
        },
        A.meta.description,
      ),
    );
  }

  // 双线
  const line = top.line;
  els.push(
    h("div", {
      position: "absolute",
      left: MARGIN,
      top: line.y,
      width: W - MARGIN * 2,
      height: line.width,
      backgroundColor: line.color,
    }),
  );
  els.push(
    h("div", {
      position: "absolute",
      left: MARGIN,
      top: line.y + line.gap,
      width: W - MARGIN * 2,
      height: line.width,
      backgroundColor: line.color,
    }),
  );

  return els;
}

// ── 公共元素：底部区域 ──
function bottomElements() {
  const bot = T.bottom;
  const els = [];

  // 双线
  els.push(
    h("div", {
      position: "absolute",
      left: MARGIN,
      top: bot.line.y,
      width: W - MARGIN * 2,
      height: bot.line.width,
      backgroundColor: bot.line.color,
    }),
  );
  els.push(
    h("div", {
      position: "absolute",
      left: MARGIN,
      top: bot.line.y + bot.line.gap,
      width: W - MARGIN * 2,
      height: bot.line.width,
      backgroundColor: bot.line.color,
    }),
  );

  // 底部白色区域
  const lowestY = [
    bot.qrImage?.enabled ? bot.qrImage.y : null,
    bot.qrPlaceholder?.enabled ? bot.qrPlaceholder.y : null,
    bot.text?.y,
  ].filter((v) => v != null);
  const bandY = bot.band?.enabled ? Math.min(...lowestY) - 10 : 0;
  if (bot.band?.enabled) {
    els.push(
      h("div", {
        position: "absolute",
        left: 0,
        top: bandY,
        width: W,
        height: bot.band.height,
        backgroundColor: bot.band.color,
      }),
    );
  }

  // 底部文字
  const txt = bot.text;
  if (txt) {
    els.push(
      h(
        "div",
        {
          position: "absolute",
          left: 0,
          top: txt.y,
          width: W,
          display: "flex",
          justifyContent: "center",
          fontSize: txt.size,
          color: txt.color,
          fontWeight: txt.bold ? 700 : 400,
          fontFamily: txt.font || FONT_FAMILY,
        },
        typeof txt.content === "string" ? txt.content : String(txt.content || ""),
      ),
    );
  }

  // 二维码图片（暂时跳过 img，用占位符）
  const qrImg = bot.qrImage;
  if (qrImg?.enabled) {
    els.push(
      h(
        "div",
        {
          position: "absolute",
          left: qrImg.x,
          top: qrImg.y,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        },
        h(
          "div",
          {
            width: qrImg.size,
            height: qrImg.size,
            border: "1px solid #ddd",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "#999",
          },
          "QR",
        ),
        h(
          "span",
          { fontSize: qrImg.labelSize, color: qrImg.labelColor, marginTop: 4, fontFamily: FONT_FAMILY },
          qrImg.label,
        ),
      ),
    );
  }

  return els;
}

// ── 条形码占位（Satori 不支持 Canvas 绘制，用文字代替） ──
function barcodeElements() {
  const bc = T.barcode;
  if (!bc?.enabled) return [];
  const ymd = `${A.meta.year}${String(A.meta.month).padStart(2, "0")}${String(A.meta.day).padStart(2, "0")}`;
  const barcodeText = bc.text === "auto" ? ymd + A.meta.issueNumber : bc.text;
  return [
    h(
      "div",
      {
        position: "absolute",
        left: bc.x,
        top: bc.y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      },
      h(
        "div",
        {
          width: bc.width,
          height: bc.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bc.bgColor === "transparent" ? "transparent" : bc.bgColor,
          border: `1px solid ${bc.barColor || "#333"}`,
          fontSize: Math.round(bc.height * 0.4),
          color: bc.barColor || "#333",
          fontFamily: "monospace",
          letterSpacing: 2,
        },
        "||||||||||",
      ),
      h(
        "span",
        { fontSize: bc.textSize || 14, color: bc.textColor || "#000", fontFamily: FONT_FAMILY, marginTop: 2 },
        barcodeText,
      ),
    ),
  ];
}

// ── 文字折行辅助（Satori 用 CSS 处理，这里做预估） ──
function wrapText(text, fontSize, maxWidth) {
  if (!text) return [];
  const charW = fontSize * 0.55; // 中文字符近似宽度
  const maxChars = Math.floor(maxWidth / charW);
  const lines = [];
  let line = "";
  for (const ch of text) {
    if (line.length >= maxChars && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ══════════════════════════════════════
// Cover 页面
// ══════════════════════════════════════
function buildCover() {
  const mid = T.middle;
  const ac = A.cover;

  return h(
    "div",
    {
      width: W,
      height: H,
      display: "flex",
      flexDirection: "column",
      position: "relative",
      backgroundColor: S.background,
      fontFamily: FONT_FAMILY,
      overflow: "hidden",
    },
    ...backgroundElements(),
    ...topElements(),
    ...barcodeElements(),

    // 标签
    h(
      "div",
      {
        position: "absolute",
        left: mid.tag.x,
        top: mid.tag.y,
        width: mid.tag.width,
        height: mid.tag.height,
        backgroundColor: mid.tag.background,
        borderRadius: mid.tag.radius,
        display: "flex",
        alignItems: "center",
        paddingLeft: mid.tag.paddingX,
      },
      text(mid.tag.text, mid.tag),
    ),

    // 标题
    h(
      "div",
      {
        position: "absolute",
        left: mid.headline.x,
        top: mid.headline.y,
        width: W - MARGIN * 2,
        fontSize: mid.headline.size,
        color: mid.headline.color,
        fontWeight: mid.headline.bold ? 700 : 400,
        lineHeight: `${mid.headline.lineHeight}px`,
        fontFamily: FONT_FAMILY,
      },
      ac.headline,
    ),

    // 来源
    h(
      "div",
      {
        position: "absolute",
        left: mid.source.x,
        top: mid.source.y,
        fontSize: mid.source.size,
        color: mid.source.color,
        lineHeight: `${mid.source.lineHeight}px`,
        fontFamily: FONT_FAMILY,
      },
      ac.source,
    ),

    ...bottomElements(),
  );
}

// ══════════════════════════════════════
// Content 页面（正文）
// ══════════════════════════════════════
function buildContent(withHighlights) {
  const mid = T.middle;
  const ac = A.content;
  const body = mid.body;
  const div = mid.divider;

  // 构建段落
  const paraElements = [];
  let y = mid.contentTitle.y || mid.y || 350;

  // 标题
  if (ac.title) {
    const titleCfg = mid.contentTitle;
    paraElements.push(
      h(
        "div",
        {
          position: "absolute",
          left: titleCfg.x || MARGIN,
          top: y,
          fontSize: titleCfg.size,
          color: titleCfg.color,
          fontWeight: titleCfg.bold ? 700 : 400,
          lineHeight: `${titleCfg.lineHeight}px`,
          fontFamily: FONT_FAMILY,
          width: W - MARGIN * 2,
        },
        // 如果有高亮且启用高亮模式，标记高亮文字
        withHighlights && ac.titleHighlight
          ? h("div", { display: "flex" }, highlightText(ac.title, ac.titleHighlight, titleCfg.size, titleCfg.bold))
          : ac.title,
      ),
    );
    const titleLines = wrapText(ac.title, titleCfg.size, W - MARGIN * 2);
    y += titleLines.length * titleCfg.lineHeight;
  }

  // 副标题
  if (ac.subtitle) {
    const subCfg = mid.contentSubtitle;
    y += 10;
    paraElements.push(
      h(
        "div",
        {
          position: "absolute",
          left: subCfg.x || MARGIN,
          top: y,
          fontSize: subCfg.size,
          color: subCfg.color,
          fontWeight: subCfg.bold ? 700 : 400,
          lineHeight: `${subCfg.lineHeight}px`,
          fontFamily: FONT_FAMILY,
          width: W - MARGIN * 2,
        },
        withHighlights && ac.subtitleHighlight
          ? highlightText(ac.subtitle, ac.subtitleHighlight, subCfg.size, subCfg.bold)
          : ac.subtitle || "",
      ),
    );
    const subLines = wrapText(ac.subtitle || "", subCfg.size, W - MARGIN * 2);
    y += Math.max(1, subLines.length) * subCfg.lineHeight;
  }

  // 分割线
  if (div?.enabled) {
    y = div.y || y + 30;
    const dotCount = Math.floor((W - MARGIN * 2 - 40) / (div.dotGap || 16));
    const dotsText = Array(dotCount).fill("·").join(" ");
    paraElements.push(
      h(
        "div",
        {
          position: "absolute",
          left: MARGIN + 20,
          top: y,
          fontSize: (div.dotRadius || 2.5) * 4,
          color: div.color,
          letterSpacing: div.dotGap || 16,
          fontFamily: FONT_FAMILY,
        },
        dotsText,
      ),
    );
    y += (div.dotRadius || 2.5) * 2 + 20;
  }

  // 正文段落
  y = Math.max(y, (mid.y || 350) + 300); // 确保在标题区域下方
  const bodyTop = y;
  for (const para of ac.paragraphs) {
    if (!para.text) continue;
    const isBold = para.bold;
    const fontSize = isBold ? body.fontSize + 4 : body.fontSize;
    const paraLines = wrapText(para.text, fontSize, W - MARGIN * 2 - (isBold ? 0 : 48));
    const lineHeight = body.lineHeight;

    paraElements.push(
      h(
        "div",
        {
          position: "absolute",
          left: MARGIN,
          top: y,
          fontSize,
          color: isBold ? body.boldColor : body.color,
          fontWeight: isBold ? 700 : 400,
          lineHeight: `${lineHeight}px`,
          fontFamily: FONT_FAMILY,
          width: W - MARGIN * 2,
        },
        withHighlights && para.highlight ? highlightText(para.text, para.highlight, fontSize, isBold) : para.text,
      ),
    );
    y += paraLines.length * lineHeight + 10;
  }

  // 来源文字
  const srcCfg = mid.sourceText;
  if (ac.source) {
    y = srcCfg.y || y + (srcCfg.gapFromContent || 30);
    paraElements.push(
      h(
        "div",
        {
          position: "absolute",
          left: srcCfg.x || MARGIN,
          top: y,
          fontSize: srcCfg.size,
          color: srcCfg.color,
          lineHeight: `${srcCfg.lineHeight}px`,
          fontFamily: FONT_FAMILY,
          width: W - MARGIN * 2,
        },
        ac.source,
      ),
    );
  }

  return h(
    "div",
    {
      width: W,
      height: H,
      display: "flex",
      flexDirection: "column",
      position: "relative",
      backgroundColor: S.background,
      fontFamily: FONT_FAMILY,
      overflow: "hidden",
    },
    ...backgroundElements(),
    ...topElements(),
    ...paraElements,
    ...bottomElements(),
  );
}

// ── 高亮文字渲染 ──
function highlightText(fullText, keyword, fontSize, isBold) {
  const idx = fullText.indexOf(keyword);
  if (idx === -1) return fullText;
  const before = fullText.slice(0, idx);
  const after = fullText.slice(idx + keyword.length);
  // 用容器包裹，避免单个 span 有多个子节点
  const parts = [];
  if (before) parts.push(h("span", { fontFamily: FONT_FAMILY }, before));
  parts.push(
    h(
      "span",
      {
        backgroundColor: "#FFD700",
        color: "#cc0000",
        fontWeight: 700,
        fontSize,
        padding: "0 4px",
        borderRadius: 4,
        fontFamily: FONT_FAMILY,
      },
      keyword,
    ),
  );
  if (after) parts.push(h("span", { fontFamily: FONT_FAMILY }, after));
  return h("div", { display: "flex", flexWrap: "wrap" }, ...parts);
}

// ══════════════════════════════════════
// 主流程
// ══════════════════════════════════════
async function renderToPng(element, outputPath) {
  // 2x 超采样再缩放，与 Canvas 方案一致，消除锯齿
  const SCALE = 2;
  const svg = await satori(element, { width: W * SCALE, height: H * SCALE, fonts });
  await sharp(Buffer.from(svg)).resize(W, H, { kernel: "lanczos3" }).png().toFile(outputPath);
}

async function main() {
  const issueNum = String(A.meta.issueNumber).padStart(3, "0");
  const tempDir = path.join(TEMP_DIR, `issue-${issueNum}`);
  fs.mkdirSync(tempDir, { recursive: true });

  console.log(`🎨 Satori 渲染: 第${issueNum}期`);
  const start = Date.now();

  // Cover
  const coverPath = path.join(tempDir, "cover.png");
  await renderToPng(buildCover(), coverPath);
  console.log(`   ✅ cover.png (${Date.now() - start}ms)`);

  // Content (plain)
  const plainStart = Date.now();
  const plainPath = path.join(tempDir, "content-plain.png");
  await renderToPng(buildContent(false), plainPath);
  console.log(`   ✅ content-plain.png (${Date.now() - plainStart}ms)`);

  // Content (with highlights)
  const hlStart = Date.now();
  const hlPath = path.join(tempDir, "content-hl.png");
  await renderToPng(buildContent(true), hlPath);
  console.log(`   ✅ content-hl.png (${Date.now() - hlStart}ms)`);

  console.log(`✅ 总耗时: ${Date.now() - start}ms → ${tempDir}`);
}

main().catch((e) => {
  console.error("❌ 渲染失败:", e.message);
  process.exit(1);
});
