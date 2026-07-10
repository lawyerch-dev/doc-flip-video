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
import { BUILTIN_PLUGINS, getIcon, type PluginManifest, type PluginCategory } from './nodes-video/plugin-manifest';
import type { FlowDocumentJSON } from './typings';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';

// ─── Left Sidebar Palette ───

const CAT_LABELS: Record<PluginCategory, string> = {
  source: '来源',
  effect: '效果',
  transition: '转场',
  output: '输出',
};

function Sidebar() {
  return (
    <div style={{
      width: 200, minWidth: 200, background: '#f5f5f7',
      borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontSize: 13,
    }}>
      <div style={{
        padding: '12px 14px', fontWeight: 700, fontSize: 14, color: '#333',
        borderBottom: '1px solid #e0e0e0', background: '#fff',
      }}>
        📦 插件
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {(['source', 'effect', 'transition', 'output'] as PluginCategory[]).map(cat => {
          const items = BUILTIN_PLUGINS.filter(p => p.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 4 }}>
              <div style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#999',
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {CAT_LABELS[cat]}
              </div>
              {items.map(p => <PluginItem key={p.id} plugin={p} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PluginItem({ plugin }: { plugin: PluginManifest }) {
  const workflowDoc = useService(WorkflowDocument);

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
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 14px', cursor: 'pointer', transition: 'background 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#e8e8eb')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 16 }}>{getIcon(plugin)}</span>
      <span style={{ color: '#333', fontWeight: 500, fontSize: 13 }}>{plugin.name}</span>
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
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, display: 'flex', gap: 8, background: 'rgba(30,30,60,0.85)',
      padding: '6px 16px', borderRadius: 10, backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <Button size="small" onClick={handleLoad}>📂 加载默认</Button>
      <Button size="small" onClick={handleSave} loading={saving}>💾 导出</Button>
      <Button size="small" type="primary" onClick={handleRun}>▶ 运行</Button>
    </div>
  );
}

// ─── Editor Layout ───

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
