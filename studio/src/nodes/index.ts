/**
 * 节点注册 - 视频工作流
 * 复用 Flowgram 的 Free Layout 编辑器，注册我们自己的视频插件节点
 */

import { nodeRegistries as videoRegistries } from '../nodes-video';

export { VideoNodeType as WorkflowNodeType } from '../nodes-video/constants';
export { BUILTIN_PLUGINS, type PluginManifest } from '../nodes-video/plugin-manifest';
export { fromEngineJSON, toEngineJSON, fetchDefaultWorkflow } from '../nodes-video';
export type { EngineWorkflowJSON, EngineNodeJSON } from '../nodes-video';

export const nodeRegistries = videoRegistries;
