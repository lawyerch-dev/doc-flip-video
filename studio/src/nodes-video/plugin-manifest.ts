/** 参数定义 */
export interface ParamDef {
  type: 'string' | 'number' | 'boolean' | 'select';
  default: string | number | boolean;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

/** 端口定义 */
export interface PortDef {
  name: string;
  type: string;
}

/** 插件分类 */
export type PluginCategory = 'source' | 'effect' | 'transition' | 'output';

/** 插件元信息 */
export interface PluginManifest {
  id: string;
  name: string;
  category: PluginCategory;
  description: string;
  params: Record<string, ParamDef>;
  inputs: PortDef[];
  color: string;
}

/** 分类定义 */
export interface CategoryDef {
  label: string;
  color: string;
}

export const CATEGORIES: Record<PluginCategory, CategoryDef> = {
  source: { label: '来源', color: '#4ecdc4' },
  effect: { label: '效果', color: '#f9ca24' },
  transition: { label: '转场', color: '#6c5ce7' },
  output: { label: '输出', color: '#e94560' },
};

/** 颜色映射 */
export const CAT_COLORS: Record<PluginCategory, string> = {
  source: '#4ecdc4',
  effect: '#f9ca24',
  transition: '#6c5ce7',
  output: '#e94560',
};

/** 所有内建插件 */
export const BUILTIN_PLUGINS: PluginManifest[] = [
  // === Source ===
  {
    id: 'source:page-renderer',
    name: '页面渲染',
    category: 'source',
    description: '从 article config + 模板渲染封面或正文图片',
    params: {
      page: { type: 'select', default: 'cover', label: '页面', options: ['cover', 'content'] },
      highlight: { type: 'boolean', default: false, label: '高亮' },
    },
    inputs: [],
    color: '#4ecdc4',
  },
  {
    id: 'source:audio-picker',
    name: '背景音乐',
    category: 'source',
    description: '随机选择背景音乐',
    params: {
      dir: { type: 'string', default: 'assets/music', label: '目录' },
    },
    inputs: [],
    color: '#4ecdc4',
  },
  {
    id: 'source:glow-strip',
    name: '光晕条',
    category: 'source',
    description: '生成高亮扫描用的光晕条 PNG',
    params: {
      stripWidthRatio: {
        type: 'number', default: 0.06, label: '宽度比',
        min: 0.01, max: 0.5, step: 0.01,
      },
    },
    inputs: [],
    color: '#4ecdc4',
  },
  // === Effect ===
  {
    id: 'effect:fade-in',
    name: '淡入',
    category: 'effect',
    description: '从白色或指定颜色淡入',
    params: {
      duration: { type: 'number', default: 1.2, label: '时长', min: 0.1, max: 10, step: 0.1 },
      color: { type: 'string', default: 'white', label: '颜色' },
    },
    inputs: [{ name: 'source', type: 'video' }],
    color: '#f9ca24',
  },
  {
    id: 'effect:fade-out',
    name: '淡出',
    category: 'effect',
    description: '淡出到黑色',
    params: {
      duration: { type: 'number', default: 2.0, label: '时长', min: 0.1, max: 10, step: 0.1 },
      color: { type: 'string', default: 'black', label: '颜色' },
    },
    inputs: [{ name: 'source', type: 'video' }],
    color: '#f9ca24',
  },
  {
    id: 'effect:hold',
    name: '停留',
    category: 'effect',
    description: '静态停留指定时长',
    params: {
      duration: { type: 'number', default: 1.0, label: '时长', min: 0.1, max: 30, step: 0.1 },
    },
    inputs: [{ name: 'source', type: 'video' }],
    color: '#f9ca24',
  },
  {
    id: 'effect:sweep-glow',
    name: '高亮扫描',
    category: 'effect',
    description: '从左到右揭示高亮版本，叠加光晕效果',
    params: {
      duration: { type: 'number', default: 2.0, label: '时长', min: 0.1, max: 10, step: 0.1 },
      glowStripWidthRatio: {
        type: 'number', default: 0.06, label: '光晕宽度比',
        min: 0.01, max: 0.5, step: 0.01,
      },
    },
    inputs: [
      { name: 'source', type: 'video' },
      { name: 'target', type: 'video' },
      { name: 'glowStrip', type: 'image' },
    ],
    color: '#f9ca24',
  },
  // === Transition ===
  {
    id: 'transition:page-curl',
    name: '翻页',
    category: 'transition',
    description: '翻页转场（InvertedPageCurl）',
    params: {
      duration: { type: 'number', default: 2.5, label: '时长', min: 0.1, max: 10, step: 0.1 },
    },
    inputs: [
      { name: 'from', type: 'video' },
      { name: 'to', type: 'video' },
    ],
    color: '#6c5ce7',
  },
  {
    id: 'transition:crossfade',
    name: '交叉溶解',
    category: 'transition',
    description: '通用交叉溶解转场',
    params: {
      duration: { type: 'number', default: 1.0, label: '时长', min: 0.1, max: 10, step: 0.1 },
      easing: {
        type: 'select', default: 'cubic-in-out', label: '缓动',
        options: ['cubic-in-out', 'linear', 'quad-in', 'quad-out'],
      },
    },
    inputs: [
      { name: 'from', type: 'video' },
      { name: 'to', type: 'video' },
    ],
    color: '#6c5ce7',
  },
  // === Output ===
  {
    id: 'output:mp4',
    name: 'MP4 输出',
    category: 'output',
    description: '编码为 H.264 MP4 文件',
    params: {},
    inputs: [
      { name: 'video', type: 'video' },
      { name: 'audio', type: 'audio' },
    ],
    color: '#e94560',
  },
];

/** 按 ID 查找 */
export function getPlugin(id: string): PluginManifest | undefined {
  return BUILTIN_PLUGINS.find(p => p.id === id);
}

/** 查找插件图标 */
export function getIcon(manifest: PluginManifest): string {
  const icons: Record<string, string> = {
    'source:page-renderer': '📄',
    'source:audio-picker': '🎵',
    'source:glow-strip': '✨',
    'effect:fade-in': '🌅',
    'effect:fade-out': '🌑',
    'effect:hold': '⏸',
    'effect:sweep-glow': '🌟',
    'transition:page-curl': '📃',
    'transition:crossfade': '🔄',
    'output:mp4': '🎬',
  };
  return icons[manifest.id] ?? '🔌';
}
