/**
 * 节点注册 - 视频工作流 + 通用节点
 * 复用 Flowgram 的 Free Layout 编辑器，注册我们自己的视频插件节点
 * 以及 Coze 风格的通用节点（LLM, Code, HTTP, Variable, Condition, Dataset）
 */

import { nodeRegistries as videoRegistries } from '../nodes-video';
import { commonNodeRegistries } from '../nodes-common';

// Legacy node type enum (used by old flowgram demo code)
export { WorkflowNodeType } from './constants';

export { VideoNodeType } from '../nodes-video/constants';
export { BUILTIN_PLUGINS, type PluginManifest } from '../nodes-video/plugin-manifest';
export { fromEngineJSON, toEngineJSON, fetchDefaultWorkflow } from '../nodes-video';
export type { EngineWorkflowJSON, EngineNodeJSON } from '../nodes-video';

/** 合并所有节点注册（视频 + 通用节点） */
export const nodeRegistries: import('../typings').FlowNodeRegistry[] = [
  ...videoRegistries,
  ...commonNodeRegistries,
];
