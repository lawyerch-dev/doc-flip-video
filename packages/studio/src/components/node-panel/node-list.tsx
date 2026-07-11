/**
 * Coze-style node selection panel
 * Groups nodes by category with SVG icons, Chinese names, and category badges
 */
import React, { FC, useMemo } from 'react';

import styled from 'styled-components';
import { NodePanelRenderProps } from '@flowgram.ai/free-node-panel-plugin';
import {
  useClientContext,
  WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor';

import { canContainNode } from '../../utils';
import { FlowNodeRegistry } from '../../typings';
import { nodeRegistries } from '../../nodes';

// ─── Styles (Coze-inspired) ───

const PanelWrap = styled.div`
  width: 340px;
  max-height: 420px;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #999;
  }
`;

const CategoryHeader = styled.div<{ color: string }>`
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ color }) => color};
  margin-top: 4px;

  &:first-child {
    margin-top: 0;
  }
`;

const NodeItem = styled.div`
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  cursor: pointer;
  gap: 8px;

  &:hover {
    background: #f5f5f5;
  }
`;

const NodeIconWrap = styled.div<{ color: string }>`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: ${({ color }) => color + '18'};
  flex-shrink: 0;
`;

const NodeName = styled.span`
  font-size: 13px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CategoryBadge = styled.span<{ color: string }>`
  font-size: 11px;
  color: ${({ color }) => color};
  opacity: 0.6;
  flex-shrink: 0;
`;

// ─── Helpers ───

interface CategoryInfo {
  label: string;
  shortLabel: string;
  color: string;
  order: number;
}

function getNodeCategory(type: string): CategoryInfo {
  if (type.startsWith('system:')) return { label: '系统', shortLabel: '系', color: '#999', order: 0 };
  if (type.startsWith('source:')) return { label: '来源', shortLabel: '源', color: '#4ecdc4', order: 1 };
  if (type.startsWith('effect:')) return { label: '效果', shortLabel: '效', color: '#f9ca24', order: 2 };
  if (type.startsWith('transition:')) return { label: '转场', shortLabel: '转', color: '#6c5ce7', order: 3 };
  if (type.startsWith('output:')) return { label: '输出', shortLabel: '输', color: '#e94560', order: 4 };
  if (type.startsWith('common:')) return { label: '通用', shortLabel: '通', color: '#4e40e5', order: 5 };
  return { label: '其他', shortLabel: '其', color: '#999', order: 99 };
}

const DISPLAY_NAMES: Record<string, string> = {
  'system:start': '开始',
  'system:end': '结束',
  'source:page-renderer': '页面渲染',
  'source:audio-picker': '背景音乐',
  'source:glow-strip': '光晕条',
  'effect': '视频效果',
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

function getDisplayName(type: string): string {
  return DISPLAY_NAMES[type] ?? type.split(':').pop() ?? type;
}

interface NodeListProps {
  onSelect: NodePanelRenderProps['onSelect'];
  containerNode?: WorkflowNodeEntity;
}

export const NodeList: FC<NodeListProps> = (props) => {
  const { onSelect, containerNode } = props;
  const context = useClientContext();

  const handleClick = (e: React.MouseEvent, registry: FlowNodeRegistry) => {
    const json = registry.onAdd?.(context);
    onSelect({
      nodeType: registry.type as string,
      selectEvent: e,
      nodeJSON: json,
    });
  };

  /** Group by category, sorted by order */
  const grouped = useMemo(() => {
    const groups: Record<string, { info: CategoryInfo; nodes: FlowNodeRegistry[] }> = {};
    for (const reg of nodeRegistries) {
      if (reg.meta.nodePanelVisible === false) continue;
      if (containerNode && reg.meta.onlyInContainer) {
        if (reg.meta.onlyInContainer !== containerNode.flowNodeType) continue;
      }
      if (containerNode && !canContainNode(reg.type as string, containerNode.flowNodeType)) continue;
      if (!(reg.canAdd?.(context) ?? true)) continue;

      const cat = getNodeCategory(reg.type as string);
      const key = cat.label;
      if (!groups[key]) groups[key] = { info: cat, nodes: [] };
      groups[key].nodes.push(reg);
    }
    return Object.entries(groups)
      .sort(([, a], [, b]) => a.info.order - b.info.order);
  }, [containerNode, context]);

  return (
    <PanelWrap>
      {grouped.map(([catKey, group]) => (
        <div key={catKey}>
          <CategoryHeader color={group.info.color}>
            {group.info.label}
          </CategoryHeader>
          {group.nodes.map((registry) => {
            const IconComp = registry.info?.iconComponent;
            return (
              <NodeItem
                key={registry.type}
                onClick={(e) => handleClick(e, registry)}
              >
                <NodeIconWrap color={group.info.color}>
                  {IconComp
                    ? <IconComp size={16} color={group.info.color} />
                    : <span style={{ fontSize: 12 }}>□</span>
                  }
                </NodeIconWrap>
                <NodeName>{getDisplayName(registry.type as string)}</NodeName>
                <CategoryBadge color={group.info.color}>
                  {group.info.shortLabel}
                </CategoryBadge>
              </NodeItem>
            );
          })}
        </div>
      ))}
      {grouped.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>
          没有可添加的节点
        </div>
      )}
    </PanelWrap>
  );
};
