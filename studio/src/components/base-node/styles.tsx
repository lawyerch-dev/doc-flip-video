/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components';
import { IconInfoCircle } from '@douyinfe/semi-icons';

function getNodeBorderColor(type: string): string {
  if (type.startsWith('system:')) return '#4e40e5';
  if (type.startsWith('source:')) return '#4ecdc4';
  if (type.startsWith('effect:')) return '#f9ca24';
  if (type.startsWith('transition:')) return '#6c5ce7';
  if (type.startsWith('output:')) return '#e94560';
  if (type.startsWith('common:')) return '#5c62ff';
  return 'var(--g-stroke-default)';
}

export const NodeWrapperStyle = styled.div<{ $type?: string }>`
  align-items: flex-start;
  background-color: var(--g-bg-plus);
  border: 1px solid ${({ $type }) => $type ? getNodeBorderColor($type) : 'var(--g-stroke-default)'};
  border-radius: var(--g-radius-md);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  min-width: 160px;
  width: auto;
  height: auto;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.selected {
    border: 1.5px solid var(--g-stroke-hglt);
    box-shadow: 0 0 0 1px var(--g-stroke-hglt);
  }
`;

export const ErrorIcon = () => (
  <IconInfoCircle
    style={{
      position: 'absolute',
      color: 'red',
      left: -6,
      top: -6,
      zIndex: 1,
      background: 'white',
      borderRadius: 8,
    }}
  />
);
