/**
 * 统一注册表工厂 — 从 NodeManifest 构建 FlowNodeRegistry
 *
 * 替代 nodes-video/buildRegistry 和 nodes-common/buildRegistry
 */

import type { NodeManifest } from './types';
import type { FlowNodeRegistry } from '../typings';
import { buildFormMeta } from './render';

/** 从 NodeManifest 构建 FlowNodeRegistry */
export function buildRegistry(manifest: NodeManifest): FlowNodeRegistry {
  const ports = manifest.ports.map((p) => ({
    type: (p.type === 'input' || p.type === 'output'
      ? p.type
      : 'input') as 'input' | 'output',
  }));
  const paramCount = Object.keys(manifest.params).length;

  return {
    type: manifest.id,
    info: {
      description: manifest.description,
      ...(manifest.icon ? { iconComponent: manifest.icon! } : {}),
    },
    meta: {
      defaultPorts: ports,
      size: {
        width: manifest.width ?? 200,
        height: 60 + paramCount * 18 + ports.length * 24,
      },
      ...(manifest.deleteDisable ? { deleteDisable: true } : {}),
      ...(manifest.copyDisable ? { copyDisable: true } : {}),
      ...(manifest.nodePanelVisible === false ? { nodePanelVisible: false } : {}),
    },
    formMeta: buildFormMeta(manifest),
  };
}
