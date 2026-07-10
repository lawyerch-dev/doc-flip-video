import { useCallback, useState } from 'react';
import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  useService,
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
  const workflowDoc = useService(WorkflowDocument);
  const [saving, setSaving] = useState(false);

  const handleLoad = useCallback(async () => {
    try {
      const doc = await fetchDefaultWorkflow();
      workflowDoc.fromJSON(doc);
      Toast.success('已加载默认工作流');
    } catch {
      Toast.error('加载失败');
    }
  }, [workflowDoc]);

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
    Toast.info('工作流已保存，终端运行: npm run workflow');
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
