import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "assets");
fs.mkdirSync(ASSETS, { recursive: true });

const W = 1920, H = 1080;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ── 封面 ──
const cover = createCanvas(W, H);
const c = cover.getContext("2d");
c.fillStyle = "#c0392b"; c.fillRect(0, 0, W, H);
c.fillStyle = "#d4a017"; c.fillRect(0, 0, W, 4);
const cx = W/2, cy = H*0.28;
c.beginPath(); c.arc(cx, cy, 65, 0, Math.PI*2); c.fillStyle="#fff"; c.fill();
c.beginPath(); c.arc(cx, cy, 58, 0, Math.PI*2); c.fillStyle="#c0392b"; c.fill();
c.fillStyle="#fff"; c.font="bold 48px serif"; c.textAlign="center"; c.textBaseline="middle";
c.fillText("两拐", cx, cy);
c.fillStyle="#d4a017"; c.font="22px sans-serif"; c.fillText("第 458 期", cx, cy+110);
c.fillStyle="#fff"; c.font="bold 28px sans-serif"; c.fillText("2026年07月01日", cx, cy+150);
c.strokeStyle="rgba(255,255,255,0.3)"; c.lineWidth=1;
c.beginPath(); c.moveTo(W*0.15,cy+180); c.lineTo(W*0.85,cy+180); c.stroke();
c.fillStyle="rgba(255,255,255,0.7)"; c.font="22px sans-serif";
c.fillText("专注交通安全管理", cx, cy+210);
c.fillStyle="#fff"; c.font="bold 42px serif"; c.fillText("新规解读", cx, cy+295);
c.font="30px serif"; c.fillText("《道路交通安全法》修订要点", cx, cy+340);
const boxY = cy+380;
c.fillStyle="rgba(255,255,255,0.15)";
roundRect(c, W*0.12, boxY, W*0.76, 55, 8); c.fill();
c.fillStyle="#fff"; c.font="21px sans-serif";
c.fillText("酒驾新规 · 记分调整 · 电动车管理", cx, boxY+35);
const barY = H-110;
c.fillStyle="rgba(255,255,255,0.8)";
for (let i=0; i<35; i++) c.fillRect(W/2-100+i*6, barY, Math.random()>0.5?2:4, 42);
c.fillStyle="rgba(255,255,255,0.5)"; c.font="14px monospace";
c.fillText("ISSN 0000-0000 · 交通安全研究中心", cx, barY+60);
c.fillStyle="#d4a017"; c.fillRect(0,H-4,W,4);
fs.writeFileSync(path.join(ASSETS, "page_cover.png"), cover.toBuffer("image/png"));

// ── 正文绘制函数 ──
function drawContent(ctx, withHighlights) {
  ctx.fillStyle="#fdf6ec"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#c0392b"; ctx.fillRect(0,0,W,75);
  ctx.fillStyle="#d4a017"; ctx.fillRect(0,75,W,3);
  ctx.fillStyle="#fff"; ctx.font="bold 26px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText("两拐 · 第458期 · 正文", W/2, 38);
  ctx.textAlign="left";
  ctx.fillStyle="#c0392b"; ctx.font="bold 36px serif"; ctx.fillText("新规解读", 60, 140);
  ctx.fillStyle="#1a1a1a"; ctx.font="26px serif";
  ctx.fillText("《道路交通安全法》修订要点", 60, 185);
  ctx.strokeStyle="#c0392b"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(60,205); ctx.lineTo(W-60,205); ctx.stroke();

  const fontSize=22, lh=42; let y=250;
  ctx.font=`${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`;
  const lines = [
    {t:"一、酒驾处罚标准调整",bold:true},
    {t:"新规将饮酒后驾驶机动车的罚款标准由1000-2000元"},
    {t:"提高至2000-5000元，暂扣驾照6个月。醉酒驾驶"},
    {t:"的吊销驾照并依法追究刑事责任。",hl:"吊销驾照"},
    {t:""},{t:"二、记分制度重大改革",bold:true},
    {t:"违反交通信号灯通行的，由记6分调整为记12分。",hl:"记12分"},
    {t:"超速50%以上的一次记12分并吊销驾照。",hl:"超速50%"},
    {t:""},{t:"三、电动车管理新规",bold:true},
    {t:"电动自行车驾驶人应当佩戴安全头盔。",hl:"安全头盔"},
    {t:"违规者处以警告或50元以下罚款。"},
    {t:"驾驶超标电动车按机动车管理。",hl:"超标电动车"},
  ];
  const hlPositions = [];
  lines.forEach(line => {
    if (!line.t) { y+=lh*0.5; return; }
    if (line.bold) {
      ctx.fillStyle="#c0392b"; ctx.font=`bold ${fontSize+2}px "PingFang SC","Noto Sans SC",sans-serif`;
      ctx.fillText(line.t, 60, y);
      ctx.font=`${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`; ctx.fillStyle="#1a1a1a";
    } else {
      ctx.fillStyle="#1a1a1a"; ctx.fillText(line.t, 60, y);
    }
    if (line.hl) {
      const bx = 60 + ctx.measureText(line.t.split(line.hl)[0]).width;
      const bw = ctx.measureText(line.hl).width;
      if (withHighlights) {
        // Thick yellow marker background
        ctx.fillStyle="rgba(255,220,0,0.92)";
        roundRect(ctx, bx-6, y-fontSize*0.9, bw+12, fontSize*1.3, 4); ctx.fill();
        // Redraw text in dark red over the yellow
        ctx.fillStyle="#8b1a1a";
        ctx.font=`bold ${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`;
        ctx.fillText(line.hl, bx, y);
        ctx.font=`${fontSize}px "PingFang SC","Noto Sans SC",sans-serif`;
        ctx.fillStyle="#1a1a1a";
      }
      hlPositions.push({x:bx-6, y:y-fontSize*0.9, w:bw+12, h:fontSize*1.3});
    }
    y += lh;
  });

  ctx.fillStyle="#555"; ctx.font="15px sans-serif"; ctx.textAlign="center";
  ctx.fillText("※ 以上内容仅供参考，以官方发布为准", W/2, H-35);

  return hlPositions;
}

// ── 正文无高亮版（翻页用）──
const contentPlain = createCanvas(W, H);
drawContent(contentPlain.getContext("2d"), false);
fs.writeFileSync(path.join(ASSETS, "page_content_plain.png"), contentPlain.toBuffer("image/png"));

// ── 正文高亮版 ──
const contentHL = createCanvas(W, H);
const hlPositions = drawContent(contentHL.getContext("2d"), true);
fs.writeFileSync(path.join(ASSETS, "page_content_hl.png"), contentHL.toBuffer("image/png"));

// 导出高亮区域坐标供动画使用
fs.writeFileSync(path.join(ASSETS, "hl_positions.json"), JSON.stringify(hlPositions));
console.log(`✅ 3 images + hl_positions.json (${hlPositions.length} highlight regions)`);
