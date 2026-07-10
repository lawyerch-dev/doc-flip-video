import type { FlowDocumentJSON } from './typings';

/** 空工作流始终包含 Start 和 End 节点 */
export const initialData: FlowDocumentJSON = {
  nodes: [
    {
      id: '__start__',
      type: 'system:start',
      meta: { position: { x: 350, y: 300 } },
      data: { title: '开始', params: { workflowName: '新工作流', width: 1080, height: 1840, fps: 30 } },
    },
    {
      id: '__end__',
      type: 'system:end',
      meta: { position: { x: 750, y: 300 } },
      data: { title: '结束', params: { outputName: '', crf: 14 } },
    },
  ],
  edges: [] as any[],
};
