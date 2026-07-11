/**
 * 效果构建器 - 构建 FFmpeg filter 字符串
 *
 * 双模式支持：
 * 1. Custom FFmpeg (build/ffmpeg-custom)：支持 easing= 和 GLSL 转场
 * 2. Expression 模式（标准 FFmpeg）：用 transition=custom:expr='...'
 */

import fs from "fs";
import path from "path";
import { ROOT } from "../../../config/paths.mjs";

// ── 转场注册表 ──

/**
 * 转场类型：
 * - builtin: 标准 FFmpeg 内置，直接可用
 * - expression: 需要 expression 文件，标准 FFmpeg 可用
 * - glsl: 需要 custom FFmpeg
 */
export const TRANSITION_REGISTRY = {
  // ── 标准 FFmpeg 内置转场 ──
  'fade': { type: 'builtin', ffmpeg: 'dissolve' },
  'dissolve': { type: 'builtin', ffmpeg: 'dissolve' },
  'wipeleft': { type: 'builtin', ffmpeg: 'wipeleft' },
  'wiperight': { type: 'builtin', ffmpeg: 'wiperight' },
  'wipeup': { type: 'builtin', ffmpeg: 'wipeup' },
  'wipedown': { type: 'builtin', ffmpeg: 'wipedown' },
  'slideleft': { type: 'builtin', ffmpeg: 'slideleft' },
  'slideright': { type: 'builtin', ffmpeg: 'slideright' },
  'slideup': { type: 'builtin', ffmpeg: 'slideup' },
  'slidedown': { type: 'builtin', ffmpeg: 'slidedown' },
  'pushleft': { type: 'builtin', ffmpeg: 'pushleft' },
  'pushright': { type: 'builtin', ffmpeg: 'pushright' },
  'pushup': { type: 'builtin', ffmpeg: 'pushup' },
  'pushdown': { type: 'builtin', ffmpeg: 'pushdown' },
  'coverleft': { type: 'builtin', ffmpeg: 'coverleft' },
  'coverright': { type: 'builtin', ffmpeg: 'coverright' },
  'coverup': { type: 'builtin', ffmpeg: 'coverup' },
  'coverdown': { type: 'builtin', ffmpeg: 'coverdown' },
  'revealleft': { type: 'builtin', ffmpeg: 'revealleft' },
  'revealright': { type: 'builtin', ffmpeg: 'revealright' },
  'revealup': { type: 'builtin', ffmpeg: 'revealup' },
  'revealdown': { type: 'builtin', ffmpeg: 'revealdown' },

  // ── 需要 expression 的转场（无 easing） ──
  'circleclose': { type: 'expression', eased: false },
  'circleopen': { type: 'expression', eased: false },
  'horzclose': { type: 'expression', eased: false },
  'horzopen': { type: 'expression', eased: false },
  'vertclose': { type: 'expression', eased: false },
  'vertopen': { type: 'expression', eased: false },
  'diagbl': { type: 'expression', eased: false },
  'diagbr': { type: 'expression', eased: false },
  'diagtl': { type: 'expression', eased: false },
  'diagtr': { type: 'expression', eased: false },
  'hlslice': { type: 'expression', eased: false },
  'hrslice': { type: 'expression', eased: false },
  'vuslice': { type: 'expression', eased: false },
  'vdslice': { type: 'expression', eased: false },
  'radial': { type: 'expression', eased: false },
  'smoothleft': { type: 'expression', eased: false },
  'smoothright': { type: 'expression', eased: false },
  'smoothup': { type: 'expression', eased: false },
  'smoothdown': { type: 'expression', eased: false },
  'circlecrop': { type: 'expression', eased: false },
  'zoomin': { type: 'expression', eased: false },

  // ── GLSL 转场（需要 custom FFmpeg） ──
  'page-curl': { type: 'glsl', shader: 'gl_InvertedPageCurl' },
  'simple-curl': { type: 'glsl', shader: 'gl_SimplePageCurl' },
  'book-curl': { type: 'glsl', shader: 'gl_SimpleBookCurl' },
  'cube': { type: 'glsl', shader: 'gl_cube' },
  'doorway': { type: 'glsl', shader: 'gl_doorway' },
  'flip': { type: 'glsl', shader: 'gl_Flip' },
  'diamond': { type: 'glsl', shader: 'gl_Diamond' },
  'bowtie': { type: 'glsl', shader: 'gl_Bowtie' },
  'butterfly': { type: 'glsl', shader: 'gl_Butterfly' },
  'circle': { type: 'glsl', shader: 'gl_Circle' },
  'pinwheel': { type: 'glsl', shader: 'gl_Pinwheel' },
  'polar': { type: 'glsl', shader: 'gl_Polar' },
  'star': { type: 'glsl', shader: 'gl_StarWipe' },
  'bounce': { type: 'glsl', shader: 'gl_Bounce' },
  'wind': { type: 'glsl', shader: 'gl_Wind' },
  'swap': { type: 'glsl', shader: 'gl_Swap' },
  'squeezeh': { type: 'glsl', shader: 'gl_SqueezeH' },
  'squeezev': { type: 'glsl', shader: 'gl_SqueezeV' },
  'flower': { type: 'glsl', shader: 'gl_Flower' },
  'fan-in': { type: 'glsl', shader: 'gl_FanIn' },
  'fan-out': { type: 'glsl', shader: 'gl_FanOut' },
  'fan-up': { type: 'glsl', shader: 'gl_FanUp' },
  'curtain': { type: 'glsl', shader: 'gl_StageCurtains' },
  'bars': { type: 'glsl', shader: 'gl_Bars' },
  'cross-out': { type: 'glsl', shader: 'gl_CrossOut' },
  'corner-vanish': { type: 'glsl', shader: 'gl_CornerVanish' },
  'stripe-wipe': { type: 'glsl', shader: 'gl_Stripe_Wipe' },
  'exponential-swish': { type: 'glsl', shader: 'gl_Exponential_Swish' },
  'random': { type: 'glsl', shader: 'gl_random' },
};

// ── Expression 文件缓存 ──

const EXPR_DIR = path.join(ROOT, "vendor", "xfade-easing", "expr");
let exprCache = {};

/**
 * 加载 expression 文件
 */
function loadExpressionFile(filename) {
  if (exprCache[filename]) return exprCache[filename];

  const filepath = path.join(EXPR_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Expression 文件不存在: ${filepath}`);
  }

  const content = fs.readFileSync(filepath, "utf-8");
  exprCache[filename] = content;
  return content;
}

/**
 * 获取转场的 expression
 * @param {string} transition - 转场名称
 * @param {boolean} eased - 是否带缓动
 * @returns {string} expression 内容
 */
function getExpression(transition, eased = false) {
  // 根据格式和缓动选择文件
  const filename = eased
    ? 'eased-transitions-rgb24-inline.txt'
    : 'uneased-transitions-rgb24-inline.txt';

  const content = loadExpressionFile(filename);

  // 从文件中提取对应转场的 expression
  // 格式: transition_name=expression
  const regex = new RegExp(`^${transition}\\s*=\\s*(.+)$`, 'm');
  const match = content.match(regex);

  if (!match) {
    throw new Error(`找不到转场 expression: ${transition}`);
  }

  return match[1].trim();
}

// ── 检测环境 ──

/**
 * 检测是否有自定义 FFmpeg
 * @returns {boolean}
 */
export function hasCustomFFmpeg() {
  const customPath = path.join(ROOT, "build", "ffmpeg-custom");
  return fs.existsSync(customPath);
}

/**
 * 获取 FFmpeg 路径
 * @returns {{ custom: string|null, system: string }}
 */
export function getFFmpegPaths() {
  const customPath = path.join(ROOT, "build", "ffmpeg-custom");
  const hasCustom = fs.existsSync(customPath);

  return {
    custom: hasCustom ? customPath : null,
    system: 'ffmpeg',
  };
}

// ── 缓动函数映射 ──

const EASING_MAP = {
  'linear': 'linear',
  'ease': 'ease',
  'ease-in': 'easein',
  'ease-out': 'easeout',
  'ease-in-out': 'easeinout',
  'cubic-in': 'cubicin',
  'cubic-out': 'cubicout',
  'cubic-in-out': 'cubicinout',
  'quad-in': 'quadin',
  'quad-out': 'quadout',
  'quad-in-out': 'quadinout',
  'sine-in': 'sinein',
  'sine-out': 'sineout',
  'sine-in-out': 'sineinout',
  'expo-in': 'expoin',
  'expo-out': 'expoout',
  'expo-in-out': 'expoinout',
  'elastic-in': 'elasticin',
  'elastic-out': 'elasticout',
  'elastic-in-out': 'elasticinout',
  'back-in': 'backin',
  'back-out': 'backout',
  'back-in-out': 'backinout',
  'bounce-in': 'bouncein',
  'bounce-out': 'bounceout',
  'bounce-in-out': 'bounceinout',
};

/**
 * 获取 FFmpeg 缓动函数名
 * @param {string} easing - 缓动函数名
 * @returns {string}
 */
function getFFmpegEasing(easing) {
  return EASING_MAP[easing] || 'cubicinout';
}

// ── 构建 Filter ──

/**
 * 构建转场 filter
 * @param {Object} params
 * @param {string} params.fromLabel - 输入流1标签
 * @param {string} params.toLabel - 输入流2标签
 * @param {string} params.outputLabel - 输出流标签
 * @param {string} params.transition - 转场名称
 * @param {string} [params.easing] - 缓动函数
 * @param {number} params.duration - 持续时间
 * @param {number} params.offset - 时间偏移
 * @param {Object} [params.extraParams] - 额外参数（GLSL 转场用）
 * @returns {string} filter 字符串
 */
export function buildTransitionFilter({
  fromLabel,
  toLabel,
  outputLabel,
  transition,
  easing = 'cubic-in-out',
  duration,
  offset,
  extraParams = {},
}) {
  const reg = TRANSITION_REGISTRY[transition];

  if (!reg) {
    throw new Error(`未知转场: ${transition}`);
  }

  const hasCustom = hasCustomFFmpeg();
  const easingFFmpeg = getFFmpegEasing(easing);

  switch (reg.type) {
    case 'builtin':
      // 标准 FFmpeg 内置转场
      return `[${fromLabel}][${toLabel}]xfade=transition=${reg.ffmpeg}:duration=${duration}:offset=${offset}[${outputLabel}]`;

    case 'expression':
      // Expression 模式
      try {
        const expr = getExpression(reg.ffmpeg || transition, reg.eased);
        return `[${fromLabel}][${toLabel}]xfade=transition=custom:expr='${expr}':duration=${duration}:offset=${offset}[${outputLabel}]`;
      } catch (e) {
        // fallback 到 dissolve
        console.warn(`  ⚠️  转场 ${transition} 的 expression 加载失败，使用 dissolve`);
        return `[${fromLabel}][${toLabel}]xfade=transition=dissolve:duration=${duration}:offset=${offset}[${outputLabel}]`;
      }

    case 'glsl':
      // GLSL 转场（需要 custom FFmpeg）
      if (!hasCustom) {
        console.warn(`  ⚠️  转场 ${transition} 需要自定义 FFmpeg，使用 dissolve 替代`);
        return `[${fromLabel}][${toLabel}]xfade=transition=dissolve:duration=${duration}:offset=${offset}[${outputLabel}]`;
      }

      // 构建 GLSL 参数
      let shader = reg.shader;
      const paramStr = Object.entries(extraParams)
        .map(([k, v]) => `${k}=${v}`)
        .join(',');

      if (paramStr) {
        shader = `'${reg.shader}(${paramStr})'`;
      }

      return `[${fromLabel}][${toLabel}]xfade=easing=${easingFFmpeg}:transition=${shader}:duration=${duration}:offset=${offset}[${outputLabel}]`;

    default:
      throw new Error(`未知转场类型: ${reg.type}`);
  }
}

/**
 * 构建淡入 filter
 * @param {Object} params
 * @param {string} params.inputLabel - 输入流标签
 * @param {string} params.outputLabel - 输出流标签
 * @param {number} params.duration - 淡入时长
 * @param {number} [params.offset=0] - 时间偏移
 * @returns {string} filter 字符串
 */
export function buildFadeInFilter({
  inputLabel,
  outputLabel,
  duration,
  offset = 0,
}) {
  return `[${inputLabel}]fade=t=in:st=${offset}:d=${duration}[${outputLabel}]`;
}

/**
 * 构建淡出 filter
 * @param {Object} params
 * @param {string} params.inputLabel - 输入流标签
 * @param {string} params.outputLabel - 输出流标签
 * @param {number} params.duration - 淡出时长
 * @param {number} params.offset - 时间偏移（淡出开始时间）
 * @returns {string} filter 字符串
 */
export function buildFadeOutFilter({
  inputLabel,
  outputLabel,
  duration,
  offset,
}) {
  return `[${inputLabel}]fade=t=out:st=${offset}:d=${duration}[${outputLabel}]`;
}

/**
 * 构建高亮扫描 filter（简化版，实际需要更复杂的逻辑）
 * @param {Object} params
 * @param {string} params.inputLabel - 输入流标签
 * @param {string} params.outputLabel - 输出流标签
 * @param {number} params.duration - 扫描时长
 * @param {number} params.offset - 时间偏移
 * @returns {string} filter 字符串
 */
export function buildSweepFilter({
  inputLabel,
  outputLabel,
  duration,
  offset,
}) {
  // 简化实现：使用 drawbox 模拟扫描效果
  // 实际应该用更复杂的 overlay + 移动遮罩
  return `[${inputLabel}]drawbox=x='if(between(t,${offset},${offset + duration}),(t-${offset})/${duration}*iw,0)':y=0:w=10:h=ih:color=yellow@0.3:t=fill[${outputLabel}]`;
}

// ── 效果处理 ──

/**
 * 为素材片段构建所有效果的 filter
 * @param {Object} clip - 渲染后的素材片段
 * @param {number} clipOffset - 片段在时间线上的起始偏移
 * @returns {{ filters: string[], outputLabel: string, duration: number }}
 */
export function buildClipFilters(clip, clipOffset) {
  const filters = [];
  let currentLabel = clip.label;
  let currentOffset = clipOffset;
  let totalDuration = 0;
  let labelCounter = 0;

  const nextLabel = (prefix = 'f') => `${prefix}${labelCounter++}`;

  for (const effect of clip.effects) {
    const effectDuration = effect.params?.duration || 0;

    switch (effect.type) {
      case 'hold':
        // 静止停留，不需要 filter，只增加偏移
        currentOffset += effectDuration;
        totalDuration += effectDuration;
        break;

      case 'fade-in': {
        const outLabel = nextLabel('fi');
        filters.push(buildFadeInFilter({
          inputLabel: currentLabel,
          outputLabel: outLabel,
          duration: effectDuration,
          offset: 0,
        }));
        currentLabel = outLabel;
        currentOffset += effectDuration;
        totalDuration += effectDuration;
        break;
      }

      case 'fade-out': {
        const outLabel = nextLabel('fo');
        filters.push(buildFadeOutFilter({
          inputLabel: currentLabel,
          outputLabel: outLabel,
          duration: effectDuration,
          offset: currentOffset + effectDuration,
        }));
        currentLabel = outLabel;
        currentOffset += effectDuration;
        totalDuration += effectDuration;
        break;
      }

      case 'transition': {
        // 转场效果需要两个输入，这里只构建 filter 片段
        // 实际连接在主引擎中处理
        const outLabel = nextLabel('tr');
        filters.push({
          type: 'transition',
          fromLabel: currentLabel,
          outputLabel: outLabel,
          transition: effect.params?.transition || 'dissolve',
          easing: effect.params?.easing || 'cubic-in-out',
          duration: effectDuration,
          offset: currentOffset,
          extraParams: effect.params?.extraParams || {},
        });
        currentLabel = outLabel;
        currentOffset += effectDuration;
        totalDuration += effectDuration;
        break;
      }

      case 'sweep': {
        const outLabel = nextLabel('sw');
        filters.push(buildSweepFilter({
          inputLabel: currentLabel,
          outputLabel: outLabel,
          duration: effectDuration,
          offset: currentOffset,
        }));
        currentLabel = outLabel;
        currentOffset += effectDuration;
        totalDuration += effectDuration;
        break;
      }

      default:
        console.warn(`  ⚠️  未知效果类型: ${effect.type}`);
    }
  }

  return {
    filters,
    outputLabel: currentLabel,
    duration: totalDuration,
  };
}

// ── 工具函数 ──

/**
 * 获取所有可用转场名称
 * @returns {string[]}
 */
export function getAvailableTransitions() {
  return Object.keys(TRANSITION_REGISTRY);
}

/**
 * 获取转场信息
 * @param {string} name - 转场名称
 * @returns {Object|null}
 */
export function getTransitionInfo(name) {
  return TRANSITION_REGISTRY[name] || null;
}

/**
 * 检查转场是否需要自定义 FFmpeg
 * @param {string} name - 转场名称
 * @returns {boolean}
 */
export function requiresCustomFFmpeg(name) {
  const reg = TRANSITION_REGISTRY[name];
  return reg?.type === 'glsl';
}

/**
 * 检查转场是否可用（考虑环境）
 * @param {string} name - 转场名称
 * @returns {boolean}
 */
export function isTransitionAvailable(name) {
  const reg = TRANSITION_REGISTRY[name];
  if (!reg) return false;

  if (reg.type === 'glsl') {
    return hasCustomFFmpeg();
  }

  return true;
}
