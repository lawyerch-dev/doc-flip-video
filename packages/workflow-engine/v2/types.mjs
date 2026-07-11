/**
 * 简化工作流引擎 - 类型定义和常量
 *
 * 设计原则：
 * 1. 统一素材节点（text/image/audio/video）
 * 2. 可配置效果（easing + transition + params）
 * 3. 线性执行，无需拓扑排序
 */

// ── 转场效果常量 ──

/** 标准 xfade 转场 */
export const XFADE_TRANSITIONS = {
  // 基础转场
  'fade': 'dissolve',
  'dissolve': 'dissolve',
  
  // 擦除类
  'wipe-left': 'wipeleft',
  'wipe-right': 'wiperight',
  'wipe-up': 'wipeup',
  'wipe-down': 'wipedown',
  
  // 滑动类
  'slide-left': 'slideleft',
  'slide-right': 'slideright',
  'slide-up': 'slideup',
  'slide-down': 'slidedown',
  
  // 推挤类
  'push-left': 'pushleft',
  'push-right': 'pushright',
  'push-up': 'pushup',
  'push-down': 'pushdown',
  
  // 覆盖类
  'cover-left': 'coverleft',
  'cover-right': 'coverright',
  'cover-up': 'coverup',
  'cover-down': 'coverdown',
  
  // 揭开类
  'reveal-left': 'revealleft',
  'reveal-right': 'revealright',
  'reveal-up': 'revealup',
  'reveal-down': 'revealdown',
  
  // 其他
  'smooth-left': 'smoothleft',
  'smooth-right': 'smoothright',
  'smooth-up': 'smoothup',
  'smooth-down': 'smoothdown',
  'circle-crop': 'circlecrop',
  'circle-close': 'circleclose',
  'circle-open': 'circleopen',
  'horz-close': 'horzclose',
  'horz-open': 'horzopen',
  'vert-close': 'vertclose',
  'vert-open': 'vertopen',
  'diag-bl': 'diagbl',
  'diag-br': 'diagbr',
  'diag-tl': 'diagtl',
  'diag-tr': 'diagtr',
  'hlslice': 'hlslice',
  'hrslice': 'hrslice',
  'vuslice': 'vuslice',
  'vdslice': 'vdslice',
  'radial': 'radial',
  'zoomin': 'zoomin',
};

/** GLSL 转场（需要自定义 FFmpeg） */
export const GLSL_TRANSITIONS = {
  // 翻页类
  'page-curl': 'gl_InvertedPageCurl',
  'simple-curl': 'gl_SimplePageCurl',
  'book-curl': 'gl_SimpleBookCurl',
  
  // 3D 类
  'cube': 'gl_cube',
  'doorway': 'gl_doorway',
  'flip': 'gl_Flip',
  
  // 几何类
  'diamond': 'gl_Diamond',
  'bowtie': 'gl_Bowtie',
  'butterfly': 'gl_Butterfly',
  'circle': 'gl_Circle',
  'pinwheel': 'gl_Pinwheel',
  'polar': 'gl_Polar',
  'star': 'gl_StarWipe',
  
  // 动画类
  'bounce': 'gl_Bounce',
  'wind': 'gl_Wind',
  'swap': 'gl_Swap',
  'squeezeh': 'gl_SqueezeH',
  'squeezev': 'gl_SqueezeV',
  
  // 自然类
  'flower': 'gl_Flower',
  'fan-in': 'gl_FanIn',
  'fan-out': 'gl_FanOut',
  'fan-up': 'gl_FanUp',
  'curtain': 'gl_StageCurtains',
  
  // 特效类
  'bars': 'gl_Bars',
  'cross-out': 'gl_CrossOut',
  'corner-vanish': 'gl_CornerVanish',
  'stripe-wipe': 'gl_Stripe_Wipe',
  'exponential-swish': 'gl_Exponential_Swish',
  
  // 随机
  'random': 'gl_random',
};

/** 所有可用转场 */
export const ALL_TRANSITIONS = { ...XFADE_TRANSITIONS, ...GLSL_TRANSITIONS };

/** 缓动函数 */
export const EASINGS = [
  'linear',
  // 标准缓动
  'ease', 'ease-in', 'ease-out', 'ease-in-out',
  // 三次缓动
  'cubic-in', 'cubic-out', 'cubic-in-out',
  // 二次缓动
  'quad-in', 'quad-out', 'quad-in-out',
  // 正弦缓动
  'sine-in', 'sine-out', 'sine-in-out',
  // 指数缓动
  'expo-in', 'expo-out', 'expo-in-out',
  // 弹性缓动
  'elastic-in', 'elastic-out', 'elastic-in-out',
  // 回弹缓动
  'back-in', 'back-out', 'back-in-out',
  // 弹跳缓动
  'bounce-in', 'bounce-out', 'bounce-in-out',
];

// ── 效果类型 ──

/**
 * @typedef {'hold' | 'fade-in' | 'fade-out' | 'transition' | 'sweep' | 'zoom' | 'rotate' | 'pan'} EffectType
 */

/**
 * @typedef {Object} Effect
 * @property {EffectType} type - 效果类型
 * @property {Object} params - 效果参数
 * @property {number} params.duration - 持续时间（秒）
 * @property {string} [params.easing] - 缓动函数
 * @property {string} [params.transition] - 转场效果名称
 * @property {boolean} [params.reverse] - 是否反向
 * @property {string} [params.keyword] - 高亮关键词（sweep 效果用）
 * @property {number} [params.zoom] - 缩放比例（zoom 效果用）
 * @property {number} [params.angle] - 旋转角度（rotate 效果用）
 * @property {string} [params.direction] - 方向（pan 效果用）
 */

// ── 素材类型 ──

/**
 * @typedef {'text' | 'image' | 'audio' | 'video'} ContentKind
 */

/**
 * @typedef {Object} Content
 * @property {ContentKind} kind - 素材类型
 * @property {string} source - 素材来源（文字内容、文件路径、URL）
 * @property {number} [duration] - 显示时长（秒）
 * @property {Object} [style] - 样式配置（文字用）
 * @property {string} [style.font] - 字体
 * @property {number} [style.fontSize] - 字号
 * @property {string} [style.color] - 颜色
 * @property {boolean} [style.bold] - 是否粗体
 * @property {string} [style.align] - 对齐方式
 */

/**
 * @typedef {Object} MaterialNode
 * @property {string} id - 节点 ID
 * @property {string} name - 节点名称
 * @property {Content} content - 素材内容
 * @property {Effect[]} effects - 应用的效果列表
 */

// ── 工作流类型 ──

/**
 * @typedef {Object} Canvas
 * @property {number} width - 画布宽度
 * @property {number} height - 画布高度
 * @property {number} fps - 帧率
 */

/**
 * @typedef {Object} AudioConfig
 * @property {string} source - 音频文件路径或目录
 * @property {Object} [fadeIn] - 淡入配置
 * @property {number} [fadeIn.duration] - 淡入时长
 * @property {Object} [fadeOut] - 淡出配置
 * @property {number} [fadeOut.duration] - 淡出时长
 * @property {number} [volume] - 音量（0-1）
 */

/**
 * @typedef {Object} OutputConfig
 * @property {string} [filename] - 输出文件名
 * @property {string} [outputDir] - 输出目录
 * @property {number} [crf] - 视频质量（0-51，越小越好）
 */

/**
 * @typedef {Object} Workflow
 * @property {string} name - 工作流名称
 * @property {Canvas} canvas - 画布配置
 * @property {MaterialNode[]} nodes - 素材节点列表
 * @property {AudioConfig} [audio] - 音频配置
 * @property {OutputConfig} output - 输出配置
 */

// ── 渲染结果类型 ──

/**
 * @typedef {Object} RenderedClip
 * @property {string} id - 节点 ID
 * @property {string} path - 渲染后的文件路径
 * @property {'image' | 'video'} mediaType - 媒体类型
 * @property {number} duration - 总时长（秒）
 * @property {Effect[]} effects - 待应用的效果
 * @property {string} [label] - FFmpeg 流标签
 */

/**
 * @typedef {Object} FilterSegment
 * @property {string} input - 输入流标签
 * @property {string} output - 输出流标签
 * @property {string[]} filters - FFmpeg filter 字符串数组
 * @property {number} duration - 效果时长
 * @property {number} offset - 在时间线上的偏移
 */

/**
 * @typedef {Object} CompiledWorkflow
 * @property {RenderedClip[]} clips - 渲染后的素材片段
 * @property {FilterSegment[]} filters - 滤镜片段
 * @property {number} totalDuration - 总时长
 * @property {string} [audioPath] - 音频文件路径
 * @property {string} outputPath - 输出文件路径
 */

// ── 工具函数 ──

/**
 * 获取转场效果的 FFmpeg 名称
 * @param {string} name - 转场名称（简写或全名）
 * @returns {string} FFmpeg 转场名称
 */
export function getTransitionFFmpegName(name) {
  // 先查简写
  if (ALL_TRANSITIONS[name]) {
    return ALL_TRANSITIONS[name];
  }
  // 再查是否已经是 FFmpeg 名称
  if (Object.values(ALL_TRANSITIONS).includes(name)) {
    return name;
  }
  // 默认返回 dissolve
  return 'dissolve';
}

/**
 * 检查是否为 GLSL 转场
 * @param {string} name - 转场名称
 * @returns {boolean}
 */
export function isGLSLTransition(name) {
  const ffmpegName = getTransitionFFmpegName(name);
  return ffmpegName.startsWith('gl_');
}

/**
 * 检查缓动函数是否有效
 * @param {string} easing - 缓动函数名称
 * @returns {boolean}
 */
export function isValidEasing(easing) {
  return EASINGS.includes(easing);
}

/**
 * 获取默认画布配置
 * @returns {Canvas}
 */
export function getDefaultCanvas() {
  return {
    width: 1080,
    height: 1840,
    fps: 30,
  };
}

/**
 * 创建空工作流
 * @param {string} name - 工作流名称
 * @returns {Workflow}
 */
export function createEmptyWorkflow(name = '未命名工作流') {
  return {
    name,
    canvas: getDefaultCanvas(),
    nodes: [],
    output: {},
  };
}
