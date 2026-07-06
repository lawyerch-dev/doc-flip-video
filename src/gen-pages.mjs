import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "assets");
fs.mkdirSync(ASSETS, { recursive: true });

const W = 1920, H = 1080;
const FONT = '"PingFang SC","Noto Sans SC",sans-serif';

// ── Load config ──
const configPath = process.argv[2] || path.join(__dirname, "..", "article.json");
const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// ── Helpers ──
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

// ── Cover ──
function generateCover(co) {
  const canvas = createCanvas(W, H);
  const c = canvas.getContext("2d");
  const cx = W / 2, cy = H * 0.28;

  c.fillStyle = "#c0392b"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#d4a017"; c.fillRect(0, 0, W, 4);

  // Logo circle
  c.beginPath(); c.arc(cx, cy, 65, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill();
  c.beginPath(); c.arc(cx, cy, 58, 0, Math.PI * 2); c.fillStyle = "#c0392b"; c.fill();
  c.fillStyle = "#fff"; c.font = `bold 48px serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(co.title, cx, cy);

  c.fillStyle = "#d4a017"; c.font = "22px sans-serif"; c.fillText(co.subtitle, cx, cy + 110);
  c.fillStyle = "#fff"; c.font = "bold 28px sans-serif"; c.fillText(co.date, cx, cy + 150);

  c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(W * 0.15, cy + 180); c.lineTo(W * 0.85, cy + 180); c.stroke();

  c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "22px sans-serif"; c.fillText(co.tagline, cx, cy + 210);
  c.fillStyle = "#fff"; c.font = "bold 42px serif"; c.fillText(co.headline, cx, cy + 295);
  c.font = "30px serif"; c.fillText(co.headlineSub, cx, cy + 340);

  const boxY = cy + 380;
  c.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(c, W * 0.12, boxY, W * 0.76, 55, 8); c.fill();
  c.fillStyle = "#fff"; c.font = "21px sans-serif"; c.fillText(co.keywords, cx, boxY + 35);

  const barY = H - 110;
  c.fillStyle = "rgba(255,255,255,0.8)";
  for (let i = 0; i < 35; i++) c.fillRect(W / 2 - 100 + i * 6, barY, Math.random() > 0.5 ? 2 : 4, 42);
  c.fillStyle = "rgba(255,255,255,0.5)"; c.font = "14px monospace"; c.fillText(co.footer, cx, barY + 60);
  c.fillStyle = "#d4a017"; c.fillRect(0, H - 4, W, 4);

  return canvas;
}

// ── Content page ──
function generateContent(ct, withHighlights) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background & header
  ctx.fillStyle = "#fdf6ec"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#c0392b"; ctx.fillRect(0, 0, W, 75);
  ctx.fillStyle = "#d4a017"; ctx.fillRect(0, 75, W, 3);
  ctx.fillStyle = "#fff"; ctx.font = `bold 26px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ct.header, W / 2, 38);

  // Title
  ctx.textAlign = "left";
  ctx.fillStyle = "#c0392b"; ctx.font = `bold 36px serif`; ctx.fillText(ct.title, 60, 140);
  ctx.fillStyle = "#1a1a1a"; ctx.font = "26px serif"; ctx.fillText(ct.subtitle, 60, 185);
  ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(60, 205); ctx.lineTo(W - 60, 205); ctx.stroke();

  // Body
  const fontSize = 22, lh = 42;
  let y = 250;
  const hlPositions = [];

  for (const para of ct.paragraphs) {
    if (!para.text) { y += lh * 0.5; continue; }

    if (para.bold) {
      ctx.fillStyle = "#c0392b"; ctx.font = `bold ${fontSize + 2}px ${FONT}`;
      ctx.fillText(para.text, 60, y);
      ctx.font = `${fontSize}px ${FONT}`; ctx.fillStyle = "#1a1a1a";
    } else {
      ctx.fillStyle = "#1a1a1a"; ctx.fillText(para.text, 60, y);
    }

    if (para.highlight) {
      const bx = 60 + ctx.measureText(para.text.split(para.highlight)[0]).width;
      const bw = ctx.measureText(para.highlight).width;
      if (withHighlights) {
        ctx.fillStyle = "rgba(255,220,0,0.92)";
        roundRect(ctx, bx - 6, y - fontSize * 0.9, bw + 12, fontSize * 1.3, 4); ctx.fill();
        ctx.fillStyle = "#8b1a1a"; ctx.font = `bold ${fontSize}px ${FONT}`;
        ctx.fillText(para.highlight, bx, y);
        ctx.font = `${fontSize}px ${FONT}`; ctx.fillStyle = "#1a1a1a";
      }
      hlPositions.push({ x: bx - 6, y: y - fontSize * 0.9, w: bw + 12, h: fontSize * 1.3 });
    }
    y += lh;
  }

  // Footer
  ctx.fillStyle = "#555"; ctx.font = "15px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(ct.footer, W / 2, H - 35);

  return { canvas, hlPositions };
}

// ── Generate all ──
const coverCanvas = generateCover(cfg.cover);
fs.writeFileSync(path.join(ASSETS, "page_cover.png"), coverCanvas.toBuffer("image/png"));

const { canvas: plainCanvas } = generateContent(cfg.content, false);
fs.writeFileSync(path.join(ASSETS, "page_content_plain.png"), plainCanvas.toBuffer("image/png"));

const { canvas: hlCanvas, hlPositions } = generateContent(cfg.content, true);
fs.writeFileSync(path.join(ASSETS, "page_content_hl.png"), hlCanvas.toBuffer("image/png"));
fs.writeFileSync(path.join(ASSETS, "hl_positions.json"), JSON.stringify(hlPositions));

console.log(`✅ Generated from ${path.basename(configPath)}: cover + content (plain & hl) + ${hlPositions.length} highlight regions`);
