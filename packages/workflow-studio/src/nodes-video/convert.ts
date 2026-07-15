/**
 * JSON 格式转换 — Flowgram JSON ↔ Workflow Engine JSON
 */

import type { FlowDocumentJSON } from '../typings';

// ── Workflow Engine Types ──

interface WorkflowEffect {
  type: 'hold' | 'fade-in' | 'fade-out' | 'transition' | 'sweep';
  params: {
    duration: number;
    easing?: string;
    transition?: string;
    keyword?: string;
    [key: string]: unknown;
  };
}

interface WorkflowNode {
  id: string;
  name: string;
  content: {
    kind: 'text' | 'image' | 'audio' | 'video';
    source: string;
    duration?: number;
    style?: Record<string, unknown>;
  };
  effects: WorkflowEffect[];
}

interface WorkflowCanvas {
  width: number;
  height: number;
  fps: number;
}

interface WorkflowAudio {
  source: string;
  fadeIn?: { duration: number };
  fadeOut?: { duration: number };
}

interface WorkflowOutput {
  filename?: string;
  outputDir?: string;
  crf?: number;
}

export interface WorkflowJSON {
  name: string;
  canvas: WorkflowCanvas;
  variables?: Record<string, unknown>;
  nodes: WorkflowNode[];
  audio?: WorkflowAudio;
  output: WorkflowOutput;
}

/** 从后端加载默认工作流 */
export async function fetchDefaultWorkflow(): Promise<FlowDocumentJSON> {
  try {
    const resp = await fetch('/workflows/article-default.json');
    if (resp.ok) {
      return (await resp.json()) as FlowDocumentJSON;
    }
  } catch {
    // fall through
  }
  return { nodes: [], edges: [] };
}

/**
 * Flowgram format → Workflow Engine format
 *
 * 将 flowgram 编辑器状态转换为工作流引擎的 JSON
 */
export function toWorkflowJSON(doc: FlowDocumentJSON): WorkflowJSON {
  const nodes: WorkflowNode[] = [];
  const edges = doc.edges ?? [];

  // 获取 start 节点的参数
  const startNode = doc.nodes?.find(n => String(n.type) === 'system:start');
  const startParams = (startNode?.data?.params as Record<string, unknown>) ?? {};

  // 画布配置
  const canvas: WorkflowCanvas = {
    width: (startParams.width as number) ?? 1080,
    height: (startParams.height as number) ?? 1840,
    fps: (startParams.fps as number) ?? 30,
  };

  // 获取主链路节点（排除 start 和 end）
  const mainNodes = (doc.nodes ?? []).filter(n => {
    const type = String(n.type);
    return type !== 'system:start' && type !== 'system:end';
  });

  // 按边的顺序排序节点
  const ordered: typeof mainNodes = [];
  const visited = new Set<string>();

  // 找到 start 连接的第一个节点
  const startEdge = edges.find(e => e.source === '__start__');
  let currentId = startEdge?.target ?? null;

  while (currentId && currentId !== '__end__' && !visited.has(currentId)) {
    visited.add(currentId);
    const node = mainNodes.find(n => n.id === currentId);
    if (node) ordered.push(node);
    // 找下一个节点
    const nextEdge = edges.find(e => e.source === currentId);
    currentId = nextEdge?.target ?? null;
  }

  // 添加未连接的节点
  for (const node of mainNodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  // 转换每个节点
  for (const node of ordered) {
    const type = String(node.type);
    const params = (node.data?.params as Record<string, unknown>) ?? {};

    if (type === 'template') {
      // 模板节点：转换为引擎格式
      const contentType = (params.contentType as string) ?? 'image';
      const content = (params.content as string) ?? '';
      const duration = (params.duration as number) ?? 3.0;
      const effectJson = params.effectJson as string;

      // 解析效果配置
      let effectConfig: { type: string; duration: number; transition?: string; easing?: string } | undefined;
      if (effectJson) {
        try {
          effectConfig = JSON.parse(effectJson);
        } catch {
          // 忽略解析错误
        }
      }

      // 构建效果列表
      const effects: WorkflowEffect[] = [];

      // 添加 hold 效果
      effects.push({
        type: 'hold',
        params: { duration },
      });

      // 添加转场效果（如果有）
      if (effectConfig?.type === 'transition' || effectConfig?.type === 'fade-out') {
        effects.push({
          type: effectConfig.type as 'transition' | 'fade-out',
          params: {
            duration: effectConfig.duration ?? 2.0,
            transition: effectConfig.transition ?? 'dissolve',
            easing: effectConfig.easing ?? 'cubic-in-out',
          },
        });
      } else if (effectConfig?.type === 'fade-in') {
        effects.push({
          type: 'fade-in',
          params: { duration: effectConfig.duration ?? 1.5 },
        });
      }

      // 确定内容类型
      let contentKind: 'text' | 'image' | 'audio' | 'video' = 'image';
      if (contentType === 'text' || contentType === 'audio' || contentType === 'video') {
        contentKind = contentType as 'text' | 'audio' | 'video';
      }

      nodes.push({
        id: node.id,
        name: (node.data?.title as string) ?? node.id,
        content: {
          kind: contentKind,
          source: content,
          duration,
        },
        effects,
      });
    } else if (type === 'source:page-renderer') {
      const page = (params.page as string) ?? 'cover';

      nodes.push({
        id: node.id,
        name: (node.data?.title as string) ?? `页面 ${page}`,
        content: {
          kind: 'image',
          source: '', // 由后端根据 page 参数生成
        },
        effects: [
          { type: 'hold', params: { duration: 3.0 } },
        ],
      });
    } else if (type === 'source:audio-picker') {
      nodes.push({
        id: node.id,
        name: (node.data?.title as string) ?? '背景音乐',
        content: {
          kind: 'audio',
          source: 'assets/music',
        },
        effects: [],
      });
    } else if (type.startsWith('effect:')) {
      // 效果节点：添加到前一个节点的效果列表
      const effectType = type.replace('effect:', '');
      const lastNode = nodes[nodes.length - 1];
      if (lastNode) {
        let mappedType: WorkflowEffect['type'] = 'hold';
        if (effectType === 'fade-in') mappedType = 'fade-in';
        else if (effectType === 'fade-out') mappedType = 'fade-out';
        else if (effectType === 'sweep-glow') mappedType = 'sweep';

        lastNode.effects.push({
          type: mappedType,
          params: {
            duration: (params.duration as number) ?? 2.0,
            keyword: params.keyword as string,
          },
        });
      }
    } else if (type.startsWith('transition:')) {
      // 转场节点：添加到前一个节点的效果列表
      const transitionType = type.replace('transition:', '');
      const lastNode = nodes[nodes.length - 1];
      if (lastNode) {
        lastNode.effects.push({
          type: 'transition',
          params: {
            duration: (params.duration as number) ?? 2.5,
            transition: transitionType === 'page-curl' ? 'page-curl' : transitionType,
            easing: (params.easing as string) ?? 'cubic-in-out',
          },
        });
      }
    }
  }

  // 获取 end 节点的参数
  const endNode = doc.nodes?.find(n => String(n.type) === 'system:end');
  const endParams = (endNode?.data?.params as Record<string, unknown>) ?? {};

  // 输出配置
  const output: WorkflowOutput = {
    filename: endParams.outputName as string,
    crf: endParams.crf as number,
  };

  return {
    name: (startParams.workflowName as string) ?? '未命名工作流',
    canvas,
    nodes,
    output,
  };
}
