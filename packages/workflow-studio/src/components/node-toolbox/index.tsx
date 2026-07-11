/**
 * Coze-style left node toolbox panel
 *
 * Docked to the left of the canvas, showing all available nodes
 * grouped by category with search, drag-to-add, and click-to-add.
 */
import React, { useState, useMemo, useCallback } from 'react';

import styled from 'styled-components';
import {
  useClientContext,
  WorkflowDocument,
  useService,
} from '@flowgram.ai/free-layout-editor';

import { nodeRegistries } from '../../nodes';
import type { FlowNodeRegistry } from '../../typings';
import { getNodeName, getNodeCategory, getNodeIcon } from '../../nodes-shared';
import { VIDEO_TEMPLATES, type VideoTemplate } from '../../nodes-video/templates';

// ─── Styles ───

const Panel = styled.div<{ $visible: boolean }>`
  width: 260px;
  min-width: 260px;
  height: 100%;
  background: var(--g-bg-plus, #ffffff);
  border-right: 1px solid var(--g-stroke-default, #e5e6eb);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: margin-left 0.2s ease, opacity 0.15s ease;

  ${({ $visible }) =>
    !$visible
      ? `
    margin-left: -260px;
    opacity: 0;
    pointer-events: none;
  `
      : ''}
`;

const PanelHeader = styled.div`
  padding: 14px 14px 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--g-fg-primary, #0f1529d1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--g-stroke-divider, #e9eaed);
`;

const SearchInput = styled.input`
  margin: 10px 12px;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--g-stroke-default, #e5e6eb);
  background: var(--g-bg-secondary, #f5f5f7);
  font-size: 12px;
  color: var(--g-fg-primary, #0f1529d1);
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--g-stroke-hglt, #4e40e5);
    background: #fff;
  }

  &::placeholder {
    color: var(--g-fg-dim, #8c8f99);
  }
`;

const ScrollArea = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;

  /* ensure scroll works in all browsers */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--g-stroke-default, #d5d6db);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
`;

const CategoryLabel = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px 4px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $color }) => $color};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const NodeButton = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  margin: 1px 6px;
  border-radius: 6px;
  cursor: grab;
  transition: background 0.1s;
  user-select: none;

  &:hover {
    background: var(--g-bg-hover, rgba(78, 64, 229, 0.06));
  }

  &:active {
    cursor: grabbing;
    background: var(--g-bg-hover, rgba(78, 64, 229, 0.10));
  }
`;

const NodeIconWrap = styled.div<{ $color: string }>`
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: ${({ $color }) => $color + '16'};
  flex-shrink: 0;
`;

const NodeName = styled.span`
  font-size: 12px;
  color: var(--g-fg-primary, #0f1529d1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  padding: 32px 14px;
  text-align: center;
  color: var(--g-fg-dim, #8c8f99);
  font-size: 12px;
`;

// ─── Category config (from central registry) ───

interface NodeToolboxProps {
  visible: boolean;
  onClose?: () => void;
}

// ─── Component ───

export const NodeToolbox: React.FC<NodeToolboxProps> = ({ visible, onClose }) => {
  const [search, setSearch] = useState('');
  const context = useClientContext();
  const doc = useService(WorkflowDocument);

  // 模板分类配置
  const templateCategories = [
    { key: 'text', label: '文字模板', color: '#10b981', order: 0 },
    { key: 'image', label: '图片模板', color: '#f59e0b', order: 1 },
    { key: 'video', label: '视频模板', color: '#8b5cf6', order: 2 },
    { key: 'audio', label: '音频模板', color: '#ec4899', order: 3 },
  ];

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase().trim();
    const groups: Record<string, { info: { label: string; color: string; order: number }; templates: VideoTemplate[] }> = {};

    for (const cat of templateCategories) {
      const templates = VIDEO_TEMPLATES.filter(t => t.category === cat.key);
      const filtered = q
        ? templates.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
        : templates;
      if (filtered.length > 0) {
        groups[cat.key] = { info: cat, templates: filtered };
      }
    }

    return Object.entries(groups).sort(([, a], [, b]) => a.info.order - b.info.order);
  }, [search]);

  const filteredNodes = useMemo(() => {
    const q = search.toLowerCase().trim();
    const groups: Record<string, { info: { label: string; color: string; order: number }; nodes: FlowNodeRegistry[] }> = {};

    for (const reg of nodeRegistries) {
      if (reg.meta.nodePanelVisible === false) continue;
      if (reg.type === 'system:start' || reg.type === 'system:end') continue;
      const name = getNodeName(reg.type as string);
      if (q && !name.includes(q) && !(reg.type as string).toLowerCase().includes(q)) continue;

      const cat = getNodeCategory(reg.type as string);
      if (!groups[cat.label]) groups[cat.label] = { info: cat, nodes: [] };
      groups[cat.label].nodes.push(reg);
    }

    return Object.entries(groups).sort(([, a], [, b]) => a.info.order - b.info.order);
  }, [search]);

  const handleAddTemplate = useCallback(
    (template: VideoTemplate, _e: React.MouseEvent) => {
      const pos = { x: 300 + Math.random() * 200, y: 100 + Math.random() * 200 };
      // 创建模板节点，使用模板的预配置参数
      // effect 和 transition 序列化为 JSON 字符串，避免被直接渲染
      doc.createWorkflowNodeByType(
        'template',
        pos,
        {
          data: {
            params: {
              templateId: template.id,
              contentType: template.contentType,
              content: template.defaultContent,
              duration: template.effect?.duration ?? 3.0,
              effectJson: template.effect ? JSON.stringify(template.effect) : '',
              transitionJson: template.transition ? JSON.stringify(template.transition) : '',
            },
          },
        } as any,
      );
    },
    [doc],
  );

  const handleAddNode = useCallback(
    (registry: FlowNodeRegistry, _e: React.MouseEvent) => {
      const pos = { x: 300 + Math.random() * 200, y: 100 + Math.random() * 200 };
      const json = registry.onAdd?.(context);
      const nodeData = (json as any) ?? {};
      doc.createWorkflowNodeByType(
        registry.type as string,
        pos,
        { data: nodeData.data ?? nodeData } as any,
      );
    },
    [context, doc],
  );

  const handleDragStart = useCallback(
    (registry: FlowNodeRegistry, e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', registry.type as string);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  return (
    <Panel $visible={visible}>
      <PanelHeader>
        <span>节点列表</span>
        <span style={{ fontSize: 11, color: 'var(--g-fg-dim, #8c8f99)', fontWeight: 400 }}>
          {VIDEO_TEMPLATES.length} 模板 + {nodeRegistries.length - 2} 节点
        </span>
      </PanelHeader>
      <SearchInput
        placeholder="搜索节点..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ScrollArea>
        {/* 模板部分 */}
        {filteredTemplates.length > 0 && (
          <div>
            <CategoryLabel $color="#10b981">
              视频模板
            </CategoryLabel>
            {filteredTemplates.map(([catKey, group]) => (
              <div key={catKey}>
                <CategoryLabel $color={group.info.color} style={{ paddingLeft: 28, fontSize: 10 }}>
                  {group.info.label}
                </CategoryLabel>
                {group.templates.map((template) => (
                  <NodeButton
                    key={template.id}
                    $color={group.info.color}
                    onClick={(e) => handleAddTemplate(template, e)}
                  >
                    <NodeIconWrap $color={group.info.color}>
                      <span style={{ fontSize: 14 }}>{template.icon}</span>
                    </NodeIconWrap>
                    <NodeName>{template.name}</NodeName>
                  </NodeButton>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 工具节点部分 */}
        {filteredNodes.length === 0 && filteredTemplates.length === 0 ? (
          <EmptyState>没有匹配的节点</EmptyState>
        ) : (
          filteredNodes.map(([catKey, group]) => (
            <div key={catKey}>
              <CategoryLabel $color={group.info.color}>
                {group.info.label}
              </CategoryLabel>
              {group.nodes.map((registry) => {
                const IconComp = registry.info?.iconComponent || getNodeIcon(registry.type as string);
                return (
                  <NodeButton
                    key={registry.type}
                    $color={group.info.color}
                    onClick={(e) => handleAddNode(registry, e)}
                    draggable
                    onDragStart={(e) => handleDragStart(registry, e)}
                  >
                    <NodeIconWrap $color={group.info.color}>
                      {IconComp ? (
                        <IconComp size={14} color={group.info.color} />
                      ) : (
                        <span style={{ fontSize: 11 }}>▣</span>
                      )}
                    </NodeIconWrap>
                    <NodeName>{getNodeName(registry.type as string)}</NodeName>
                  </NodeButton>
                );
              })}
            </div>
          ))
        )}
      </ScrollArea>
    </Panel>
  );
};
