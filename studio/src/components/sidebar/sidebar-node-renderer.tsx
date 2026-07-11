/**
 * 侧边栏节点渲染器 — 委托给 formMeta.render()
 *
 * 旧版自定义了 header + body，现在由 buildFormMeta 统一渲染
 * SidebarFormHeader + 参数表单已在 nodes-shared/render.tsx 中实现
 */

import { FlowNodeEntity, useNodeRender } from '@flowgram.ai/free-layout-editor';

import { NodeRenderContext } from '../../context';

export function SidebarNodeRenderer(props: { node: FlowNodeEntity }) {
  const { node } = props;
  const nodeRender = useNodeRender(node);

  return (
    <NodeRenderContext.Provider value={nodeRender}>
      {nodeRender.form?.render()}
    </NodeRenderContext.Provider>
  );
}
