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

function renderNodeFace(manifest: PluginManifest, values: Record<string, unknown>) {
  const icon = getIcon(manifest);
  const color = manifest.color;
  const paramLines = Object.entries(manifest.params).slice(0, 3);
  return (
    <div style={{
      padding: '8px 12px', minWidth: 160, fontSize: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, color: '#1e1e2e', fontSize: 13 }}>{manifest.name}</span>
      </div>
      {paramLines.length > 0 && (
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 4, marginTop: 2 }}>
          {paramLines.map(([key, def]) => {
            const val = values[key] ?? def.default;
            const display = String(val).length > 20 ? String(val).slice(0, 18) + '…' : String(val);
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: 11, lineHeight: '20px' }}>
                <span>{def.label}:</span>
                <span style={{ color: '#333', fontWeight: 500 }}>{display}</span>
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
    return <div style={{ padding: 16, color: '#888', fontSize: 13 }}>此节点无参数</div>;
  }
  return (
    <div style={{ padding: '8px 16px' }}>
      {paramEntries.map(([key, def]) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
            {def.label}
          </label>
          <Field
            name={`data.params.${key}`}
            render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
              renderParamField(def, value, onChange)
            }
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
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

export const nodeRegistries: FlowNodeRegistry[] = BUILTIN_PLUGINS.map(buildRegistry);

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

/** BFS 自动布局：按输入链从左到右分层 */
function autoLayout(nodes: EngineNodeJSON[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // 拓扑关系
  const adj: Record<string, string[]> = {};
  const depth: Record<string, number> = {};
  for (const n of nodes) adj[n.id] = [];

  for (const n of nodes) {
    for (const srcId of Object.values(n.inputs ?? {})) {
      if (adj[srcId]) adj[srcId].push(n.id);
    }
  }

  // BFS 算深度
  const queue: string[] = [];
  for (const n of nodes) {
    if (Object.keys(n.inputs ?? {}).length === 0) {
      depth[n.id] = 0;
      queue.push(n.id);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const d = (depth[id] ?? 0) + 1;
    for (const next of adj[id] ?? []) {
      if (!(next in depth) || depth[next] < d) depth[next] = d;
      if (!queue.includes(next)) queue.push(next);
    }
  }

  // 按深度分组
  const layers: Record<number, string[]> = {};
  for (const n of nodes) {
    const d = depth[n.id] ?? 0;
    if (!layers[d]) layers[d] = [];
    layers[d].push(n.id);
  }

  // 分配坐标
  const X_STEP = 280;
  const Y_STEP = 160;
  const Y_START = 80;

  for (const [dStr, ids] of Object.entries(layers)) {
    const d = Number(dStr);
    const x = 50 + d * X_STEP;
    const totalH = ids.length * Y_STEP;
    const yStart = Y_START - totalH / 2 + Y_STEP / 2;
    ids.forEach((id, i) => {
      positions[id] = { x, y: yStart + i * Y_STEP };
    });
  }

  return positions;
}

/** Engine format → Flowgram format */
export function fromEngineJSON(engine: EngineWorkflowJSON): FlowDocumentJSON {
  const engineNodes = engine.nodes ?? [];
  const layout = autoLayout(engineNodes);

  return {
    nodes: engineNodes.map((n) => {
      const manifest = getPlugin(n.type);
      const pos = layout[n.id] ?? { x: 100, y: 100 };
      return {
        id: n.id,
        type: n.type,
        meta: { position: { x: pos.x, y: pos.y } },
        data: {
          title: manifest?.name ?? n.type,
          params: n.params,
        },
      };
    }),
    edges: buildEdges(engineNodes),
  };
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
