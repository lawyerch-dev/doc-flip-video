import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';
import { Field } from '@flowgram.ai/free-layout-editor';
import { Input, InputNumber, Select } from '@douyinfe/semi-ui';
import type { FlowNodeRegistry, FlowNodeJSON, FlowDocumentJSON, WorkflowEdgeJSON } from '../typings';
import { VideoNodeType } from './constants';
import { BUILTIN_PLUGINS, getPlugin, type PluginManifest, type ParamDef } from './plugin-manifest';

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

function buildFormMeta(manifest: PluginManifest) {
  const paramEntries = Object.entries(manifest.params);
  if (paramEntries.length === 0) {
    return { render: () => <div style={{ padding: 16, color: '#888' }}>此节点无参数</div> };
  }
  return {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const values = form.nodeData?.data?.params as Record<string, unknown> | undefined;
      return (
        <div style={{ padding: '8px 16px' }}>
          {paramEntries.map(([key, def]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                {def.label}
              </label>
              <Field
                name={`data.params.${key}`}
                render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                  renderParamField(def, value, onChange)
                }
              />
            </div>
          ))}
        </div>
      );
    },
  };
}

function buildPorts(manifest: PluginManifest) {
  const ports: { type: 'input' | 'output'; name: string }[] = [];
  for (const input of manifest.inputs) {
    ports.push({ type: 'input', name: input.name });
  }
  if (manifest.category !== 'output') {
    ports.push({ type: 'output', name: 'out' });
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

/** Engine format → Flowgram format */
export function fromEngineJSON(engine: EngineWorkflowJSON): FlowDocumentJSON {
  return {
    nodes: (engine.nodes ?? []).map((n) => {
      const manifest = getPlugin(n.type);
      return {
        id: n.id,
        type: n.type,
        meta: {
          position: {
            x: (n.position ?? [100, 100])[0],
            y: (n.position ?? [100, 100])[1],
          },
        },
        data: {
          title: manifest?.name ?? n.type,
          params: n.params,
        },
      };
    }),
    edges: buildEdges(engine.nodes ?? []),
  };
}

function buildEdges(nodes: EngineNodeJSON[]): WorkflowEdgeJSON[] {
  const edges: WorkflowEdgeJSON[] = [];
  for (const n of nodes) {
    for (const [portName, sourceId] of Object.entries(n.inputs ?? {})) {
      if (sourceId) {
        edges.push({
          id: `${sourceId}->${n.id}-${portName}`,
          source: sourceId,
          target: n.id,
          sourcePort: 'out',
          targetPort: portName,
        });
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
      const edgeInputs: Record<string, string> = {};
      for (const edge of doc.edges ?? []) {
        if (edge.target === n.id && edge.targetPort) {
          if (!edge.sourcePort || edge.sourcePort === 'out') {
            edgeInputs[edge.targetPort] = edge.source;
          }
        }
      }
      return {
        id: n.id,
        type: n.type,
        params: (n.data?.params as Record<string, unknown>) ?? {},
        inputs: edgeInputs,
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
