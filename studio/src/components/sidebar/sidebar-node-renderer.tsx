/**
 * Coze-style node configuration panel
 * Sticky header with node icon, name, and action buttons + scrollable form
 */
import { useCallback, useRef } from 'react';
import { useNodeRender, FlowNodeEntity } from '@flowgram.ai/free-layout-editor';
import { Button, Tooltip } from '@douyinfe/semi-ui';
import { IconDelete, IconClose } from '@douyinfe/semi-icons';

import { NodeRenderContext } from '../../context';
import { useNodeFormPanel } from '../../plugins/panel-manager-plugin/hooks';
import { getPluginIcon as getVideoIcon } from '../../nodes-video/icons';
import { commonIcons } from '../../nodes-common/icons';

/** Look up icon component by node type */
function lookupIcon(type: string): React.FC<{ size?: number; color?: string }> | null {
  const video = getVideoIcon(type);
  if (video) return video;
  // Common nodes use category-based lookup from the icon map
  const catMap: Record<string, string> = {
    'common:llm': 'llm',
    'common:code': 'code',
    'common:http': 'http',
    'common:set-variable': 'variable',
    'common:condition': 'condition',
    'common:dataset': 'dataset',
  };
  const cat = catMap[type];
  if (cat && commonIcons[cat]) return commonIcons[cat];
  return null;
}

/** Get node color from its type */
function getNodeColor(type: string): string {
  if (type.startsWith('system:')) return '#4e40e5';
  if (type.startsWith('source:')) return '#4ecdc4';
  if (type.startsWith('effect:')) return '#f9ca24';
  if (type.startsWith('transition:')) return '#6c5ce7';
  if (type.startsWith('output:')) return '#e94560';
  if (type.startsWith('common:')) return '#5c62ff';
  return '#999';
}

/** Get node display name */
function getNodeDisplayName(type: string): string {
  const names: Record<string, string> = {
    'system:start': '开始',
    'system:end': '结束',
    'source:page-renderer': '页面渲染',
    'source:audio-picker': '背景音乐',
    'source:glow-strip': '光晕条',
    'effect:fade-in': '淡入',
    'effect:fade-out': '淡出',
    'effect:hold': '停留',
    'effect:sweep-glow': '高亮扫描',
    'transition:page-curl': '翻页',
    'transition:crossfade': '交叉溶解',
    'output:mp4': 'MP4 输出',
    'common:llm': 'LLM 调用',
    'common:code': '代码执行',
    'common:http': 'HTTP 请求',
    'common:set-variable': '设置变量',
    'common:condition': '条件分支',
    'common:dataset': '知识库查询',
  };
  return names[type] ?? type;
}

export function SidebarNodeRenderer(props: { node: FlowNodeEntity }) {
  const { node } = props;
  const nodeRender = useNodeRender(node);
  const { close: closePanel } = useNodeFormPanel();
  const nodeType = node.flowNodeType as string;
  const color = getNodeColor(nodeType);
  const displayName = getNodeDisplayName(nodeType);
  const IconComp = lookupIcon(nodeType);

  const handleClose = useCallback(() => closePanel(), [closePanel]);
  const handleDelete = useCallback(() => {
    node.dispose();
    closePanel();
  }, [node, closePanel]);

  // Determine if end node (no delete/copy)
  const isSpecial = nodeType === 'system:start' || nodeType === 'system:end';
  const headerRef = useRef<HTMLDivElement>(null);

  return (
    <NodeRenderContext.Provider value={nodeRender}>
      <div style={{
        height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
        background: 'var(--coz-bg-plus, #ffffff)', borderRadius: 8,
        border: '1px solid var(--g-stroke-default, #e5e6eb)',
        boxSizing: 'border-box', overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        {/* ─── Coze-style Sticky Header ─── */}
        <div ref={headerRef} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 10px 8px',
          borderBottom: '1px solid var(--g-stroke-divider, #e9eaed)',
          background: color
            ? `linear-gradient(135deg, ${color}14 0%, transparent 100%)`
            : 'var(--coz-bg-plus, #fff)',
          position: 'relative',
        }}>
          {/* Icon with subtle border overlay (matching Coze's ::after trick) */}
          <div style={{
            position: 'relative',
            width: 24, height: 24,
            flexShrink: 0,
          }}>
            <div style={{
              width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4,
            }}>
              {IconComp ? <IconComp size={16} color={color} /> : <span style={{ fontSize: 14 }}>●</span>}
            </div>
            {/* Inset border like Coze's logo::after */}
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: 4,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Title */}
          <span style={{
            fontWeight: 500, fontSize: 15,
            color: 'var(--g-fg-primary, #0f1529d1)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: '22px',
          }}>
            {displayName}
          </span>

          {/* Actions */}
          {!isSpecial && (
            <Tooltip content="删除节点">
              <Button
                size="small" theme="borderless" type="tertiary"
                icon={<IconDelete size="small" />}
                onClick={handleDelete}
                style={{ minWidth: 24, height: 24, color: '#e94560' }}
              />
            </Tooltip>
          )}
          <Tooltip content="关闭">
            <Button
              size="small" theme="borderless" type="tertiary"
              icon={<IconClose size="small" />}
              onClick={handleClose}
              style={{ minWidth: 24, height: 24, color: 'var(--g-fg-dim, #8c8f99)' }}
            />
          </Tooltip>
        </div>

        {/* ─── Scrollable Form Body ─── */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {nodeRender.form?.render()}
        </div>
      </div>
    </NodeRenderContext.Provider>
  );
}
