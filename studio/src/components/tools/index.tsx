/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';

import { useRefresh } from '@flowgram.ai/free-layout-editor';
import { useClientContext } from '@flowgram.ai/free-layout-editor';
import { Tooltip, IconButton, Divider } from '@douyinfe/semi-ui';
import { IconUndo, IconRedo, IconPlus } from '@douyinfe/semi-icons';

import { AddNode } from '../add-node';
import { useToolbox } from '../../context';
import { TestRunButton } from '../testrun/testrun-button';
import { ZoomSelect } from './zoom-select';
import { SwitchLine } from './switch-line';
import { ToolContainer, ToolSection } from './styles';
import { Readonly } from './readonly';
import { MinimapSwitch } from './minimap-switch';
import { Minimap } from './minimap';
import { Interactive } from './interactive';
import { FitView } from './fit-view';
import { Comment } from './comment';
import { AutoLayout } from './auto-layout';
import { ProblemButton } from '../problem-panel';
import { DownloadTool } from './download';

export const DemoTools = () => {
  const { history, playground } = useClientContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(true);
  useEffect(() => {
    const disposable = history.undoRedoService.onChange(() => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
    });
    return () => disposable.dispose();
  }, [history]);
  const refresh = useRefresh();

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => refresh());
    return () => disposable.dispose();
  }, [playground]);

  const toolbox = useToolbox();

  return (
    <ToolContainer className="demo-free-layout-tools">
      <Minimap visible={minimapVisible} />
      <ToolSection>
        <Interactive />
        <AutoLayout />
        <SwitchLine />
        <ZoomSelect />
        <FitView />
        <MinimapSwitch minimapVisible={minimapVisible} setMinimapVisible={setMinimapVisible} />
        <Readonly />
        <Comment />
        <Tooltip content="撤销">
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconUndo />}
            disabled={!canUndo || playground.config.readonly}
            onClick={() => history.undo()}
          />
        </Tooltip>
        <Tooltip content="重做">
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconRedo />}
            disabled={!canRedo || playground.config.readonly}
            onClick={() => history.redo()}
          />
        </Tooltip>
        <ProblemButton />
        <DownloadTool />
        <Divider layout="vertical" style={{ height: '16px' }} margin={3} />
        <Tooltip content={toolbox.visible ? '收起节点列表' : '展开节点列表'}>
          <IconButton
            type="tertiary"
            theme={toolbox.visible ? 'light' : 'borderless'}
            icon={<IconPlus />}
            onClick={toolbox.toggle}
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            添加节点
          </IconButton>
        </Tooltip>
        <Divider layout="vertical" style={{ height: '16px' }} margin={3} />
        <TestRunButton disabled={playground.config.readonly} />
      </ToolSection>
    </ToolContainer>
  );
};
