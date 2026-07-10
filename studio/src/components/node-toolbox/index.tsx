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
import { getNodeName, getNodeColor, getNodeCategory, getNodeIcon } from '../../nodes-shared';

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
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
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

  const filtered = useMemo(() => {
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

  const handleAddNode = useCallback(
    (registry: FlowNodeRegistry, e: React.MouseEvent) => {
      const json = registry.onAdd?.(context);
      const pos = { x: 300 + Math.random() * 200, y: 100 + Math.random() * 200 };
      const nodeData: any = {
        type: registry.type as string,
        ...(json ? { data: json.data ?? json } : {}),
      };
      const nodePos = (json as any)?.position ?? pos;
      nodeData.position = nodePos;
      doc.addNode(nodeData);
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
          {nodeRegistries.length - 2} 个
        </span>
      </PanelHeader>
      <SearchInput
        placeholder="搜索节点..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ScrollArea>
        {filtered.length === 0 ? (
          <EmptyState>没有匹配的节点</EmptyState>
        ) : (
          filtered.map(([catKey, group]) => (
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
