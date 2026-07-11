/**
 * 统一节点清单系统 — 所有节点类型共用
 *
 * - NodeManifest: 统一的节点声明格式（视频 + 通用节点的超集）
 * - ParamDef: 统一的参数定义（支持 string/number/boolean/select/textarea/json/model 等）
 * - 中央注册表：getNodeName / getNodeColor / getNodeIcon / getNodeCategory
 */

import type { FC } from 'react';

// ─── 参数定义 ───

export type ParamType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'select'
  | 'textarea'
  | 'json'
  | 'model'
  | 'object'
  | 'array'
  | 'image'
  | 'file'
  | 'audio'
  | 'video';

export interface ParamDef {
  type: ParamType;
  label: string;
  default?: unknown;
  placeholder?: string;
  /** select 类型的选项 */
  options?: string[] | Array<{ label: string; value: string }>;
  /** number/integer 的范围 */
  min?: number;
  max?: number;
  step?: number;
  /** textarea 的行数 */
  rows?: number;
  /** 字符串最大长度 */
  maxLength?: number;
  /** 必填标记 */
  required?: boolean;
  /** 正则校验（string 类型） */
  pattern?: string;
  patternMessage?: string;
  /** 字段说明 */
  description?: string;
  /** 嵌套字段（object/array） */
  fields?: Record<string, ParamDef>;
  /** 条件显示：当指定参数等于指定值时显示 */
  visibleIf?: { param: string; value: string | string[] };
}

// ─── 输出变量 ───

export interface OutputDef {
  key: string;
  name: string;
  type: string;
  description?: string;
}

// ─── 端口定义 ───

export interface PortDef {
  name?: string;
  type: 'input' | 'output' | string;
}

// ─── 分类定义 ───

export interface CategoryInfo {
  label: string;
  color: string;
  order: number;
}

export const NODE_CATEGORIES: Record<string, CategoryInfo> = {
  system:    { label: '系统', color: '#4e40e5', order: 0 },
  source:    { label: '来源', color: '#4ecdc4', order: 1 },
  effect:    { label: '效果', color: '#f9ca24', order: 2 },
  transition:{ label: '转场', color: '#6c5ce7', order: 3 },
  output:    { label: '输出', color: '#e94560', order: 4 },
  llm:       { label: 'AI',   color: '#5c62ff', order: 5 },
  code:      { label: '代码', color: '#6c5ce7', order: 6 },
  http:      { label: '网络', color: '#4ecdc4', order: 7 },
  variable:  { label: '变量', color: '#fdcb6e', order: 8 },
  condition: { label: '逻辑', color: '#f9ca24', order: 9 },
  dataset:   { label: '数据', color: '#4ecdc4', order: 10 },
  loop:      { label: '循环', color: '#6c5ce7', order: 11 },
  utility:   { label: '工具', color: '#999',    order: 12 },
};

/** 从节点 ID 前缀推断分类 key（如 "source:page-renderer" → "source"） */
export function inferCategoryKey(id: string): string {
  const prefix = id.split(':')[0];
  if (prefix in NODE_CATEGORIES) return prefix;
  return 'utility';
}

// ─── 统一节点清单 ───

export interface NodeManifest {
  /** 节点类型 ID，如 "source:page-renderer" / "common:llm" */
  id: string;
  /** 显示名称 */
  name: string;
  /** 分类 key（用于分组和着色） */
  category: string;
  /** 描述 */
  description: string;
  /** 主题色 */
  color: string;
  /** 图标组件 */
  icon?: FC<{ size?: number; color?: string }> | null;
  /** 端口定义 */
  ports: PortDef[];
  /** 参数 schema */
  params: Record<string, ParamDef>;
  /** 输出变量 */
  outputs?: OutputDef[];
  /** 画布宽度提示 */
  width?: number;
  /** 不可删除 */
  deleteDisable?: boolean;
  /** 不可复制 */
  copyDisable?: boolean;
  /** 节点面板中隐藏 */
  nodePanelVisible?: boolean;
}

// ─── 中央注册表 ───

const _manifests = new Map<string, NodeManifest>();

/** 注册一个节点清单 */
export function registerManifest(m: NodeManifest): void {
  _manifests.set(m.id, m);
}

/** 批量注册 */
export function registerManifests(list: NodeManifest[]): void {
  list.forEach(registerManifest);
}

/** 按 ID 查找 */
export function getManifest(id: string): NodeManifest | undefined {
  return _manifests.get(id);
}

/** 获取所有已注册清单 */
export function getAllManifests(): NodeManifest[] {
  return Array.from(_manifests.values());
}

/** 获取节点显示名称 — 永远从注册表查找，无需硬编码映射 */
export function getNodeName(id: string): string {
  return getManifest(id)?.name ?? id.split(':').pop() ?? id;
}

/** 获取节点主题色 */
export function getNodeColor(id: string): string {
  const m = getManifest(id);
  if (m?.color) return m.color;
  return NODE_CATEGORIES[inferCategoryKey(id)]?.color ?? '#999';
}

/** 获取节点图标组件 */
export function getNodeIcon(id: string): FC<{ size?: number; color?: string }> | null {
  return getManifest(id)?.icon ?? null;
}

/** 获取节点分类信息 */
export function getNodeCategory(id: string): CategoryInfo {
  const m = getManifest(id);
  const catKey = m?.category ?? inferCategoryKey(id);
  return NODE_CATEGORIES[catKey] ?? NODE_CATEGORIES.utility;
}
