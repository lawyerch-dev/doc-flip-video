#!/usr/bin/env node
/**
 * Extract uniform parameters from all .glsl files in vendor/xfade-easing/glsl/
 * and generate packages/engine/glsl-catalog.json
 *
 * Usage: node scripts/extract-glsl-params.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GLSL_DIR = join(ROOT, 'vendor', 'xfade-easing', 'glsl');
const OUT_FILE = join(ROOT, 'packages', 'engine', 'glsl-catalog.json');

// Chinese display names for the catalog
const CN_NAMES = {
  Bars: '条纹',
  Bounce: '弹跳',
  CornerVanish: '角落消失',
  CrossOut: '十字消除',
  Diamond: '菱形',
  DoubleDiamond: '双菱形',
  Exponential_Swish: '指数滑动',
  FanIn: '扇形进入',
  FanOut: '扇形退出',
  FanUp: '扇形上升',
  Flower: '花朵',
  SimpleBookCurl: '翻书卷曲',
  SimplePageCurl: '翻页卷曲',
  StageCurtains: '舞台幕布',
  Stripe_Wipe: '条纹擦除',
};

// Human-readable param descriptions (English key → Chinese label)
const PARAM_LABELS = {
  smooth: '平滑度',
  vertical: '垂直方向',
  shadow_colour: '阴影颜色',
  shadow_height: '阴影高度',
  bounces: '弹跳次数',
  direction: '方向',
  angle: '角度',
  radius: '半径',
  roll: '滚动',
  uncurl: '展开',
  greyback: '灰色背面',
  opacity: '不透明度',
  shadow: '阴影',
  zoom: '缩放',
  offset: '偏移',
  exponent: '指数',
  wrap: '环绕',
  blur: '模糊',
  frames: '帧数',
  rotation: '旋转角度',
  color: '颜色',
  bumps: '褶皱数',
  drop: '垂坠',
  nlayers: '层数',
  layerSpread: '层间距',
  color1: '颜色1',
  color2: '颜色2',
  shadowIntensity: '阴影强度',
  shadowSpread: '阴影扩散',
};

// ── helpers ──────────────────────────────────────────────────────────

/** Extract the value of a `// Key: value` comment line */
function extractComment(lines, key) {
  const re = new RegExp(`^//\\s*${key}:\\s*(.+)`, 'i');
  for (const line of lines) {
    const m = line.trim().match(re);
    if (m) return m[1].trim();
  }
  return '';
}

/** Parse all uniform declarations from GLSL source lines */
function parseUniforms(lines) {
  const uniforms = [];
  // Matches: uniform <type> <name>; // = <default>
  // Also:    uniform <type> <name>;//= <default>  (no spaces)
  const re = /^uniform\s+(bool|int|float|vec[234]|ivec[234]|mat[234])\s+(\w+)\s*;?\s*(?:\/\/\s*=\s*(.+?)\s*$)?/;

  for (const line of lines) {
    const m = line.trim().match(re);
    if (!m) continue;

    const [, type, name, rawDefault] = m;
    let def;

    if (rawDefault) {
      // vec/ivec/mat constructor: keep the full call, strip inner whitespace
      const ctor = rawDefault.match(/^((?:vec|ivec|mat)\d?\s*\([^)]*\))/);
      if (ctor) {
        def = ctor[1].replace(/\s+/g, '');
      } else {
        // scalar / int — take everything before any trailing comment or whitespace
        def = rawDefault.trim().split(/[\s;]+/)[0];
      }
    }

    const entry = { type, name };
    if (def !== undefined) entry.default = def;
    uniforms.push(entry);
  }

  return uniforms;
}

// ── main ─────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(GLSL_DIR)
    .filter(f => f.endsWith('.glsl'))
    .sort();

  const shaders = [];
  const catalog = [];

  for (const file of files) {
    const content = readFileSync(join(GLSL_DIR, file), 'utf-8');
    const lines = content.split('\n');
    const name = file.replace('.glsl', '');

    const displayName = extractComment(lines, 'Name') || name;
    const author = extractComment(lines, 'Author');
    const uniforms = parseUniforms(lines);

    // ── shaders entry ────────────────────────────────────────────────
    shaders.push({ name, displayName, author, filename: file, uniforms });

    // ── catalog entry ────────────────────────────────────────────────
    const params = uniforms.map(u => {
      const p = { name: u.name, type: u.type };
      if (u.default !== undefined) p.default = u.default;
      if (PARAM_LABELS[u.name]) p.label = PARAM_LABELS[u.name];
      return p;
    });

    catalog.push({
      id: name,
      name: CN_NAMES[name] || displayName,
      params,
    });
  }

  const output = { shaders, catalog };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  // ── summary ───────────────────────────────────────────────────────
  console.log(`✓ Extracted ${shaders.length} shaders → ${OUT_FILE}`);
  let totalUniforms = 0;
  for (const s of shaders) {
    const n = s.uniforms.length;
    totalUniforms += n;
    console.log(`  ${s.filename}: ${n} uniform${n !== 1 ? 's' : ''}`);
  }
  console.log(`  Total: ${totalUniforms} uniforms across ${shaders.length} shaders`);
}

main();
