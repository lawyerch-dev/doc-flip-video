/**
 * 视频插件清单 — 使用统一的 NodeManifest 类型
 *
 * 旧类型（PluginManifest, ParamDef, PortDef）保留为向后兼容的 re-export
 */

import type { NodeManifest, ParamDef as SharedParamDef, PortDef as SharedPortDef } from '../nodes-shared';
import { getPluginIcon } from './icons';

// ─── 向后兼容 re-export（逐步移除） ───
export type PluginCategory = 'source' | 'effect' | 'transition' | 'output';

/** @deprecated 使用 nodes-shared 的 NodeManifest */
export interface PluginManifest {
  id: string;
  name: string;
  category: PluginCategory;
  description: string;
  params: Record<string, SharedParamDef>;
  inputs: SharedPortDef[];
  color: string;
}

// ─── 视频插件定义 ───

/** 视频节点清单（使用统一 NodeManifest） */
export const VIDEO_MANIFESTS: NodeManifest[] = [
  // === Source ===
  {
    id: 'source:page-renderer',
    name: '页面渲染',
    category: 'source',
    description: '从 article config + 模板渲染封面或正文图片',
    color: '#4ecdc4',
    icon: getPluginIcon('source:page-renderer'),
    params: {
      page: { type: 'select', default: 'cover', label: '页面', options: ['cover', 'content'] },
      highlight: { type: 'boolean', default: false, label: '高亮' },
    },
    ports: [],
  },
  {
    id: 'source:audio-picker',
    name: '背景音乐',
    category: 'source',
    description: '随机选择背景音乐',
    color: '#4ecdc4',
    icon: getPluginIcon('source:audio-picker'),
    params: {
      dir: { type: 'string', default: 'assets/music', label: '目录' },
    },
    ports: [],
  },
  {
    id: 'source:glow-strip',
    name: '光晕条',
    category: 'source',
    description: '生成高亮扫描用的光晕条 PNG',
    color: '#4ecdc4',
    icon: getPluginIcon('source:glow-strip'),
    params: {
      stripWidthRatio: {
        type: 'number', default: 0.06, label: '宽度比',
        min: 0.01, max: 0.5, step: 0.01,
      },
    },
    ports: [],
  },
  // === Effect (统一节点，隐藏在工具箱，由模板替代) ===
  {
    id: 'effect',
    name: '视频效果',
    category: 'effect',
    description: '视频效果：淡入、淡出、停留、高亮扫描',
    color: '#f9ca24',
    icon: getPluginIcon('effect'),
    nodePanelVisible: false,
    params: {
      effectType: {
        type: 'select',
        default: 'fade-in',
        label: '效果类型',
        options: [
          { label: '淡入', value: 'fade-in' },
          { label: '淡出', value: 'fade-out' },
          { label: '停留', value: 'hold' },
          { label: '高亮扫描', value: 'sweep-glow' },
        ],
      },
      duration: {
        type: 'number', default: 1.2, label: '时长',
        min: 0.1, max: 30, step: 0.1,
        description: '效果持续时间',
      },
      color: {
        type: 'string', default: 'white', label: '颜色',
        description: '淡入/淡出颜色',
        visibleIf: { param: 'effectType', value: ['fade-in', 'fade-out'] },
      },
      glowStripWidthRatio: {
        type: 'number', default: 0.06, label: '光晕宽度比',
        min: 0.01, max: 0.5, step: 0.01,
        description: '光晕条宽度比例',
        visibleIf: { param: 'effectType', value: 'sweep-glow' },
      },
    },
    ports: [
      { name: 'source', type: 'input' },
      { name: 'target', type: 'input' },
      { name: 'glowStrip', type: 'input' },
      { type: 'output' },
    ],
  },
  // === Transition ===
  {
    id: 'transition:page-curl',
    name: '翻页',
    category: 'transition',
    description: '翻页转场（InvertedPageCurl）',
    color: '#6c5ce7',
    icon: getPluginIcon('transition:page-curl'),
    params: {
      duration: { type: 'number', default: 2.5, label: '时长', min: 0.1, max: 10, step: 0.1 },
    },
    ports: [
      { name: 'from', type: 'input' },
      { name: 'to', type: 'input' },
      { type: 'output' },
    ],
  },
  {
    id: 'transition:crossfade',
    name: '交叉溶解',
    category: 'transition',
    description: '通用交叉溶解转场',
    color: '#6c5ce7',
    icon: getPluginIcon('transition:crossfade'),
    params: {
      duration: { type: 'number', default: 1.0, label: '时长', min: 0.1, max: 10, step: 0.1 },
      easing: {
        type: 'select', default: 'cubic-in-out', label: '缓动',
        options: ['cubic-in-out', 'linear', 'quad-in', 'quad-out'],
      },
    },
    ports: [
      { name: 'from', type: 'input' },
      { name: 'to', type: 'input' },
      { type: 'output' },
    ],
  },
  // === Template ===
  {
    id: 'template',
    name: '模板',
    category: 'template',
    description: '预配置的内容+效果模板',
    color: '#10b981',
    icon: getPluginIcon('template'),
    params: {
      templateId: {
        type: 'string',
        default: '',
        label: '模板ID',
        description: '模板标识符',
      },
      contentType: {
        type: 'select',
        default: 'text',
        label: '内容类型',
        options: [
          { label: '文字', value: 'text' },
          { label: '图片', value: 'image' },
          { label: '视频', value: 'video' },
          { label: '音频', value: 'audio' },
        ],
      },
      content: {
        type: 'string',
        default: '',
        label: '内容',
        description: '文字内容或文件路径',
        required: true,
      },
      duration: {
        type: 'number',
        default: 3.0,
        label: '时长',
        min: 0.1,
        max: 60,
        step: 0.1,
      },
      effectJson: {
        type: 'string',
        default: '',
        label: '效果配置',
        description: '效果参数（JSON 格式）',
      },
      transitionJson: {
        type: 'string',
        default: '',
        label: '转场配置',
        description: '转场参数（JSON 格式）',
      },
    },
    ports: [
      { type: 'output' },
    ],
  },
  // === Output ===
  {
    id: 'output:mp4',
    name: 'MP4 输出',
    category: 'output',
    description: '编码为 H.264 MP4 文件',
    color: '#e94560',
    icon: getPluginIcon('output:mp4'),
    params: {},
    ports: [
      { name: 'video', type: 'input' },
      { name: 'audio', type: 'input' },
    ],
  },
];

/** @deprecated 使用 getManifest from nodes-shared */
export function getPlugin(id: string): NodeManifest | undefined {
  return VIDEO_MANIFESTS.find(p => p.id === id);
}

/** 向后兼容：旧代码仍引用 BUILTIN_PLUGINS */
export const BUILTIN_PLUGINS = VIDEO_MANIFESTS;
