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
import { BUILTIN_PLUGINS, getIcon, type PluginCategory } from './nodes-video/plugin-manifest';
import type { FlowDocumentJSON } from './typings';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';

const CAT_LABELS: Record<PluginCategory, string> = {
  source: '来源', effect: '效果', transition: '转场', output: '输出',
};

/* ───── Left sidebar: plugin palette ───── */
function Sidebar() {
  return (
    <div style={{
      width: 200, minWidth: 200, borderRight: '1px solid var(--semi-color-border, #e0e0e0)',
      display: 'flex', flexDirection: 'column', background: 'var(--semi-color-bg-1, #fff)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--semi-color-border, #eee)' }}>
        插件
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {(['source', 'effect', 'transition', 'output'] as PluginCategory[]).map(cat => {
          const items = BUILTIN_PLUGINS.filter(p => p.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '8px 16px 2px', textTransform: 'uppercase' }}>
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

function PluginItem({ plugin }: { plugin: typeof BUILTIN_PLUGINS[number] }) {
  const wf = useService(WorkflowDocument);
  return (
    <div
      onClick={() => {
        try {
          wf.addNode({ type: plugin.id, meta: { position: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 300 } }, data: { title: plugin.name, params: {} } });
          Toast.success(`已添加: ${plugin.name}`);
        } catch { Toast.error('添加失败'); }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 13, transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--semi-color-fill-0, #f5f5f5)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 16 }}>{getIcon(plugin)}</span>
      <span>{plugin.name}</span>
    </div>
  );
}

/* ───── Top toolbar ───── */
function Toolbar() {
  const doc = useService(WorkflowDocument);
  const tools = usePlaygroundTools();
  const [saving, setSaving] = useState(false);

  const handleLoad = useCallback(async () => {
    try { doc.fromJSON(await fetchDefaultWorkflow()); tools.fitView(false); Toast.success('已加载默认工作流'); }
    catch { Toast.error('加载失败'); }
  }, [doc, tools]);

  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      const engineJSON = toEngineJSON(doc.toJSON() as FlowDocumentJSON);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(engineJSON, null, 2)], { type: 'application/json' }));
      a.download = `workflow-${Date.now()}.json`;
      a.click();
      Toast.success('已导出');
    } finally { setSaving(false); }
  }, [doc]);

  const handleRun = useCallback(() => {
    localStorage.setItem('wf-to-run', JSON.stringify(toEngineJSON(doc.toJSON() as FlowDocumentJSON)));
    Toast.info('已保存，终端运行: npm run workflow');
  }, [doc]);

  return (
    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: 6, background: 'rgba(255,255,255,0.9)', padding: '6px 14px', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <Button size="small" onClick={handleLoad}>📂 默认</Button>
      <Button size="small" onClick={handleSave} loading={saving}>💾 导出</Button>
      <Button size="small" type="primary" onClick={handleRun}>▶ 运行</Button>
    </div>
  );
}

/* ───── App ───── */
export const Editor = () => {
  const editorProps = useEditorProps(initialData, nodeRegistries);
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <FreeLayoutEditorProvider {...editorProps}>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative' }}>
          <Toolbar />
          <DockedPanelLayer><div style={{ width: '100%', height: '100%' }}><EditorRenderer /></div></DockedPanelLayer>
        </div>
      </FreeLayoutEditorProvider>
    </div>
  );
};
