import { useCallback, useState } from 'react';
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  useService,
  usePlaygroundTools,
  WorkflowDocument,
} from '@flowgram.ai/free-layout-editor';
import { Button, Toast } from '@douyinfe/semi-ui';
import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries, fetchDefaultWorkflow, toEngineJSON } from './nodes';
import {
  BUILTIN_PLUGINS,
  getIcon,
  type PluginManifest,
  type PluginCategory,
} from './nodes-video/plugin-manifest';
import type { FlowDocumentJSON } from './typings';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';

// ─── Coze-style Colors ───
const CAT_COLORS: Record<PluginCategory, string> = {
  source: '#4ecdc4',
  effect: '#f9ca24',
  transition: '#6c5ce7',
  output: '#e94560',
};
const CAT_LABELS: Record<PluginCategory, string> = {
  source: '来源',
  effect: '效果',
  transition: '转场',
  output: '输出',
};

// ─── Left Sidebar ───
function Sidebar() {
  return (
    <div
      style={{
        width: 200,
        minWidth: 200,
        background: '#16162e',
        borderRight: '1px solid #2a2a4a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          fontWeight: 700,
          fontSize: 13,
          color: '#e0e0e0',
          borderBottom: '1px solid #2a2a4a',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>⚡</span>
        <span>插件</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#666', fontWeight: 400 }}>
          {BUILTIN_PLUGINS.length}
        </span>
      </div>

      {/* Plugin list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {(['source', 'effect', 'transition', 'output'] as PluginCategory[]).map(cat => {
          const items = BUILTIN_PLUGINS.filter(p => p.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 2 }}>
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {CAT_LABELS[cat]}
              </div>
              {items.map(p => (
                <PluginItem key={p.id} plugin={p} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PluginItem({ plugin }: { plugin: PluginManifest }) {
  const workflowDoc = useService(WorkflowDocument);
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    try {
      workflowDoc.addNode({
        type: plugin.id,
        meta: {
          position: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 300 },
        },
        data: { title: plugin.name, params: {} },
      });
      Toast.success(`已添加: ${plugin.name}`);
    } catch {
      Toast.error('添加失败');
    }
  }, [workflowDoc, plugin]);

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        background: hovered ? 'rgba(77, 83, 232, 0.1)' : 'transparent',
        borderLeft: `3px solid ${hovered ? CAT_COLORS[plugin.category] : 'transparent'}`,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{getIcon(plugin)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e0e0e0', fontWeight: 500, fontSize: 13 }}>{plugin.name}</div>
        <div
          style={{
            color: '#666',
            fontSize: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {plugin.description}
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar ───
function Toolbar() {
  const workflowDoc = useService(WorkflowDocument);
  const tools = usePlaygroundTools();
  const [saving, setSaving] = useState(false);

  const handleLoad = useCallback(async () => {
    try {
      const doc = await fetchDefaultWorkflow();
      workflowDoc.fromJSON(doc);
      tools.fitView(false);
      Toast.success('已加载默认工作流');
    } catch {
      Toast.error('加载失败');
    }
  }, [workflowDoc, tools]);

  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      const doc = workflowDoc.toJSON() as FlowDocumentJSON;
      const engineJSON = toEngineJSON(doc);
      const blob = new Blob([JSON.stringify(engineJSON, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('已导出');
    } finally {
      setSaving(false);
    }
  }, [workflowDoc]);

  const handleRun = useCallback(() => {
    const doc = workflowDoc.toJSON() as FlowDocumentJSON;
    const engineJSON = toEngineJSON(doc);
    localStorage.setItem('wf-to-run', JSON.stringify(engineJSON));
    Toast.info('已保存，终端运行: npm run workflow');
  }, [workflowDoc]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        gap: 6,
        background: 'rgba(30, 30, 60, 0.85)',
        padding: '6px 16px',
        borderRadius: 10,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <Button size="small" onClick={handleLoad}>
        📂 默认
      </Button>
      <Button size="small" onClick={handleSave} loading={saving}>
        💾 导出
      </Button>
      <Button size="small" type="primary" onClick={handleRun}>
        ▶ 运行
      </Button>
    </div>
  );
}

// ─── Main Layout ───
export const Editor = () => {
  const editorProps = useEditorProps(initialData, nodeRegistries);
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <FreeLayoutEditorProvider {...editorProps}>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative' }}>
          <Toolbar />
          <DockedPanelLayer>
            <div style={{ width: '100%', height: '100%' }}>
              <EditorRenderer />
            </div>
          </DockedPanelLayer>
        </div>
      </FreeLayoutEditorProvider>
    </div>
  );
};
