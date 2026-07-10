/**
 * Common nodes — Coze-inspired workflow nodes
 *
 * Each node is defined as a CommonNodeManifest (declarative metadata),
 * then built into a FlowNodeRegistry for the flowgram editor.
 */
import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';
import { Field, ValidateTrigger } from '@flowgram.ai/free-layout-editor';
import type { FlowNodeRegistry, FlowNodeJSON } from '../typings';
import { useIsSidebar } from '../hooks';
import { renderSetter, buildParamValidator, SetterWrapper } from './setters';
import type { CommonNodeManifest } from './types';
import { VariablePicker } from './variable-picker';

// --- Import all node manifests ---
import { LLM_NODE } from './llm';
import { CODE_NODE } from './code';
import { HTTP_NODE } from './http';
import { SET_VARIABLE_NODE } from './variable';
import { CONDITION_NODE } from './condition';
import { DATASET_NODE } from './dataset';
import { FUNCTION_NODE } from './function';
import { LOOP_NODE } from './loop';

export const ALL_COMMON_MANIFESTS: CommonNodeManifest[] = [
  LLM_NODE,
  CODE_NODE,
  HTTP_NODE,
  SET_VARIABLE_NODE,
  CONDITION_NODE,
  DATASET_NODE,
  FUNCTION_NODE,
  LOOP_NODE,
];

/** Color-coded header — same pattern as video nodes */
function NodeHeader({ icon, name, color }: { icon: React.ReactNode; name: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: `linear-gradient(135deg, ${color}18 0%, #fff 100%)`,
      borderBottom: '1px solid rgba(6,7,9,0.06)',
    }}>
      <div style={{
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, background: color + '22',
      }}>
        {icon}
      </div>
      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--g-fg-primary)' }}>{name}</span>
    </div>
  );
}

/** Build canvas face (compact view on the canvas) */
function renderCanvasFace(manifest: CommonNodeManifest, values: Record<string, unknown>) {
  const IconComponent = manifest.icon;
  const paramKeys = Object.keys(manifest.params);
  const showParams = paramKeys.slice(0, 3);
  return (
    <div style={{ minWidth: 160, fontSize: 12 }}>
      <NodeHeader
        icon={IconComponent ? <IconComponent size={16} color={manifest.color} /> : null}
        name={manifest.name}
        color={manifest.color}
      />
      {showParams.length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          {showParams.map(key => {
            const def = manifest.params[key];
            const val = values[key] ?? def.default;
            const display = val !== undefined ? String(val) : '';
            const truncated = display.length > 18 ? display.slice(0, 16) + '…' : display;
            return (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 11,
                lineHeight: '20px', color: 'var(--g-fg-secondary)',
              }}>
                <span>{def.label}:</span>
                <span style={{ fontWeight: 500, color: 'var(--g-fg-primary)' }}>{truncated}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Build sidebar form (full edit view) with validation display */
function renderSidebarForm(manifest: CommonNodeManifest, nodeId?: string) {
  const paramEntries = Object.entries(manifest.params);
  if (paramEntries.length === 0) {
    return <div style={{ padding: 16, color: 'var(--g-fg-secondary)', fontSize: 13 }}>此节点无参数</div>;
  }
  const isStringType = (t: string) => ['string', 'textarea', 'json', 'select'].includes(t);
  return (
    <div style={{ padding: 'var(--g-space-sm) var(--g-space-lg)' }}>
      {paramEntries.map(([key, def]) => {
        const validator = buildParamValidator(def, key);
        const showVarPicker = nodeId && isStringType(def.type);
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
              color: 'var(--g-fg-primary)',
            }}>
              {def.label}
              {def.required && <span style={{ color: '#f93920', marginLeft: 2 }}>*</span>}
              <span style={{
                fontSize: 10, color: 'var(--g-fg-dim)', marginLeft: 6, textTransform: 'uppercase',
              }}>
                {def.type}
              </span>
            </label>
            <Field
              name={`data.params.${key}`}
              render={({ field: { value, onChange }, fieldState }: FieldRenderProps<unknown>) => {
                const error = (fieldState?.errors?.[0]) ?? validator(value);
                const setter = renderSetter(def, value, onChange);
                return (
                  <SetterWrapper error={error as string | undefined}>
                    {showVarPicker ? (
                      <VariablePicker nodeId={nodeId!} value={value as string} onChange={onChange}>
                        {setter}
                      </VariablePicker>
                    ) : setter}
                  </SetterWrapper>
                );
              }}
            />
            {def.description && (
              <div style={{ fontSize: 11, color: 'var(--g-fg-dim)', marginTop: 2 }}>
                {def.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Build output variables list for canvas face */
function renderOutputsSummary(manifest: CommonNodeManifest) {
  if (!manifest.outputs || manifest.outputs.length === 0) return null;
  return (
    <div style={{ padding: '4px 12px 8px', borderTop: '1px solid rgba(6,7,9,0.06)' }}>
      <div style={{ fontSize: 10, color: 'var(--g-fg-dim)', marginBottom: 2 }}>输出:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {manifest.outputs.map(o => (
          <span key={o.key} style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 3,
            background: manifest.color + '18', color: manifest.color,
          }}>
            {o.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Build a FlowNodeRegistry from a CommonNodeManifest — with auto-generated validators */
function buildRegistry(manifest: CommonNodeManifest): FlowNodeRegistry {
  const ports = manifest.ports.map(p => ({ type: p.type as 'input' | 'output' }));

  // Auto-generate validators for each param
  const validators: Record<string, (value: unknown) => string | undefined> = {};
  for (const [key, def] of Object.entries(manifest.params)) {
    validators[`data.params.${key}`] = buildParamValidator(def, key);
  }

  return {
    type: manifest.id,
    info: {
      description: manifest.description,
      ...(manifest.icon ? { iconComponent: manifest.icon! } : {}),
    },
    meta: {
      defaultPorts: ports,
      size: { width: manifest.width ?? 240, height: 80 + Object.keys(manifest.params).length * 18 },
    },
    formMeta: {
      render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
        const isSidebar = useIsSidebar();
        const values = (form.values?.data?.params ?? {}) as Record<string, unknown>;
        // Get node ID from form context
        const nodeId = (form as any)?.store?.node?.id;

        if (isSidebar) {
          return renderSidebarForm(manifest, nodeId);
        }
        return (
          <div>
            {renderCanvasFace(manifest, values)}
            {renderOutputsSummary(manifest)}
          </div>
        );
      },
      validate: validators,
      validateTrigger: ValidateTrigger.onChange,
    },
  };
}

/** Build all common node registries */
export const commonNodeRegistries: FlowNodeRegistry[] =
  ALL_COMMON_MANIFESTS.map(buildRegistry);

export type { CommonNodeManifest } from './types';

