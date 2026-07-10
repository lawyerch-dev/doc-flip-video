/**
 * 通用节点类型 — 向后兼容 re-export
 *
 * 实际类型已统一到 nodes-shared
 */

// 统一类型从 nodes-shared re-export
export type {
  ParamType,
  ParamDef,
  OutputDef,
  PortDef,
  NodeManifest as CommonNodeManifest,
} from '../nodes-shared';
