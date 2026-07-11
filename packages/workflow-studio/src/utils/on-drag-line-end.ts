/**
 * Drag the end of the line to create an add panel (feature optional)
 * 拖拽线条结束需要创建一个添加面板 （功能可选）
 *
 * Simplified: does nothing — users add nodes via the left toolbox panel.
 * 简化版：不弹出浮层，用户通过左侧工具箱面板添加节点。
 */

import type {
  FreeLayoutPluginContext,
  onDragLineEndParams,
} from '@flowgram.ai/free-layout-editor';

export const onDragLineEnd = async (
  _ctx: FreeLayoutPluginContext,
  _params: onDragLineEndParams,
) => {
  // No-op: node addition is handled by the left NodeToolbox panel
  return;
};
