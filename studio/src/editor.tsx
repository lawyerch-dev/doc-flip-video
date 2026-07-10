/**
 * Coze-style workflow editor
 *
 * Layout: [TopBar] [Left NodeToolbox (260px)] [Canvas] [DemoTools overlay]
 */
import { useCallback, useState } from 'react';
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  useService,
  usePlaygroundTools,
  WorkflowDocument,
} from '@flowgram.ai/free-layout-editor';
import { Button, Tooltip, Toast } from '@douyinfe/semi-ui';
import {
  IconChevronLeft,
  IconSave,
  IconPlayCircle,
  IconSetting,
  IconPlus,
} from '@douyinfe/semi-icons';

const TOAST_CONFIG = { top: 80, duration: 3 };

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries, fetchDefaultWorkflow, toEngineJSON } from './nodes';
import { initialData } from './initial-data';
import type { FlowDocumentJSON } from './typings';
import { useEditorProps } from './hooks';
import { IconDownload } from './assets/icons';
import { NodeToolbox } from './components/node-toolbox';
import { DemoTools } from './components/tools';
import { ToolboxContext, useToolbox } from './context';

interface EditorProps {
  workflowId: string;
  onBack: () => void;
}

/** Coze-style top bar — spans full width above toolbox + canvas */
function TopBar({ onBack }: { onBack: () => void }) {
  const doc = useService(WorkflowDocument);
  const tools = usePlaygroundTools();
  const [saving, setSaving] = useState(false);
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const toolbox = useToolbox();

  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      const wf = toEngineJSON(doc.toJSON() as FlowDocumentJSON);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' }),
      );
      a.download = `workflow-${Date.now()}.json`;
      a.click();
      Toast.success({ content: '已导出', ...TOAST_CONFIG });
    } finally {
      setSaving(false);
    }
  }, [doc]);

  const handleRun = useCallback(() => {
    localStorage.setItem(
      'wf-to-run',
      JSON.stringify(toEngineJSON(doc.toJSON() as FlowDocumentJSON)),
    );
    Toast.info({ content: '终端运行: npm run workflow', ...TOAST_CONFIG });
  }, [doc]);

  const handleLoadDefault = useCallback(async () => {
    try {
      doc.fromJSON(await fetchDefaultWorkflow());
      tools.fitView(false);
      Toast.success({ content: '已加载默认工作流', ...TOAST_CONFIG });
    } catch {
      Toast.error({ content: '加载失败', ...TOAST_CONFIG });
    }
  }, [doc, tools]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 48,
        padding: '0 8px',
        background: 'var(--g-bg-max, #ffffff)',
        borderBottom: '1px solid var(--g-stroke-default, #e5e6eb)',
        flexShrink: 0,
      }}
    >
      {/* Back */}
      <Button
        size="small"
        theme="borderless"
        type="tertiary"
        icon={<IconChevronLeft size="small" />}
        onClick={onBack}
        style={{ marginRight: 2 }}
      />

      {/* Toggle node toolbox */}
      <Tooltip content={toolbox.visible ? '收起节点列表' : '展开节点列表'}>
        <Button
          size="small"
          theme={toolbox.visible ? 'light' : 'borderless'}
          type={toolbox.visible ? 'primary' : 'tertiary'}
          icon={<IconPlus size="small" />}
          onClick={toolbox.toggle}
          style={{
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            marginRight: 4,
          }}
        >
          添加节点
        </Button>
      </Tooltip>

      {/* Editable workflow name */}
      <input
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--g-fg-primary, #0f1529d1)',
          outline: 'none',
          width: 180,
          padding: '4px 6px',
          borderRadius: 4,
        }}
        onFocus={(e) => {
          e.target.style.background = 'var(--g-bg-secondary, #f5f5f7)';
        }}
        onBlur={(e) => {
          e.target.style.background = 'transparent';
        }}
        placeholder="工作流名称"
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Actions */}
      <Tooltip content="加载默认">
        <Button
          size="small"
          theme="borderless"
          type="tertiary"
          onClick={handleLoadDefault}
          style={{ fontSize: 12, color: 'var(--g-fg-secondary, #666)' }}
        >
          加载
        </Button>
      </Tooltip>
      <Tooltip content="导出 JSON">
        <Button
          size="small"
          theme="borderless"
          type="tertiary"
          icon={<IconSave size="small" />}
          onClick={handleSave}
          loading={saving}
          style={{ fontSize: 12 }}
        >
          保存
        </Button>
      </Tooltip>
      <Tooltip content="下载配置">
        <Button
          size="small"
          theme="borderless"
          type="tertiary"
          icon={<IconDownload size={14} color="currentColor" />}
          style={{ fontSize: 12 }}
        >
          导出
        </Button>
      </Tooltip>
      <div
        style={{
          width: 1,
          height: 20,
          background: 'var(--g-stroke-divider, #e9eaed)',
          margin: '0 4px',
        }}
      />
      <Tooltip content="运行工作流">
        <Button
          size="small"
          type="primary"
          icon={<IconPlayCircle size="small" />}
          onClick={handleRun}
          style={{ fontSize: 12 }}
        >
          运行
        </Button>
      </Tooltip>
      <Tooltip content="设置">
        <Button
          size="small"
          theme="borderless"
          type="tertiary"
          icon={<IconSetting size="small" />}
          style={{ fontSize: 12, color: 'var(--g-fg-secondary, #666)' }}
        />
      </Tooltip>
    </div>
  );
}

export const Editor = ({ workflowId, onBack }: EditorProps) => {
  const editorProps = useEditorProps(initialData, nodeRegistries);

  const [toolboxVisible, setToolboxVisible] = useState(true);

  return (
    <div
      className="doc-free-feature-overview"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <FreeLayoutEditorProvider {...editorProps}>
        <DockedPanelLayer>
          <ToolboxContext.Provider
            value={{
              visible: toolboxVisible,
              toggle: () => setToolboxVisible((v) => !v),
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                position: 'relative',
              }}
            >
              <TopBar onBack={onBack} />
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  minWidth: 0,
                  position: 'relative',
                }}
              >
                {/* Left: Node Toolbox */}
                <NodeToolbox visible={toolboxVisible} />

                {/* Canvas Area */}
                <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                  <EditorRenderer className="demo-editor" />
                </div>
              </div>
            </div>
          </ToolboxContext.Provider>
        </DockedPanelLayer>
        {/* DemoTools outside DockedPanelLayer — positions relative to root */}
        <DemoTools />
      </FreeLayoutEditorProvider>
    </div>
  );
};
