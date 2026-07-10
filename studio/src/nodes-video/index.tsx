import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';
import { Field, ValidateTrigger } from '@flowgram.ai/free-layout-editor';
import { Input, InputNumber, Select, Switch } from '@douyinfe/semi-ui';
import type { FlowNodeRegistry, FlowNodeJSON, FlowDocumentJSON } from '../typings';
import { useIsSidebar } from '../hooks';
import { CozeFieldLayout } from '../form-components/field-layout';
import { CozeSection } from '../form-components/section';
import { BUILTIN_PLUGINS, getPlugin, type PluginManifest, type ParamDef } from './plugin-manifest';
import { getPluginIcon } from './icons';

// ─── Build form meta from param schema ───

function renderParamField(def: ParamDef, value: unknown, onChange: (v: unknown) => void) {
  if (def.type === 'boolean') {
    return (
      <Switch
        checked={value === true}
        onChange={(v: boolean) => onChange(v)}
        size="small"
      />
    );
  }
  if (def.type === 'select') {
    return (
      <Select value={value as string} onChange={(v: any) => onChange(v)} style={{ width: '100%' }}>
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
        onChange={(v: string | number) => onChange(v)}
        min={def.min}
        max={def.max}
        step={def.step ?? 0.1}
        style={{ width: '100%' }}
      />
    );
  }
  return <Input value={value as string} onChange={(v: string) => onChange(v)} />;
}

/** Color-coded header for node face */


/** Coze-style compact header for node faces (start/end/video nodes) */
function NodeHeader({ icon, name, color }: { icon: React.ReactNode; name: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(6,7,9,0.06)',
    }}>
      <div style={{
        position: 'relative',
        width: 20, height: 20, flexShrink: 0,
      }}>
        <div style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4, background: color + '20',
        }}>
          {icon}
        </div>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 4,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
          pointerEvents: 'none',
        }} />
      </div>
      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--g-fg-primary)' }}>{name}</span>
    </div>
  );
}

/** Coze-style node face: compact icon+name header + param chips */
function renderNodeFace(manifest: PluginManifest, values: Record<string, unknown>) {
  const IconComponent = getPluginIcon(manifest.id);
  const paramLines = Object.entries(manifest.params).slice(0, 4);
  return (
    <div style={{ fontSize: 12, width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        borderBottom: '1px solid rgba(6,7,9,0.06)',
      }}>
        <div style={{
          position: 'relative',
          width: 20, height: 20, flexShrink: 0,
        }}>
          <div style={{
            width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4, background: manifest.color + '20',
          }}>
            {IconComponent ? <IconComponent size={13} color={manifest.color} /> : <span style={{ fontSize: 11 }}>●</span>}
          </div>
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: 4,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
            pointerEvents: 'none',
          }} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--g-fg-primary)' }}>{manifest.name}</span>
      </div>
      {paramLines.length > 0 && (
        <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {paramLines.map(([key, def]) => {
            const val = values[key] ?? def.default;
            const display = String(val).length > 15 ? String(val).slice(0, 13) + '…' : String(val);
            return (
              <span key={key} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px',
                background: manifest.color + '0d',
                borderRadius: 4,
                fontSize: 10,
                color: manifest.color,
                lineHeight: '18px',
              }}>
                <span style={{ opacity: 0.7 }}>{def.label}</span>
                <span style={{ fontWeight: 500 }}>{display}</span>
              </span>
            );
          })}
        </div>
      )}
      {paramLines.length === 0 && (
        <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--g-fg-dim)' }}>
          无参数
        </div>
      )}
    </div>
  );
}

function renderSidebarForm(manifest: PluginManifest) {
  const paramEntries = Object.entries(manifest.params);
  if (paramEntries.length === 0) {
    return <div style={{ padding: 16, color: 'var(--g-fg-dim, #8c8f99)', fontSize: 13 }}>此节点无参数</div>;
  }

  // Group params into sections
  const sections: { title: string; keys: string[] }[] = [];
  const numericKeys: string[] = [];
  const stringKeys: string[] = [];
  const booleanKeys: string[] = [];
  const selectKeys: string[] = [];

  for (const [key, def] of paramEntries) {
    switch (def.type) {
      case 'number':
        numericKeys.push(key);
        break;
      case 'boolean':
        booleanKeys.push(key);
        break;
      case 'select':
        selectKeys.push(key);
        break;
      default:
        stringKeys.push(key);
        break;
    }
  }

  if (numericKeys.length > 0) sections.push({ title: '数值参数', keys: numericKeys });
  if (stringKeys.length > 0) sections.push({ title: '文本参数', keys: stringKeys });
  if (selectKeys.length > 0) sections.push({ title: '选项', keys: selectKeys });
  if (booleanKeys.length > 0) sections.push({ title: '开关', keys: booleanKeys });

  return (
    <div style={{ padding: '10px 12px' }}>
      {sections.map((section) => (
        <CozeSection key={section.title} title={section.title}>
          {section.keys.map((key) => {
            const def = manifest.params[key];
            return (
              <CozeFieldLayout
                key={key}
                label={def.label}
                tooltip={`${def.type}${def.default !== undefined ? '，默认: ' + def.default : ''}`}
              >
                <Field
                  name={`data.params.${key}`}
                  render={({ field: { value, onChange }, fieldState }: FieldRenderProps<unknown>) =>
                    renderParamField(def, value, onChange)
                  }
                />
              </CozeFieldLayout>
            );
          })}
        </CozeSection>
      ))}
    </div>
  );
}

/** Build validators for video node params */
function buildVideoValidators(manifest: PluginManifest): Record<string, (value: unknown) => string | undefined> {
  const validators: Record<string, (value: unknown) => string | undefined> = {};
  for (const [key, def] of Object.entries(manifest.params)) {
    validators[`data.params.${key}`] = (value: unknown): string | undefined => {
      if (value === undefined || value === null || value === '') {
        return `${def.label} 不能为空`;
      }
      if (def.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) return `${def.label} 必须是数字`;
        if (def.min !== undefined && num < def.min) return `${def.label} 不能小于 ${def.min}`;
        if (def.max !== undefined && num > def.max) return `${def.label} 不能大于 ${def.max}`;
      }
      return undefined;
    };
  }
  return validators;
}

function buildFormMeta(manifest: PluginManifest) {
  const validators = buildVideoValidators(manifest);
  return {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const values = (form.values?.data?.params ?? {}) as Record<string, unknown>;
      if (isSidebar) {
        return renderSidebarForm(manifest);
      }
      return renderNodeFace(manifest, values);
    },
    validate: validators,
    validateTrigger: ValidateTrigger.onChange,
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
  const IconComponent = getPluginIcon(manifest.id);
  return {
    type: manifest.id,
    info: {
      description: manifest.description,
      ...(IconComponent ? { iconComponent: IconComponent } : {}),
    },
    meta: {
      defaultPorts: ports,
      size: { width: 200, height: 60 + ports.length * 24 },
    },
    formMeta: buildFormMeta(manifest),
  };
}

/** 参数定义（扩展类型） */
type ParamItemType = 'string' | 'number' | 'integer' | 'boolean' | 'select' | 'textarea' | 'json' | 'object' | 'array' | 'image' | 'file';

interface ParamItem {
  name: string;
  type: ParamItemType;
  default: string;
  required?: boolean;
  description?: string;
  /** For select type */
  options?: string[];
  /** For number/integer */
  min?: number;
  max?: number;
  step?: number;
}

/** Coze-style 参数编辑器 */
function ParamEditor({
  value, onChange,
}: {
  value: ParamItem[];
  onChange: (v: ParamItem[]) => void;
}) {
  const items = Array.isArray(value) ? value : [];

  const addItem = () => {
    onChange([...items, { name: '', type: 'string', default: '', required: false }]);
  };

  const updateItem = (i: number, patch: Partial<ParamItem>) => {
    const next = items.map((item, idx) => idx === i ? { ...item, ...patch } : item);
    onChange(next);
  };

  const removeItem = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  const importJSON = () => {
    const raw = prompt('粘贴 JSON 或 JSON Schema:');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.properties && typeof parsed.properties === 'object') {
        const props = parsed.properties as Record<string, any>;
        const imported: ParamItem[] = Object.entries(props).map(([name, schema]) => ({
          name,
          type: mapSchemaType(schema.type),
          default: schema.default !== undefined ? String(schema.default) : '',
          required: (parsed.required as string[])?.includes(name) ?? false,
          description: schema.description ?? '',
        }));
        onChange(imported);
      } else {
        const imported: ParamItem[] = Object.entries(parsed).map(([k, v]) => ({
          name: k,
          type: v === null || v === undefined ? 'string'
            : typeof v === 'number' ? 'number'
            : typeof v === 'boolean' ? 'boolean'
            : typeof v === 'object' ? 'json' : 'string',
          default: v !== null && v !== undefined ? String(v) : '',
        }));
        onChange(imported);
      }
    } catch {
      alert('JSON 格式错误');
    }
  };

  function mapSchemaType(jsType?: string): ParamItemType {
    switch (jsType) {
      case 'integer': return 'integer';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return 'array';
      case 'object': return 'object';
      default: return 'string';
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={addItem} style={{ ...paramBtnStyle }}>+ 添加参数</button>
        <button onClick={importJSON} style={{ ...paramBtnStyle }}>📥 导入 JSON</button>
      </div>

      {items.length === 0 && (
        <div style={{ fontSize: 12, color: '#999', padding: '12px 0', textAlign: 'center' }}>
          暂无参数，点击「添加参数」或「导入 JSON」
        </div>
      )}

      {/* Parameter list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => {
          const nameError = item.name ? undefined : '参数名不能为空';
          return (
            <div key={i} style={{
              border: '1px solid var(--g-stroke-default)', borderRadius: 6,
              padding: 8, background: 'var(--g-bg-plus)',
            }}>
              {/* Row 1: 参数名 + 类型 + 必填 + 删除 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={item.name}
                    onChange={e => updateItem(i, { name: e.target.value })}
                    placeholder="参数名 *"
                    style={{
                      ...paramInputStyle, width: '100%',
                      borderColor: nameError && item.name === '' ? '#e94560' : undefined,
                    }}
                  />
                  {nameError && item.name === '' && (
                    <div style={{ fontSize: 10, color: '#e94560', marginTop: 1 }}>{nameError}</div>
                  )}
                </div>
                <select
                  value={item.type}
                  onChange={e => updateItem(i, { type: e.target.value as ParamItemType })}
                  style={{ ...paramInputStyle, width: 90, fontSize: 11 }}
                >
                  <option value="string">文本</option>
                  <option value="number">数字</option>
                  <option value="integer">整数</option>
                  <option value="boolean">布尔</option>
                  <option value="select">枚举</option>
                  <option value="textarea">多行文本</option>
                  <option value="json">JSON</option>
                  <option value="object">对象</option>
                  <option value="array">数组</option>
                  <option value="image">图片</option>
                  <option value="file">文件</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={item.required ?? false}
                    onChange={e => updateItem(i, { required: e.target.checked })}
                  />
                  必填
                </label>
                <button onClick={() => removeItem(i)} style={{ ...paramBtnStyle, color: '#e94560', padding: '2px 6px', border: 'none', background: 'none', fontSize: 14 }}>✕</button>
              </div>

              {/* Row 2: 默认值 + 特定类型配置 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {item.type === 'select' ? (
                  <input
                    value={item.options?.join(', ') ?? ''}
                    onChange={e => updateItem(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="选项值，逗号分隔"
                    style={{ ...paramInputStyle, flex: 1 }}
                  />
                ) : item.type === 'number' || item.type === 'integer' ? (
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    <input
                      type="number"
                      value={item.default}
                      onChange={e => updateItem(i, { default: e.target.value })}
                      placeholder="默认值"
                      style={{ ...paramInputStyle, width: '40%' }}
                    />
                    <input
                      type="number"
                      value={item.min ?? ''}
                      onChange={e => updateItem(i, { min: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="最小值"
                      style={{ ...paramInputStyle, width: '28%' }}
                    />
                    <input
                      type="number"
                      value={item.max ?? ''}
                      onChange={e => updateItem(i, { max: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="最大值"
                      style={{ ...paramInputStyle, width: '28%' }}
                    />
                  </div>
                ) : item.type === 'textarea' || item.type === 'json' || item.type === 'object' || item.type === 'array' ? (
                  <input
                    value={item.default}
                    onChange={e => updateItem(i, { default: e.target.value })}
                    placeholder={item.type === 'json' || item.type === 'object' ? '{"key": "value"}' : item.type === 'array' ? '["item1", "item2"]' : '默认值...'}
                    style={{ ...paramInputStyle, flex: 1 }}
                  />
                ) : (
                  <input
                    value={item.default}
                    onChange={e => updateItem(i, { default: e.target.value })}
                    placeholder="默认值"
                    style={{ ...paramInputStyle, flex: 1 }}
                  />
                )}
              </div>

              {/* Row 3: 描述 */}
              <input
                value={item.description ?? ''}
                onChange={e => updateItem(i, { description: e.target.value })}
                placeholder="参数描述（可选）"
                style={{ ...paramInputStyle, width: '100%', marginTop: 4, fontSize: 11, opacity: 0.7 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const paramInputStyle: React.CSSProperties = {
  padding: '5px 8px', border: '1px solid var(--g-stroke-default)', borderRadius: 4,
  fontSize: 12, color: 'var(--g-fg-primary)', background: 'var(--g-bg-plus)',
  outline: 'none', boxSizing: 'border-box',
};
const paramBtnStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid var(--g-stroke-default)', borderRadius: 4,
  background: 'var(--g-bg-secondary)', cursor: 'pointer', fontSize: 12,
  color: 'var(--g-fg-primary)',
};

/** Start 节点：定义工作流输入参数 */
const startRegistry: FlowNodeRegistry = {
  type: 'system:start',
  info: { description: '定义工作流的输入参数', iconComponent: getPluginIcon('system:start') ?? undefined },
  meta: {
    defaultPorts: [{ type: 'output' }],
    size: { width: 200, height: 52 },
    deleteDisable: true,
    copyDisable: true,
  },
  formMeta: {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const data = form.values?.data;
      const params = (data?.params ?? {}) as Record<string, unknown>;
      const inputs = params.inputs as ParamItem[] | undefined;

      if (isSidebar) {
        return (
          <div style={{ padding: 'var(--g-space-sm) var(--g-space-lg)' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--g-fg-primary)' }}>工作流名称</label>
              <Field
                name="data.params.workflowName"
                render={({ field: { value, onChange } }: FieldRenderProps<unknown>) =>
                  <Input size="small" value={value as string ?? '新工作流'} onChange={(v: string) => onChange(v)} />
                }
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--g-fg-primary)' }}>输入参数</label>
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
      const StartIcon = getPluginIcon('system:start');
      return (
        <div>
          <NodeHeader
            icon={StartIcon ? <StartIcon size={16} color="#4e40e5" /> : null}
            name="开始"
            color="#4e40e5"
          />
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--g-fg-secondary)' }}>
            {(params.workflowName as string) || '工作流'}{paramCount > 0 ? ` · ${paramCount}个参数` : ''}
          </div>
        </div>
      );
    },
  },
};

/** End 节点：定义工作流输出参数 */
const endRegistry: FlowNodeRegistry = {
  type: 'system:end',
  info: { description: '定义工作流的输出参数', iconComponent: getPluginIcon('system:end') ?? undefined },
  meta: {
    defaultPorts: [{ type: 'input' }],
    size: { width: 200, height: 52 },
    deleteDisable: true,
    copyDisable: true,
  },
  formMeta: {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const params = (form.values?.data?.params ?? {}) as Record<string, unknown>;
      const outputs = params.outputs as ParamItem[] | undefined;

      if (isSidebar) {
        return (
          <div style={{ padding: 'var(--g-space-sm) var(--g-space-lg)' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--g-fg-primary)' }}>输出参数</label>
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
      const EndIcon = getPluginIcon('system:end');
      return (
        <div>
          <NodeHeader
            icon={EndIcon ? <EndIcon size={16} color="#e94560" /> : null}
            name="结束"
            color="#e94560"
          />
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--g-fg-secondary)' }}>
            {paramCount > 0 ? `${paramCount}个输出参数` : '点击配置输出'}
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
  const side = ordered.filter(id => {
    const n = nodes.find(x => x.id === id);
    return n && !isMainChain(n.type);
  });
  side.forEach((id, i) => {
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
  
  // 构建时间轴连线
  const edges: any[] = [];
  
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
  
  return { nodes: injected, edges };
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
        type: String(n.type),
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
