/**
 * JSON 格式转换 — Engine JSON ↔ Flowgram JSON
 *
 * 包含拓扑排序和自动布局算法
 */

import type { FlowDocumentJSON, FlowNodeJSON } from '../typings';
import { getManifest } from '../nodes-shared';

export interface EngineWorkflowJSON {
  version: number;
  name: string;
  variables: Record<string, unknown>;
  nodes: EngineNodeJSON[];
}

export interface EngineNodeJSON {
  id: string;
  type: string;
  params: Record<string, unknown>;
  inputs: Record<string, string>;
  position?: [number, number];
}

/** 判断节点是否属于视频主链路 */
function isMainChain(type: string): boolean {
  const main = [
    'source:page-renderer', 'effect', 'transition:page-curl',
    'transition:crossfade', 'output:mp4',
  ];
  return main.includes(type);
}

/** 拓扑排序：按输入依赖排序 */
function topoSort(nodes: EngineNodeJSON[]): string[] {
  const map = new Map<string, EngineNodeJSON>();
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    map.set(n.id, n);
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const n of nodes) {
    for (const srcId of Object.values(n.inputs ?? {})) {
      adj.get(srcId)?.push(n.id);
      inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
    }
  }

  const q: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) q.push(id);
  }

  const result: string[] = [];
  let head = 0;
  while (head < q.length) {
    const id = q[head++];
    result.push(id);
    for (const next of adj.get(id) ?? []) {
      inDeg.set(next, (inDeg.get(next) ?? 1) - 1);
      if (inDeg.get(next) === 0) q.push(next);
    }
  }
  return result;
}

/** 自动布局：Start → 主链路 → End 从左到右 */
function autoLayout(
  nodes: EngineNodeJSON[],
  ordered: string[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  positions['__start__'] = { x: 20, y: 300 };

  const chainOrder = ordered.filter(id => {
    const n = nodes.find(x => x.id === id);
    return n && isMainChain(n.type);
  });

  const X_STEP = 280;
  chainOrder.forEach((id, i) => {
    positions[id] = { x: 120 + i * X_STEP, y: 300 };
  });

  const side = ordered.filter(id => {
    const n = nodes.find(x => x.id === id);
    return n && !isMainChain(n.type);
  });
  side.forEach((id, i) => {
    positions[id] = { x: 120, y: 520 + i * 160 };
  });

  const lastX = chainOrder.length > 0 ? 120 + chainOrder.length * X_STEP : 120;
  positions['__end__'] = { x: lastX, y: 300 };

  return positions;
}

/** Engine format → Flowgram format */
export function fromEngineJSON(engine: EngineWorkflowJSON): FlowDocumentJSON {
  const engineNodes = engine.nodes ?? [];
  const ordered = topoSort(engineNodes);
  const layout = autoLayout(engineNodes, ordered);

  const hasStart = engineNodes.some(n => n.id === '__start__');
  const hasEnd = engineNodes.some(n => n.id === '__end__');

  const startNode = hasStart ? null : {
    id: '__start__',
    type: 'system:start',
    meta: { position: { x: layout['__start__'].x, y: layout['__start__'].y } },
    data: { title: '开始', params: {} },
  };
  const endNode = hasEnd ? null : {
    id: '__end__',
    type: 'system:end',
    meta: { position: { x: layout['__end__'].x, y: layout['__end__'].y } },
    data: { title: '结束', params: {} },
  };

  const mainNodes = engineNodes.filter(n => isMainChain(n.type));
  const edges: any[] = [];

  if (mainNodes.length > 0) {
    edges.push({ id: 'start_to_0', source: '__start__', target: mainNodes[0].id, sourcePort: '0', targetPort: '0' });
  }

  for (let i = 0; i < mainNodes.length - 1; i++) {
    edges.push({
      id: `${mainNodes[i].id}->${mainNodes[i + 1].id}`,
      source: mainNodes[i].id,
      target: mainNodes[i + 1].id,
      sourcePort: '0',
      targetPort: '0',
    });
  }

  if (mainNodes.length > 0) {
    edges.push({ id: 'last_to_end', source: mainNodes[mainNodes.length - 1].id, target: '__end__', sourcePort: '0', targetPort: '0' });
  }

  for (const node of engineNodes) {
    for (const [_portName, srcId] of Object.entries(node.inputs ?? {})) {
      if (!srcId) continue;
      const alreadyInMain = mainNodes.some((m, i) =>
        (i < mainNodes.length - 1 && m.id === srcId && mainNodes[i + 1].id === node.id) ||
        (i > 0 && m.id === node.id && mainNodes[i - 1].id === srcId),
      );
      if (!alreadyInMain) {
        edges.push({
          id: `${srcId}->${node.id}-side`,
          source: srcId,
          target: node.id,
          sourcePort: '0',
          targetPort: '0',
        });
      }
    }
  }

  const injected: FlowNodeJSON[] = [];
  if (startNode) injected.push(startNode);
  for (const n of engineNodes) {
    if (n.id === '__start__' || n.id === '__end__') continue;
    const manifest = getManifest(n.type);
    const pos = layout[n.id] ?? { x: 100, y: 100 };
    injected.push({
      id: n.id,
      type: n.type,
      meta: { position: { x: pos.x, y: pos.y } },
      data: { title: manifest?.name ?? n.type, params: n.params },
    });
  }
  if (endNode) injected.push(endNode);

  return { nodes: injected, edges };
}

/**
 * Flowgram format → Engine format
 *
 * 模板节点会被展开为 source + effect 节点组合
 */
export function toEngineJSON(doc: FlowDocumentJSON): EngineWorkflowJSON {
  const nodes: EngineNodeJSON[] = [];
  const edges = doc.edges ?? [];

  // 第一遍：处理普通节点，展开模板节点
  for (const n of doc.nodes ?? []) {
    const type = String(n.type);
    const params = (n.data?.params as Record<string, unknown>) ?? {};

    if (type === 'template') {
      // 展开模板节点为 source + effect
      const contentType = params.contentType as string;
      const content = params.content as string;
      const duration = params.duration as number ?? 3.0;
      const effectJson = params.effectJson as string;

      // 解析 effect 配置
      let effect: { type: string; duration: number; color?: string; glowStripWidthRatio?: number } | undefined;
      if (effectJson) {
        try {
          effect = JSON.parse(effectJson);
        } catch {
          // 忽略解析错误
        }
      }

      // 确定 source 类型
      let sourceType: string;
      if (contentType === 'audio') {
        sourceType = 'source:audio-picker';
      } else {
        sourceType = 'source:page-renderer';
      }

      // 创建 source 节点
      const sourceId = `${n.id}_source`;
      nodes.push({
        id: sourceId,
        type: sourceType,
        params: { dir: content },
        inputs: {},
        position: n.meta?.position ? [n.meta.position.x, n.meta.position.y] : [100, 100],
      });

      // 如果有 effect，创建 effect 节点
      if (effect) {
        const effectId = `${n.id}_effect`;
        const effectParams: Record<string, unknown> = {
          effectType: effect.type,
          duration: effect.duration ?? duration,
        };
        if (effect.color) effectParams.color = effect.color;
        if (effect.glowStripWidthRatio) effectParams.glowStripWidthRatio = effect.glowStripWidthRatio;

        // 映射 effectType 到具体类型
        const effectTypeMap: Record<string, string> = {
          'fade-in': 'effect:fade-in',
          'fade-out': 'effect:fade-out',
          'hold': 'effect:hold',
          'sweep-glow': 'effect:sweep-glow',
        };
        const effectNodeType = effectTypeMap[effect.type] ?? 'effect:fade-in';

        nodes.push({
          id: effectId,
          type: effectNodeType,
          params: effectParams,
          inputs: { source: sourceId },
          position: n.meta?.position ? [n.meta.position.x + 250, n.meta.position.y] : [350, 100],
        });
      }
    } else {
      // 普通节点，直接添加
      const nodeInputs: Record<string, string> = {};
      const manifest = getManifest(type);
      const portNames = (manifest?.ports ?? [])
        .filter(p => p.type === 'input')
        .map(p => p.name ?? '');
      for (const edge of edges) {
        if (edge.target === n.id && edge.targetPort) {
          const idx = parseInt(edge.targetPort, 10);
          if (!isNaN(idx) && idx < portNames.length) {
            nodeInputs[portNames[idx]] = edge.source;
          }
        }
      }
      nodes.push({
        id: n.id,
        type,
        params,
        inputs: nodeInputs,
        position: n.meta?.position ? [n.meta.position.x, n.meta.position.y] : [100, 100],
      });
    }
  }

  // 第二遍：更新边，将指向模板节点的边重定向到对应的 effect 节点
  const templateRedirects = new Map<string, string>();
  for (const n of doc.nodes ?? []) {
    if (String(n.type) === 'template') {
      const params = (n.data?.params as Record<string, unknown>) ?? {};
      const effect = params.effect as { type: string } | undefined;
      if (effect) {
        templateRedirects.set(n.id, `${n.id}_effect`);
      } else {
        templateRedirects.set(n.id, `${n.id}_source`);
      }
    }
  }

  // 更新 edges 中的 source 引用
  for (const edge of edges) {
    const newSource = templateRedirects.get(edge.source);
    if (newSource) {
      // 找到对应的节点，更新其 inputs
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode) {
        targetNode.inputs[edge.sourcePort ?? '0'] = newSource;
      }
    }
  }

  return {
    version: 1,
    name: '未命名工作流',
    variables: { width: 1080, height: 1840, fps: 30 },
    nodes,
  };
}

/** 从后端加载默认工作流 */
export async function fetchDefaultWorkflow(): Promise<FlowDocumentJSON> {
  try {
    const resp = await fetch('/workflows/article-default.json');
    if (resp.ok) {
      const engineJSON = (await resp.json()) as EngineWorkflowJSON;
      return fromEngineJSON(engineJSON);
    }
  } catch {
    // fall through
  }
  return { nodes: [], edges: [] };
}
