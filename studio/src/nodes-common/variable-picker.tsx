/**
 * Simple variable picker — shows upstream node variables for insertion
 * 
 * Usage: wrap any string/textarea setter with <VariablePicker> 
 * to add a "↗" button that inserts {{variableRef}} into the field.
 */
import { useMemo, useState, useCallback } from 'react';
import { useClientContext } from '@flowgram.ai/free-layout-editor';
import { Popover } from '@douyinfe/semi-ui';


interface Props {
  nodeId: string;
  value?: string;
  onChange?: (v: string) => void;
  children: React.ReactNode;
}

interface VariableOption {
  label: string;
  value: string; // The {{path}} to insert
  nodeName: string;
}

export function VariablePicker({ nodeId, value, onChange, children }: Props) {
  const [visible, setVisible] = useState(false);
  const { document } = useClientContext();

  // Collect upstream nodes and their outputs
  const variables = useMemo<VariableOption[]>(() => {
    try {
      const allNodes = document.getAllNodes();
      const currentNode = document.getNode(nodeId);
      if (!currentNode) return [];

      // Get upstream nodes (nodes that connect TO this node)
      const upstreamIds = new Set<string>();
      for (const edge of (document.toJSON() as any)?.edges ?? []) {
        if (edge.target === nodeId) upstreamIds.add(edge.source);
      }

      const options: VariableOption[] = [];

      for (const node of allNodes) {
        if (!upstreamIds.has(node.id)) continue;
        const type = node.flowNodeType as string;
        const displayName = type.split(':').pop() ?? type;

        // Add node's params as available variables
        const params = (node.form?.values as any)?.data?.params ?? {};
        for (const [key] of Object.entries(params)) {
          if (key === 'inputs' || key === 'outputs') continue;
          options.push({
            label: `${displayName}.${key}`,
            value: `{{${node.id}.${key}}}`,
            nodeName: displayName,
          });
        }

        // Add declared outputs for common nodes
        const reg = node.getNodeRegistry() as any;
        const description = reg?.info?.description;
        if (description) {
          options.push({
            label: `${displayName} (${description})`,
            value: `{{${node.id}.output}}`,
            nodeName: displayName,
          });
        }
      }
      return options;
    } catch { return []; }
  }, [document, nodeId]);

  const handleInsert = useCallback((varValue: string) => {
    const currentVal = value ?? '';
    // Insert at cursor or append
    const newVal = currentVal + varValue;
    onChange?.(newVal);
    setVisible(false);
  }, [value, onChange]);

  if (variables.length === 0) return <>{children}</>;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>{children}</div>
      <Popover
        trigger="click"
        visible={visible}
        onVisibleChange={setVisible}
        content={
          <div style={{ width: 220, maxHeight: 300, overflow: 'auto', padding: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#666', padding: '4px 8px', marginBottom: 4 }}>
              引用上游变量
            </div>
            {variables.map((v, i) => (
              <div
                key={i}
                onClick={() => handleInsert(v.value)}
                style={{
                  padding: '6px 8px', cursor: 'pointer', borderRadius: 4,
                  fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{
                  fontSize: 10, padding: '1px 4px', borderRadius: 3,
                  background: '#4e40e522', color: '#4e40e5',
                }}>
                  {v.nodeName}
                </span>
                <span style={{ color: '#333' }}>{v.label}</span>
              </div>
            ))}
          </div>
        }
        position="top"
      >
        <button
          onClick={() => setVisible(!visible)}
          style={{
            padding: '4px 6px', border: '1px solid var(--g-stroke-default)',
            borderRadius: 4, background: 'var(--g-bg-secondary)',
            cursor: 'pointer', fontSize: 12, lineHeight: 1,
            marginTop: 1, whiteSpace: 'nowrap',
          }}
          title="引用变量"
        >
          ↗
        </button>
      </Popover>
    </div>
  );
}
