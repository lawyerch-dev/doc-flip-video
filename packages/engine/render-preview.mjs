/**
 * render-preview.mjs — 模板编辑器的实时预览渲染器
 *
 * 从环境变量 SATORI_STYLE 读取样式配置，从 SATORI_VIEW 读取视图类型。
 * 输出到 data/temp/editor-preview.png
 *
 * 用法（由 template-editor.mjs API 调用）：
 *   SATORI_STYLE='{"accent":"#cc0000",...}' SATORI_VIEW=cover node render-preview.mjs config.json
 */
import satori from "satori";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { ROOT_ASSETS, ROOT, TEMP_DIR, ARTICLES_DIR } from "../../config/paths.mjs";

// ── 字体 ──
const FONTS_DIR = path.join(ROOT_ASSETS, "fonts");
const fontDefs = [
  ["NotoSansSC-Regular.otf", "Noto Sans SC", 400],
  ["NotoSansSC-Bold.otf", "Noto Sans SC", 700],
  ["MaShanZheng-Regular.ttf", "Ma Shan Zheng", 700],
];
const fonts = [];
for (const [file, family, weight] of fontDefs) {
  const fp = path.join(FONTS_DIR, file);
  if (fs.existsSync(fp)) fonts.push({ name: family, data: fs.readFileSync(fp), weight, style: "normal" });
}

// ── 参数 ──
const configPath = process.argv[2] || path.join(ARTICLES_DIR, "article-001.json");
const view = process.env.SATORI_VIEW || "cover";
let style = {};
try {
  style = JSON.parse(process.env.SATORI_STYLE || "{}");
} catch {}

const A = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const W = 1080,
  H = 1840;

// ── 辅助 ──
function formatDate(m) {
  return `${m.year}年${String(m.month).padStart(2, "0")}月${String(m.day).padStart(2, "0")}日`;
}
function pad3(n) {
  return String(n).padStart(3, "0");
}

// h 函数：自动给 div 加 display:flex
function h(type, s, ...children) {
  const flat = children.filter((c) => c != null && c !== false);
  const isDiv = type === "div";
  const merged = isDiv && !s?.display ? { ...s, display: "flex" } : s;
  if (flat.length === 0) return { type, props: { style: merged, children: "" } };
  if (flat.length === 1 && typeof flat[0] === "string") return { type, props: { style: merged, children: flat[0] } };
  return { type, props: { style: merged, children: flat } };
}

// 高亮渲染
function hl(text, kw, fs, color, bgColor) {
  if (!kw || !text.includes(kw)) return text;
  const i = text.indexOf(kw);
  const b = text.slice(0, i),
    a = text.slice(i + kw.length);
  const p = [];
  if (b) p.push(h("span", { fontFamily: "Noto Sans SC" }, b));
  p.push(
    h(
      "span",
      {
        backgroundColor: bgColor || "#FFD700",
        color: color || "#cc0000",
        fontWeight: 700,
        padding: "0 4px",
        borderRadius: 4,
      },
      kw,
    ),
  );
  if (a) p.push(h("span", { fontFamily: "Noto Sans SC" }, a));
  return h("div", { display: "flex", flexWrap: "wrap" }, ...p);
}

// ── 公共装饰元素 ──
function decorations(s, m) {
  const accent = s.accent || "#cc0000";
  const bg = s.bgColor || "#ffffff";
  const num = pad3(m.issueNumber);
  const bcText = `${m.year}${String(m.month).padStart(2, "0")}${String(m.day).padStart(2, "0")}${num}`;
  return [
    h(
      "div",
      {
        position: "absolute",
        left: 700,
        top: 1100,
        fontSize: 220,
        fontWeight: 700,
        color: "rgba(204,0,0,0.04)",
        transform: "rotate(-10.3deg)",
        whiteSpace: "nowrap",
        fontFamily: "Noto Sans SC",
      },
      `No.${num}`,
    ),
    h("div", { position: "absolute", left: 40, top: 0, width: 8, height: H, background: accent }),
    h("div", { position: "absolute", left: 0, top: 0, width: W, height: 490, background: bg }),
    // Logo
    h(
      "div",
      {
        position: "absolute",
        left: s.logo?.x ?? 120,
        top: s.logo?.y ?? 350,
        width: s.logo?.w ?? 380,
        height: s.logo?.h ?? 200,
        background: accent,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      h(
        "span",
        { fontFamily: "Ma Shan Zheng", fontSize: s.logo?.size ?? 108, fontWeight: 700, color: "#fff" },
        s.logo?.text || "法务",
      ),
    ),
    // 期号
    h(
      "div",
      { position: "absolute", left: 600, top: 330, display: "flex", alignItems: "center" },
      h("span", { fontSize: 44, fontWeight: 700, color: "#333", fontFamily: "Noto Sans SC" }, "第"),
      h("div", { width: 8 }),
      h("span", { fontSize: 96, fontWeight: 700, color: accent, fontFamily: "Noto Sans SC" }, num),
      h("div", { width: 8 }),
      h("span", { fontSize: 44, fontWeight: 700, color: "#333", fontFamily: "Noto Sans SC" }, "期"),
    ),
    h(
      "div",
      { position: "absolute", left: 620, top: 440, fontSize: 35, color: "#333", fontFamily: "Noto Sans SC" },
      formatDate(m),
    ),
    m.description
      ? h(
          "div",
          {
            position: "absolute",
            left: 550,
            top: 500,
            fontSize: 36,
            fontWeight: 700,
            color: s.titleColor || "#1a1a1a",
            fontFamily: "Noto Sans SC",
          },
          m.description,
        )
      : null,
    h("div", { position: "absolute", left: 80, top: 585, width: 920, height: 2, background: accent }),
    h("div", { position: "absolute", left: 80, top: 592, width: 920, height: 2, background: accent }),
    h(
      "div",
      { position: "absolute", left: 820, top: 225, display: "flex", flexDirection: "column", alignItems: "center" },
      h(
        "div",
        {
          width: 200,
          height: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #333",
          fontFamily: "monospace",
          fontSize: 28,
          letterSpacing: 2,
          color: "#333",
        },
        "||||||||||",
      ),
      h("div", { fontSize: 14, color: "#000", marginTop: 2, fontFamily: "Noto Sans SC" }, bcText),
    ),
    // 底部
    h("div", { position: "absolute", left: 80, top: 1350, width: 920, height: 2, background: accent }),
    h("div", { position: "absolute", left: 80, top: 1357, width: 920, height: 2, background: accent }),
    h("div", { position: "absolute", left: 0, top: 1430, width: W, height: 160, background: bg }),
    h(
      "div",
      { position: "absolute", left: 80, top: 1440, display: "flex", flexDirection: "column", alignItems: "center" },
      h(
        "div",
        {
          width: 120,
          height: 120,
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
      h("div", { fontSize: 14, color: "#000", marginTop: 4, fontFamily: "Noto Sans SC" }, "扫码关注"),
    ),
    h(
      "div",
      {
        position: "absolute",
        left: 0,
        top: s.footer?.y ?? 1470,
        width: W,
        display: "flex",
        justifyContent: "center",
        fontSize: s.footer?.size ?? 58,
        fontWeight: 700,
        color: "#000",
        fontFamily: "Noto Sans SC",
      },
      s.footer?.text || "关注我，了解更多法律新鲜事",
    ),
  ];
}

// ── Cover ──
function buildCover(s, m, ac) {
  const accent = s.accent || "#cc0000";
  return h(
    "div",
    {
      width: W,
      height: H,
      display: "flex",
      position: "relative",
      background: s.bgColor || "#fff",
      fontFamily: "Noto Sans SC",
      overflow: "hidden",
    },
    ...decorations(s, m),
    h(
      "div",
      {
        position: "absolute",
        left: s.tag?.x ?? 80,
        top: s.tag?.y ?? 650,
        width: 120,
        height: 42,
        background: "#f5f0e8",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        paddingLeft: 16,
        fontSize: 22,
        fontWeight: 700,
        color: "#1a1a1a",
      },
      s.tag?.text || "本期内容",
    ),
    h(
      "div",
      {
        position: "absolute",
        left: s.headline?.x ?? 80,
        top: s.headline?.y ?? 750,
        width: 920,
        fontSize: s.headline?.size ?? 50,
        fontWeight: 700,
        color: s.titleColor || "#1a1a1a",
        lineHeight: "60px",
      },
      ac.headline,
    ),
    h("div", { position: "absolute", left: 80, top: 1000, fontSize: 36, color: "#666", lineHeight: "36px" }, ac.source),
  );
}

// ── Content ──
function buildContent(s, m, ac, withHl) {
  const fontSize = s.body?.size ?? 32;
  const lh = s.body?.lineHeight ?? 56;
  const bodyX = s.body?.x ?? 80;
  const bodyY = s.body?.y ?? 900;

  const paras = [];
  let y = bodyY;
  for (const p of ac.paragraphs) {
    if (!p.text) continue;
    const content = withHl && p.highlight ? hl(p.text, p.highlight, fontSize, s.hlColor, s.hlBg) : p.text;
    const isObj = typeof content !== "string";
    paras.push(
      h(
        "div",
        {
          position: "absolute",
          left: bodyX,
          top: y,
          width: 920,
          fontSize,
          color: s.bodyColor || "#1a1a1a",
          lineHeight: `${lh}px`,
          display: isObj ? "flex" : undefined,
          flexWrap: isObj ? "wrap" : undefined,
        },
        content,
      ),
    );
    y += lh * 4 + 10;
  }

  return h(
    "div",
    {
      width: W,
      height: H,
      display: "flex",
      position: "relative",
      background: s.bgColor || "#fff",
      fontFamily: "Noto Sans SC",
      overflow: "hidden",
    },
    ...decorations(s, m),
    h(
      "div",
      {
        position: "absolute",
        left: 80,
        top: 650,
        width: 920,
        fontSize: 48,
        fontWeight: 700,
        color: s.accent || "#cc0000",
        lineHeight: "50px",
      },
      ac.title,
    ),
    h(
      "div",
      { position: "absolute", left: 100, top: 858, fontSize: 10, color: "rgba(204,0,0,0.3)", letterSpacing: 16 },
      Array(50).fill("·").join(" "),
    ),
    ...paras,
    h(
      "div",
      { position: "absolute", left: 80, top: 1250, width: 920, fontSize: 28, color: "#999", lineHeight: "38px" },
      ac.source,
    ),
  );
}

// ── 渲染 ──
async function main() {
  const m = A.meta;
  const ac = view === "cover" ? A.cover : A.content;
  const el = view === "cover" ? buildCover(style, m, ac) : buildContent(style, m, ac, view === "hl");

  const SCALE = 2;
  const svg = await satori(el, { width: W * SCALE, height: H * SCALE, fonts });
  const outPath = path.join(TEMP_DIR, "editor-preview.png");
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  await sharp(Buffer.from(svg)).resize(W, H, { kernel: "lanczos3" }).png().toFile(outPath);
}

main().catch((e) => {
  console.error("render-preview error:", e.message);
  process.exit(1);
});
