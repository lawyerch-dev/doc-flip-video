/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, startTransition } from 'react';

import {
  PlaygroundEntityContext,
  useRefresh,
  useClientContext,
  FlowNodeFormData,
} from '@flowgram.ai/free-layout-editor';

import { FlowNodeMeta } from '../../typings';
import { useNodeFormPanel } from '../../plugins/panel-manager-plugin/hooks';
import { IsSidebarContext } from '../../context';
import { SidebarNodeRenderer } from './sidebar-node-renderer';

export interface NodeFormPanelProps {
  nodeId: string;
}

export const NodeFormPanel: React.FC<NodeFormPanelProps> = ({ nodeId }) => {
  const { selection, playground, document } = useClientContext();
  const refresh = useRefresh();
  const { close: closePanel } = useNodeFormPanel();
  const handleClose = useCallback(() => {
    // Sidebar delayed closing
    startTransition(() => {
      closePanel();
    });
  }, []);
  const node = document.getNode(nodeId);
  const sidebarDisabled = node?.getNodeMeta<FlowNodeMeta>()?.sidebarDisabled === true;
  /**
   * Listen readonly
   */
  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => {
      handleClose();
      refresh();
    });
    return () => disposable.dispose();
  }, [playground]);
  /**
   * Listen selection
   */
  useEffect(() => {
    const toDispose = selection.onSelectionChanged(() => {
      /**
       * 如果没有选中任何节点，则自动关闭侧边栏
       * If no node is selected, the sidebar is automatically closed
       */
      if (selection.selection.length === 0) {
        handleClose();
      } else if (selection.selection.length === 1 && selection.selection[0] !== node) {
        handleClose();
      }
    });
    return () => toDispose.dispose();
  }, [selection, node, handleClose]);
  /**
   * Close when node disposed
   */
  useEffect(() => {
    if (node) {
      const toDispose = node.onDispose(() => {
        closePanel();
      });
      return () => toDispose.dispose();
    }
    return () => {};
  }, [node, sidebarDisabled, handleClose]);
  /**
   * Cloze when sidebar disabled
   */
  useEffect(() => {
    if (!node || sidebarDisabled || playground.config.readonly) {
      handleClose();
    }
  }, [node, sidebarDisabled, playground.config.readonly]);

  // Force validation when panel opens
  useEffect(() => {
    if (node) {
      try {
        const formModel = node.getData(FlowNodeFormData)?.getFormModel() as any;
        if (formModel?.validate) formModel.validate();
      } catch {}
    }
  }, [nodeId, node]);

  if (!node || sidebarDisabled || playground.config.readonly) {
    return null;
  }

  return (
    <IsSidebarContext.Provider value={true}>
      <PlaygroundEntityContext.Provider key={node.id} value={node}>
        <div style={{ height: 'calc(100vh - 140px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SidebarNodeRenderer node={node} />
        </div>
      </PlaygroundEntityContext.Provider>
    </IsSidebarContext.Provider>
  );
};
