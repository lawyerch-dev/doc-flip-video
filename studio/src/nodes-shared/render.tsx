/**
 * 共享渲染组件 — 节点画布面 + 侧边栏表单
 *
 * 统一了 nodes-video 和 nodes-common 的渲染逻辑
 */

import React from 'react';
import { Field, ValidateTrigger } from '@flowgram.ai/free-layout-editor';
import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';

import type { NodeManifest, ParamDef } from './types';
import type { FlowNodeJSON } from '../typings';
import { useIsSidebar } from '../hooks';
import { CozeFieldLayout } from '../form-components/field-layout';
import { CozeSection } from '../form-components/section';
import { renderSetter, SetterWrapper } from '../nodes-common/setters';
import { VariablePicker } from '../nodes-common/variable-picker';
import { buildParamValidator } from './validators';

// ─── NodeHeader ───

export function NodeHeader({
  icon,
  name,
  color,
}: {
  icon: React.ReactNode;
  name: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid rgba(6,7,9,0.06)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 20,
          height: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            background: color + '20',
          }}
        >
          {icon}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 4,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--g-fg-primary)' }}>
        {name}
      </span>
    </div>
  );
}

// ─── 画布节点面（紧凑视图） ───

export function renderCanvasFace(
  manifest: NodeManifest,
  values: Record<string, unknown>,
) {
  const IconComponent = manifest.icon;
  const paramLines = Object.entries(manifest.params).slice(0, 4);

  return (
    <div style={{ fontSize: 12, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid rgba(6,7,9,0.06)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 20,
            height: 20,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              background: manifest.color + '20',
            }}
          >
            {IconComponent ? (
              <IconComponent size={13} color={manifest.color} />
            ) : (
              <span style={{ fontSize: 11 }}>●</span>
            )}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 4,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
              pointerEvents: 'none',
            }}
          />
        </div>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--g-fg-primary)' }}>
          {manifest.name}
        </span>
      </div>
      {paramLines.length > 0 ? (
        <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {paramLines.map(([key, def]) => {
            const val = values[key] ?? def.default;
            const display =
              String(val).length > 15 ? String(val).slice(0, 13) + '…' : String(val);
            return (
              <span
                key={key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px',
                  background: manifest.color + '0d',
                  borderRadius: 4,
                  fontSize: 10,
                  color: manifest.color,
                  lineHeight: '18px',
                }}
              >
                <span style={{ opacity: 0.7 }}>{def.label}</span>
                <span style={{ fontWeight: 500 }}>{display}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--g-fg-dim)' }}>
          无参数
        </div>
      )}
    </div>
  );
}

// ─── 输出变量摘要（画布节点面底部） ───

export function renderOutputsSummary(manifest: NodeManifest) {
  if (!manifest.outputs || manifest.outputs.length === 0) return null;
  return (
    <div style={{ padding: '4px 12px 8px', borderTop: '1px solid rgba(6,7,9,0.06)' }}>
      <div style={{ fontSize: 10, color: 'var(--g-fg-dim)', marginBottom: 2 }}>输出:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {manifest.outputs.map((o) => (
          <span
            key={o.key}
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 3,
              background: manifest.color + '18',
              color: manifest.color,
            }}
          >
            {o.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── 侧边栏表单 ───

/** 判断参数类型是否支持变量引用 */
function isStringLikeType(t: string): boolean {
  return ['string', 'textarea', 'json', 'select'].includes(t);
}

export function renderSidebarForm(
  manifest: NodeManifest,
  nodeId?: string,
) {
  const paramEntries = Object.entries(manifest.params);
  if (paramEntries.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--g-fg-dim, #8c8f99)', fontSize: 13 }}>
        此节点无参数
      </div>
    );
  }

  // 按类型分组
  const sections: { title: string; keys: string[] }[] = [];
  const numericKeys: string[] = [];
  const stringKeys: string[] = [];
  const booleanKeys: string[] = [];
  const selectKeys: string[] = [];

  for (const [key, def] of paramEntries) {
    switch (def.type) {
      case 'number':
      case 'integer':
        numericKeys.push(key);
        break;
      case 'boolean':
        booleanKeys.push(key);
        break;
      case 'select':
      case 'model':
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
            const validator = buildParamValidator(def, key);
            const showVarPicker = nodeId && isStringLikeType(def.type);
            return (
              <CozeFieldLayout
                key={key}
                label={def.label}
                tooltip={`${def.type}${def.default !== undefined ? '，默认: ' + def.default : ''}`}
              >
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
                        ) : (
                          setter
                        )}
                      </SetterWrapper>
                    );
                  }}
                />
              </CozeFieldLayout>
            );
          })}
        </CozeSection>
      ))}
    </div>
  );
}

// ─── 统一的 formMeta 构建器 ───

export function buildFormMeta(manifest: NodeManifest) {
  const validators: Record<string, (value: unknown) => string | undefined> = {};
  for (const [key, def] of Object.entries(manifest.params)) {
    validators[`data.params.${key}`] = buildParamValidator(def, key);
  }

  return {
    render: ({ form }: FormRenderProps<FlowNodeJSON>) => {
      const isSidebar = useIsSidebar();
      const values = (form.values?.data?.params ?? {}) as Record<string, unknown>;
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
  };
}
