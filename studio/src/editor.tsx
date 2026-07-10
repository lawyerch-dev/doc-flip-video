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
import type { FlowDocumentJSON } from './typings';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';

function Toolbar() {
  const doc = useService(WorkflowDocument);
  const tools = usePlaygroundTools();
  const [saving, setSaving] = useState(false);

  const handleLoad = useCallback(async () => {
    try {
      doc.fromJSON(await fetchDefaultWorkflow());
      tools.fitView(false);
      Toast.success('已加载');
    } catch { Toast.error('加载失败'); }
  }, [doc, tools]);

  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      const wf = toEngineJSON(doc.toJSON() as FlowDocumentJSON);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' }));
      a.download = `workflow-${Date.now()}.json`;
      a.click();
      Toast.success('已导出');
    } finally { setSaving(false); }
  }, [doc]);

  const handleRun = useCallback(() => {
    localStorage.setItem('wf-to-run', JSON.stringify(toEngineJSON(doc.toJSON() as FlowDocumentJSON)));
    Toast.info('终端运行: npm run workflow');
  }, [doc]);

  return (
    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: 6, background: 'rgba(255,255,255,0.9)', padding: '6px 14px', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <Button size="small" onClick={handleLoad}>📂 加载默认</Button>
      <Button size="small" onClick={handleSave} loading={saving}>💾 导出</Button>
      <Button size="small" type="primary" onClick={handleRun}>▶ 运行</Button>
    </div>
  );
}

export const Editor = () => {
  const editorProps = useEditorProps(initialData, nodeRegistries);
  return (
    <div className="doc-free-feature-overview">
      <FreeLayoutEditorProvider {...editorProps}>
        <DockedPanelLayer>
          <div className="demo-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Toolbar />
            <EditorRenderer className="demo-editor" />
          </div>
        </DockedPanelLayer>
      </FreeLayoutEditorProvider>
    </div>
  );
};
