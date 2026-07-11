/**
 * 通用节点注册 — 使用统一的 NodeManifest + buildRegistry
 *
 * 渲染和校验逻辑统一由 nodes-shared 提供
 */

import type { NodeManifest } from '../nodes-shared';
import { buildRegistry, registerManifests } from '../nodes-shared';

import { LLM_NODE } from './llm';
import { CODE_NODE } from './code';
import { HTTP_NODE } from './http';
import { SET_VARIABLE_NODE } from './variable';
import { CONDITION_NODE } from './condition';
import { DATASET_NODE } from './dataset';
import { FUNCTION_NODE } from './function';
import { LOOP_NODE } from './loop';

export const ALL_COMMON_MANIFESTS: NodeManifest[] = [
  LLM_NODE,
  CODE_NODE,
  HTTP_NODE,
  SET_VARIABLE_NODE,
  CONDITION_NODE,
  DATASET_NODE,
  FUNCTION_NODE,
  LOOP_NODE,
];

// ─── 注册到中央注册表 ───
registerManifests(ALL_COMMON_MANIFESTS);

/** 构建所有通用节点的 FlowNodeRegistry */
export const commonNodeRegistries: import('../typings').FlowNodeRegistry[] =
  ALL_COMMON_MANIFESTS.map(buildRegistry);
