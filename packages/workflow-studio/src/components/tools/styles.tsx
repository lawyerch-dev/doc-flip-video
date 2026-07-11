/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components';

import { IconMinimap } from '../../assets/icon-minimap';

export const ToolContainer = styled.div`
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
  z-index: 20;
  /* Ensure toolbar is always visible */
  min-width: 360px;
  visibility: visible !important;
  opacity: 1 !important;
`;

export const ToolSection = styled.div`
  display: flex;
  align-items: center;
  background-color: var(--g-bg-max);
  border: 1px solid var(--g-stroke-default);
  border-radius: var(--g-radius-pill);
  box-shadow: var(--g-shadow-toolbar);
  column-gap: 2px;
  height: 40px;
  padding: 0 4px;
  pointer-events: auto;
`;

export const SelectZoom = styled.span`
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(68, 83, 130, 0.25);
  font-size: 12px;
  width: 50px;
  cursor: pointer;
`;

export const MinimapContainer = styled.div`
  width: 180px;
  border: 1px solid var(--g-stroke-default);
  border-radius: var(--g-radius-md);
  box-shadow: var(--g-shadow-toolbar);
  overflow: hidden;
  background: var(--g-bg-plus);
  pointer-events: auto;
`;

export const UIIconMinimap = styled(IconMinimap)<{ visible: boolean }>`
  color: ${(props) => (props.visible ? undefined : '#060709cc')};
`;
