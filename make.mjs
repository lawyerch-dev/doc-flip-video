#!/usr/bin/env node
/**
 * 视频生成 CLI — 超薄 wrapper，只做参数解析 + 调引擎
 *
 * 用法:
 *   node make.mjs --images a.png,b.png --transition diamond
 *   node make.mjs --images cover.png,page1.png --transition page-curl -o my.mp4
 *
 * 效果画廊: open data/output/effects/index.html
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CUSTOM_FFMPEG = join(ROOT, 'build', 'ffmpeg-custom');
const SYSTEM_FFMPEG = 'ffmpeg';
const OUTPUT_DIR = join(ROOT, 'data', 'output');
const MUSIC_DIR = join(ROOT, 'assets', 'music');

const GLSL_MAP = {
  'page-curl':'gl_InvertedPageCurl','simple-curl':"gl_SimplePageCurl(angle=30,radius=0.15)",
  'book-curl':"gl_SimpleBookCurl(angle=30,radius=0.15)",'diamond':'gl_Diamond',
  'double-diamond':'gl_DoubleDiamond','bounce':'gl_Bounce(bounces=3,direction=0)',
  'curtain':'gl_StageCurtains(bumps=8,drop=3)','flower':'gl_Flower','bars':'gl_Bars',
  'fan-in':'gl_FanIn','fan-out':'gl_FanOut','cube':'gl_cube','star':'gl_StarWipe',
  'swap':'gl_Swap','cross-out':'gl_CrossOut','corner-vanish':'gl_CornerVanish',
  'stripe-wipe':'gl_Stripe_Wipe','exponential-swish':'gl_Exponential_Swish',
  'dissolve':'dissolve','slideleft':'slideleft','pushright':'pushright','zoomin':'zoomin',
};

// --- CLI 参数解析 ---
const args = process.argv.slice(2);
const opt = { images: '', transition: 'diamond', hold: '3', duration: '2', easing: 'cubic-in-out', music: '', o: 'output.mp4' };

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    console.log('用法: node make.mjs --images a.png,b.png [选项]\n');
    console.log('必要:\n  --images <文件>    图片路径，逗号分隔');
    console.log('选项:\n  --transition <名>  转场效果\n  --hold <秒>        停留时长\n  --duration <秒>    转场时长\n  --easing <名>      缓动\n  --music <文件>     背景音乐\n  -o <文件>          输出路径\n');
    console.log('效果查看: open data/output/effects/index.html');
    process.exit(0);
  }
  if (args[i].startsWith('-')) {
    opt[args[i].replace(/^--?/, '')] = args[i + 1];
    i++;
  }
}

if (!opt.images) { console.error('请指定 --images'); process.exit(1); }
if (!existsSync(CUSTOM_FFMPEG)) { console.error('缺少 packages/orchestrator/build/ffmpeg-custom'); process.exit(1); }

const images = opt.images.split(',').map(s => s.trim());
for (const img of images) { if (!existsSync(img)) { console.error('图片不存在:', img); process.exit(1); } }

// --- 计算参数 ---
const hold = parseFloat(opt.hold) || 3;
const trDur = parseFloat(opt.duration) || 2;
const easing = opt.easing || 'cubic-in-out';
const shader = GLSL_MAP[opt.transition] || opt.transition;
const hasGLSL = shader.startsWith('gl_');
const totalDuration = images.length * hold + (images.length - 1) * trDur;
const outputPath = opt.o.startsWith('/') ? opt.o : join(OUTPUT_DIR, opt.o);

mkdirSync(dirname(outputPath), { recursive: true });

// --- 选择背景音乐 ---
let musicPath = opt.music || '';
if (!musicPath) {
  try {
    const files = readdirSync(MUSIC_DIR).filter(f => /\.(mp3|wav|m4a)$/i.test(f));
    if (files.length > 0) musicPath = join(MUSIC_DIR, files[Math.floor(Math.random() * files.length)]);
  } catch {}
}

console.log(`\n🎬 ${images.length}张 → ${opt.transition}${hasGLSL ? ' (GLSL)' : ''}`);
console.log(`   时长 ${totalDuration.toFixed(1)}s${musicPath ? ' + 背景音乐' : ''}\n`);

// --- 引擎：编译 FFmpeg 命令 ---
const buildFilter = () => {
  let s = images.map((_, i) => `[${i}:v]fps=25,scale=540:960,setsar=1[v${i}]`).join(';');
  if (images.length === 2) {
    s += `;[v0][v1]xfade=${hasGLSL ? `easing=${easing}:` : ''}transition=${shader}:duration=${trDur}:offset=${hold}[vout]`;
  } else {
    let prev = 'v0', off = hold;
    for (let i = 1; i < images.length; i++) {
      const out = i < images.length - 1 ? `v${i}m` : 'vout';
      s += `;[${prev}][v${i}]xfade=${hasGLSL ? `easing=${easing}:` : ''}transition=${shader}:duration=${trDur}:offset=${off}[${out}]`;
      prev = out; off += hold + trDur;
    }
  }
  return s;
};

// --- 引擎：渲染管线 ---
const render = () => {
  const filter = buildFilter();
  const rawPath = outputPath + '.raw.avi';

  // Step 1: custom FFmpeg (GLSL)
  const rawArgs = ['-y'];
  for (const img of images) rawArgs.push('-loop', '1', '-t', String(totalDuration + 2), '-i', img);
  rawArgs.push('-filter_complex', filter, '-map', '[vout]', '-c:v', 'mpeg4', '-q:v', '5', rawPath);

  try {
    execFileSync(CUSTOM_FFMPEG, rawArgs, { stdio: 'pipe' });
  } catch (e) {
    throw new Error('GLSL 渲染失败: ' + e.message);
  }

  // Step 2: 系统 FFmpeg (H.264)
  const encArgs = ['-y', '-i', rawPath];
  if (musicPath) encArgs.push('-i', musicPath);
  encArgs.push(
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart'
  );
  if (musicPath) encArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest', '-map', '0:v:0', '-map', '1:a:0');
  encArgs.push(outputPath);

  try {
    execFileSync(SYSTEM_FFMPEG, encArgs, { stdio: 'pipe' });
  } catch (e) {
    throw new Error('H.264 编码失败: ' + e.message);
  }

  try { unlinkSync(rawPath); } catch {}
};

// --- 执行 ---
try {
  render();
  const size = (existsSync(outputPath) ? statSync(outputPath).size : 0) / 1024;
  console.log(`✅ ${outputPath.replace(OUTPUT_DIR, 'data/output')} (${size.toFixed(0)}KB, ${totalDuration.toFixed(1)}s)`);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
