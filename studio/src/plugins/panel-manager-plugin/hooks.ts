/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { usePanelManager } from '@flowgram.ai/panel-manager-plugin';

import type { NodeFormPanelProps } from '../../components/sidebar/node-form-panel';
import { PanelType } from './constants';

/** Open node form panel, close all other panels first */
export const useNodeFormPanel = () => {
  const panelManager = usePanelManager();

  const open = (props: NodeFormPanelProps) => {
    // Close other panels first
    panelManager.close(PanelType.TestRunFormPanel);
    panelManager.close(PanelType.ProblemPanel);
    panelManager.open(PanelType.NodeFormPanel, 'right', {
      props: props,
    });
  };
  const close = () => panelManager.close(PanelType.NodeFormPanel);

  return { open, close };
};

/** Open test run panel, close all other panels first */
export const useTestRunFormPanel = () => {
  const panelManager = usePanelManager();

  const open = () => {
    panelManager.close(PanelType.NodeFormPanel);
    panelManager.close(PanelType.ProblemPanel);
    panelManager.open(PanelType.TestRunFormPanel, 'docked-right');
  };
  const close = () => panelManager.close(PanelType.TestRunFormPanel);

  return { open, close };
};

export const useProblemPanel = () => {
  const panelManager = usePanelManager();

  const open = () => {
    panelManager.open(PanelType.ProblemPanel, 'bottom');
  };
  const close = () => panelManager.close(PanelType.ProblemPanel);

  return { open, close };
};
