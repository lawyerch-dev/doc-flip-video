/**
 * Coze-style workflow list page
 */
import { useState, useCallback } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconChevronRight } from '@douyinfe/semi-icons';

export interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  updatedAt: string;
}

interface Props {
  onEdit: (id: string) => void;
}

const STORAGE_KEY = 'doc-flip-workflows';

function loadWorkflows(): WorkflowItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWorkflows(list: WorkflowItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function WorkflowList({ onEdit }: Props) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(() => loadWorkflows());

  const handleCreate = useCallback(() => {
    const id = `wf-${Date.now()}`;
    const now = new Date().toISOString();
    const newWf: WorkflowItem = {
      id,
      name: `新建工作流 ${workflows.length + 1}`,
      description: '',
      nodeCount: 0,
      updatedAt: now,
    };
    const next = [...workflows, newWf];
    setWorkflows(next);
    saveWorkflows(next);
    Toast.success({ content: '工作流已创建', top: 80, duration: 2 });
    onEdit(id);
  }, [workflows, onEdit]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const next = workflows.filter((w) => w.id !== id);
      setWorkflows(next);
      saveWorkflows(next);
      Toast.success({ content: '已删除', top: 80, duration: 2 });
    },
    [workflows],
  );

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--g-bg-canvas, #f5f5f7)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: '#fff',
          borderBottom: '1px solid var(--g-stroke-default, #e5e6eb)',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--g-fg-primary, #0f1529d1)', margin: 0 }}>
          工作流
        </h1>
        <Button
          type="primary"
          icon={<IconPlus size="small" />}
          onClick={handleCreate}
          style={{ fontSize: 13 }}
        >
          新建工作流
        </Button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {workflows.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              color: 'var(--g-fg-dim, #8c8f99)',
              fontSize: 14,
              gap: 16,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>还没有工作流，点击上方按钮创建</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
            {workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => onEdit(wf.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: '#fff',
                  border: '1px solid var(--g-stroke-default, #e5e6eb)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = 'var(--g-stroke-hglt, #4e40e5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--g-stroke-default, #e5e6eb)';
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    background: 'var(--g-bg-hover, rgba(78, 64, 229, 0.06))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--g-stroke-hglt, #4e40e5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--g-fg-primary, #0f1529d1)' }}>
                    {wf.name}
                  </div>
                  {wf.description && (
                    <div style={{ fontSize: 12, color: 'var(--g-fg-secondary, #666)', marginTop: 2 }}>
                      {wf.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--g-fg-dim, #8c8f99)', marginTop: 2 }}>
                    {wf.nodeCount} 个节点 · {new Date(wf.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                {/* Actions */}
                <Button
                  size="small"
                  theme="borderless"
                  type="tertiary"
                  icon={<IconDelete size="small" />}
                  onClick={(e) => handleDelete(e, wf.id)}
                  style={{ color: '#e94560', opacity: 0.6 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                />
                <IconChevronRight size="small" style={{ color: 'var(--g-fg-dim, #8c8f99)' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
