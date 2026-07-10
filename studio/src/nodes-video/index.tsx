import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';
import { Field } from '@flowgram.ai/free-layout-editor';
import { Input, InputNumber, Select } from '@douyinfe/semi-ui';
import type { FlowNodeRegistry, FlowNodeJSON, FlowDocumentJSON, WorkflowEdgeJSON } from '../typings';
import { useIsSidebar } from '../hooks';
import { BUILTIN_PLUGINS, getPlugin, getIcon, type PluginManifest, type ParamDef } from './plugin-manifest';

// ─── Build form meta from param schema ───

function renderParamField(def: ParamDef, value: unknown, onChange: (v: unknown) => void) {
  if (def.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>启用</span>
      </label>
    );
  }
  if (def.type === 'select') {
    return (
      <Select value={value as string} onChange={(v: string) => onChange(v)} style={{ width: '100%' }}>
        {(def.options ?? []).map((o: string) => (
          <Select.Option key={o} value={o}>{o}</Select.Option>
        ))}
      </Select>
    );
  }
  if (def.type === 'number') {
    return (
      <InputNumber
        value={value as number}
        onChange={(v: number) => onChange(v)}
        min={def.min}
        max={def.max}
        step={def.step ?? 0.1}
        style={{ width: '100%' }}
      />
    );
  }
  return <Input value={value as string} onChange={(v: string) => onChange(v)} />;
}

/** Node face: icon + name + param summary */
function renderNodeFace(manifest: PluginManifest, values: Record<string, unknown>) {
  const icon = getIcon(manifest);
  const paramLines = Object.entries(manifest.params).slice(0, 3);
  return (
    <div style={{ padding: '8px 12px', minWidth: 160, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{manifest.name}</span>
      </div>
      {paramLines.length > 0 && (
        <div>
          {paramLines.map(([key, def]) => {
            const val = values[key] ?? def.default;
            const display = String(val).length > 20 ? String(val).slice(0, 18) + '…' : String(val);
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: '20px', opacity: 0.7 }}>
                <span>{def.label}:</span>
                <span style={{ fontWeight: 500 }}>{display}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderSidebarForm(manifest: PluginManifest) {
  const paramEntries = Object.entries(manifest.params);
  if (paramEntries.length === 0) {
    return <div style={{ padding: 16, color: '#666', fontSize: 13 }}>此节点无参数</div>;
  }
  return (
    <div style={{ padding: '8px 16px' }}>
      {paramEntries.map(([key, def]) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {def.label}
          </label>
          <Field
            name={`data.params.${key}`}
            render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
              renderParamField(def, value, onChange)
            }
          />
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
            {def.type}{def.default !== undefined ? `, 默认: ${def.default}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildFormMeta(manifest: PluginManifest) {
  return {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const values = (form.nodeData?.data?.params ?? {}) as Record<string, unknown>;
      if (isSidebar) {
        return renderSidebarForm(manifest);
      }
      return renderNodeFace(manifest, values);
    },
  };
}

function buildPorts(manifest: PluginManifest) {
  const ports: { type: 'input' | 'output' }[] = [];
  // All input types use a generic 'input' port
  // Flowgram's port system uses slot index, not port name
  for (let i = 0; i < manifest.inputs.length; i++) {
    ports.push({ type: 'input' });
  }
  if (manifest.category !== 'output') {
    ports.push({ type: 'output' });
  }
  return ports;
}

// ─── Build registries ───

function buildRegistry(manifest: PluginManifest): FlowNodeRegistry {
  const ports = buildPorts(manifest);
  return {
    type: manifest.id,
    info: { description: manifest.description },
    meta: {
      defaultPorts: ports,
      size: { width: 200, height: 60 + ports.length * 24 },
    },
    formMeta: buildFormMeta(manifest),
  };
}

/** 参数定义：{ name, type, defaultValue } */
interface ParamItem {
  name: string;
  type: 'string' | 'number' | 'boolean';
  default: string;
}

/** 参数编辑器：增删 + JSON 导入 */
function ParamEditor({
  value, onChange,
}: {
  value: ParamItem[];
  onChange: (v: ParamItem[]) => void;
}) {
  const items = Array.isArray(value) ? value : [];

  const addItem = () => {
    onChange([...items, { name: '', type: 'string', default: '' }]);
  };

  const updateItem = (i: number, patch: Partial<ParamItem>) => {
    const next = items.map((item, idx) => idx === i ? { ...item, ...patch } : item);
    onChange(next);
  };

  const removeItem = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  const importJSON = () => {
    const raw = prompt('粘贴 JSON Schema（或 JSON 对象）:');
    if (!raw) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      alert('JSON 格式错误');
      return;
    }
    // Try to parse as JSON Schema properties first
    if (parsed.properties && typeof parsed.properties === 'object') {
      const props = parsed.properties as Record<string, { type?: string; default?: unknown }>;
      const imported: ParamItem[] = Object.entries(props).map(([name, schema]) => ({
        name,
        type: (['string', 'number', 'boolean'].includes(schema.type ?? '') ? schema.type! : 'string') as ParamItem['type'],
        default: schema.default !== undefined ? String(schema.default) : '',
      }));
      onChange(imported);
    } else {
      // Plain object: each key becomes a param
      const imported: ParamItem[] = Object.entries(parsed).map(([k, v]) => ({
        name: k,
        type: v === null || v === undefined ? 'string'
          : typeof v === 'number' ? 'number'
          : typeof v === 'boolean' ? 'boolean'
          : 'string',
        default: v !== null && v !== undefined ? String(v) : '',
      }));
      onChange(imported);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={addItem} style={btnStyle}>+ 添加参数</button>
        <button onClick={importJSON} style={btnStyle}>📥 导入 JSON</button>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: '#999', padding: 8 }}>暂无参数，点击「添加参数」或「导入 JSON」</div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
          <input
            value={item.name}
            onChange={e => updateItem(i, { name: e.target.value })}
            placeholder="参数名"
            style={{ ...inputStyle, width: 110 }}
          />
          <select
            value={item.type}
            onChange={e => updateItem(i, { type: e.target.value as ParamItem['type'] })}
            style={{ ...inputStyle, width: 80 }}
          >
            <option value="string">文本</option>
            <option value="number">数字</option>
            <option value="boolean">布尔</option>
          </select>
          <input
            value={item.default}
            onChange={e => updateItem(i, { default: e.target.value })}
            placeholder="默认值"
            style={{ ...inputStyle, width: 100 }}
          />
          <button onClick={() => removeItem(i)} style={{ ...btnStyle, color: '#e00', padding: '2px 6px' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #d0d0d0', borderRadius: 4, fontSize: 12,
};
const btnStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid #d0d0d0', borderRadius: 4,
  background: '#f5f5f5', cursor: 'pointer', fontSize: 12,
};

/** Start 节点：定义工作流输入参数 */
const startRegistry: FlowNodeRegistry = {
  type: 'system:start',
  info: { description: '定义工作流的输入参数' },
  meta: {
    defaultPorts: [{ type: 'output' }],
    size: { width: 200, height: 52 },
    deleteDisable: true,
    copyDisable: true,
  },
  formMeta: {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const data = form.nodeData?.data;
      const params = (data?.params ?? {}) as Record<string, unknown>;
      const inputs = params.inputs as ParamItem[] | undefined;

      if (isSidebar) {
        return (
          <div style={{ padding: '8px 16px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>工作流名称</label>
              <Field
                name="data.params.workflowName"
                render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                  <input type="text" value={value as string ?? '新工作流'}
                    onChange={e => onChange(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #d0d0d0', borderRadius: 4, fontSize: 13 }} />
                }
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>输入参数</label>
              <Field
                name="data.params.inputs"
                render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                  <ParamEditor value={value as ParamItem[]} onChange={onChange} />
                }
              />
            </div>
          </div>
        );
      }

      // Canvas face
      const paramCount = Array.isArray(inputs) ? inputs.length : 0;
      return (
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎬</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>开始</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              {(params.workflowName as string) || '工作流'}{paramCount > 0 ? ` · ${paramCount}个参数` : ''}
            </div>
          </div>
        </div>
      );
    },
  },
};

/** End 节点：定义工作流输出参数 */
const endRegistry: FlowNodeRegistry = {
  type: 'system:end',
  info: { description: '定义工作流的输出参数' },
  meta: {
    defaultPorts: [{ type: 'input' }],
    size: { width: 200, height: 52 },
    deleteDisable: true,
    copyDisable: true,
  },
  formMeta: {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const params = (form.nodeData?.data?.params ?? {}) as Record<string, unknown>;
      const outputs = params.outputs as ParamItem[] | undefined;

      if (isSidebar) {
        return (
          <div style={{ padding: '8px 16px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>输出参数</label>
              <Field
                name="data.params.outputs"
                render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                  <ParamEditor value={value as ParamItem[]} onChange={onChange} />
                }
              />
            </div>
          </div>
        );
      }

      const paramCount = Array.isArray(outputs) ? outputs.length : 0;
      return (
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🏁</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>结束</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              {paramCount > 0 ? `${paramCount}个输出参数` : '点击配置输出'}
            </div>
          </div>
        </div>
      );
    },
  },
};

export const nodeRegistries: FlowNodeRegistry[] = [
  startRegistry,
  endRegistry,
  ...BUILTIN_PLUGINS.map(buildRegistry),
];

// ─── Workflow JSON converter ───

export interface EngineWorkflowJSON {
  version: number;
  name: string;
  variables: Record<string, unknown>;
  nodes: EngineNodeJSON[];
}

export interface EngineNodeJSON {
  id: string;
  type: string;
  params: Record<string, unknown>;
  inputs: Record<string, string>;
  position?: [number, number];
}

/** 判断节点是否属于视频主链路 */
function isMainChain(type: string): boolean {
  const main = [
    'source:page-renderer', 'effect:fade-in', 'effect:fade-out',
    'effect:hold', 'effect:sweep-glow', 'transition:page-curl',
    'transition:crossfade', 'output:mp4',
  ];
  return main.includes(type);
}

/** 拓扑排序：按输入依赖排序 */
function topoSort(nodes: EngineNodeJSON[]): string[] {
  const map = new Map<string, EngineNodeJSON>();
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  
  for (const n of nodes) {
    map.set(n.id, n);
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const n of nodes) {
    for (const srcId of Object.values(n.inputs ?? {})) {
      adj.get(srcId)?.push(n.id);
      inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
    }
  }
  
  const q: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) q.push(id);
  }
  
  const result: string[] = [];
  let head = 0;
  while (head < q.length) {
    const id = q[head++];
    result.push(id);
    for (const next of adj.get(id) ?? []) {
      inDeg.set(next, (inDeg.get(next) ?? 1) - 1);
      if (inDeg.get(next) === 0) q.push(next);
    }
  }
  return result;
}

/** 自动布局：Start → 主链路 → End 从左到右 */
function autoLayout(
  nodes: EngineNodeJSON[],
  ordered: string[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  
  // Start 在最左
  positions['__start__'] = { x: 20, y: 300 };
  
  // 主链路节点从左到右
  const chainOrder = ordered.filter(id => {
    const n = nodes.find(x => x.id === id);
    return n && isMainChain(n.type);
  });
  
  const X_STEP = 280;
  chainOrder.forEach((id, i) => {
    positions[id] = { x: 120 + i * X_STEP, y: 300 };
  });
  
  // 辅助节点（音频、光晕条）在下方
  const sideNodes = ordered.filter(id => {
    const n = nodes.find(x => x.id === id);
    return n && !isMainChain(n.type);
  });
  sideNodes.forEach((id, i) => {
    positions[id] = { x: 120, y: 520 + i * 160 };
  });
  
  // End 在最右
  const lastX = chainOrder.length > 0 ? 120 + chainOrder.length * X_STEP : 120;
  positions['__end__'] = { x: lastX, y: 300 };
  
  return positions;
}

/** Engine format → Flowgram format */
export function fromEngineJSON(engine: EngineWorkflowJSON): FlowDocumentJSON {
  const engineNodes = engine.nodes ?? [];
  const ordered = topoSort(engineNodes);
  const layout = autoLayout(engineNodes, ordered);
  
  // 注入 Start/End（如果不存在）
  const hasStart = engineNodes.some(n => n.id === '__start__');
  const hasEnd = engineNodes.some(n => n.id === '__end__');
  
  const startNode = hasStart ? null : {
    id: '__start__',
    type: 'system:start',
    meta: { position: { x: layout['__start__'].x, y: layout['__start__'].y } },
    data: { title: '开始', params: {} },
  };
  const endNode = hasEnd ? null : {
    id: '__end__',
    type: 'system:end',
    meta: { position: { x: layout['__end__'].x, y: layout['__end__'].y } },
    data: { title: '结束', params: {} },
  };
  
  // 主链路节点
  const mainNodes = engineNodes.filter(n => isMainChain(n.type));
  const sideNodes = engineNodes.filter(n => !isMainChain(n.type));
  
  // 构建时间轴连线
  const edges: WorkflowEdgeJSON[] = [];
  
  // Start → 第一个主节点
  if (mainNodes.length > 0) {
    edges.push({ id: 'start_to_0', source: '__start__', target: mainNodes[0].id, sourcePort: '0', targetPort: '0' });
  }
  
  // 主节点之间依次连线
  for (let i = 0; i < mainNodes.length - 1; i++) {
    edges.push({
      id: `${mainNodes[i].id}->${mainNodes[i+1].id}`,
      source: mainNodes[i].id,
      target: mainNodes[i+1].id,
      sourcePort: '0',
      targetPort: '0',
    });
  }
  
  // 最后一个主节点 → End
  if (mainNodes.length > 0) {
    edges.push({ id: 'last_to_end', source: mainNodes[mainNodes.length - 1].id, target: '__end__', sourcePort: '0', targetPort: '0' });
  }
  
  // 辅助节点连线（音频、光晕条等连接到主链路）
  for (const node of engineNodes) {
    for (const [_portName, srcId] of Object.entries(node.inputs ?? {})) {
      if (!srcId) continue;
      // 检查是否已经被主链路过
      const alreadyInMain = mainNodes.some((m, i) => 
        (i < mainNodes.length - 1 && m.id === srcId && mainNodes[i + 1].id === node.id) ||
        (i > 0 && m.id === node.id && mainNodes[i - 1].id === srcId)
      );
      if (!alreadyInMain) {
        edges.push({
          id: `${srcId}->${node.id}-side`,
          source: srcId,
          target: node.id,
          sourcePort: '0',
          targetPort: '0',
        });
      }
    }
  }
  
  // 构建节点列表（包含 Start/End）
  const injected: FlowNodeJSON[] = [];
  if (startNode) injected.push(startNode);
  for (const n of engineNodes) {
    if (n.id === '__start__' || n.id === '__end__') continue;
    const manifest = getPlugin(n.type);
    const pos = layout[n.id] ?? { x: 100, y: 100 };
    injected.push({
      id: n.id,
      type: n.type,
      meta: { position: { x: pos.x, y: pos.y } },
      data: { title: manifest?.name ?? n.type, params: n.params },
    });
  }
  if (endNode) injected.push(endNode);
  
  return { nodes, edges };
}

function buildEdges(nodes: EngineNodeJSON[]): WorkflowEdgeJSON[] {
  const edges: WorkflowEdgeJSON[] = [];
  // Track how many inputs each target has consumed (for port index)
  const inputCount: Record<string, number> = {};
  for (const n of nodes) {
    let inputIdx = 0;
    for (const [_portName, sourceId] of Object.entries(n.inputs ?? {})) {
      if (sourceId) {
        edges.push({
          id: `${sourceId}->${n.id}-${inputIdx}`,
          source: sourceId,
          target: n.id,
          sourcePort: '0',  // output port index
          targetPort: String(inputIdx),  // input port index
        });
        inputIdx++;
      }
    }
  }
  return edges;
}

/** Flowgram format → Engine format */
export function toEngineJSON(doc: FlowDocumentJSON): EngineWorkflowJSON {
  return {
    version: 1,
    name: '未命名工作流',
    variables: { width: 1080, height: 1840, fps: 30 },
    nodes: (doc.nodes ?? []).map((n) => {
      const nodeInputs: Record<string, string> = {};
      const portNames = (BUILTIN_PLUGINS.find(p => p.id === n.type)?.inputs ?? []).map(p => p.name);
      for (const edge of doc.edges ?? []) {
        if (edge.target === n.id && edge.targetPort) {
          const idx = parseInt(edge.targetPort, 10);
          if (!isNaN(idx) && idx < portNames.length) {
            nodeInputs[portNames[idx]] = edge.source;
          }
        }
      }
      return {
        id: n.id,
        type: n.type,
        params: (n.data?.params as Record<string, unknown>) ?? {},
        inputs: nodeInputs,
        position: n.meta?.position ? [n.meta.position.x, n.meta.position.y] : [100, 100],
      };
    }),
  };
}

/** Fetch default workflow from backend */
export async function fetchDefaultWorkflow(): Promise<FlowDocumentJSON> {
  try {
    const resp = await fetch('/workflows/article-default.json');
    if (resp.ok) {
      const engineJSON = await resp.json() as EngineWorkflowJSON;
      return fromEngineJSON(engineJSON);
    }
  } catch {
    // fall through
  }
  return { nodes: [], edges: [] };
}
