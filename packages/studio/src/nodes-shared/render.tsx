/**
 * 共享渲染组件 — 节点画布面 + 侧边栏表单
 *
 * 参考 Flowgram demo-free-layout 的 FormHeader + FormContent 模式
 * - 侧边栏：FormHeader（图标+名称+描述+关闭按钮）+ 参数表单
 * - 画布面：紧凑视图（图标+名称+参数标签）
 */

import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';
import { Field, ValidateTrigger } from '@flowgram.ai/free-layout-editor';
import type { FormRenderProps, FieldRenderProps } from '@flowgram.ai/free-layout-editor';

import type { NodeManifest, ParamDef } from './types';
import type { FlowNodeJSON } from '../typings';
import { useIsSidebar } from '../hooks';
import { useNodeFormPanel } from '../plugins/panel-manager-plugin/hooks';
import { renderSetter, SetterWrapper } from '../nodes-common/setters';
import { VariablePicker } from '../nodes-common/variable-picker';
import { buildParamValidator } from './validators';

// ─── Sidebar FormHeader（参考 Flowgram 风格） ───

function SidebarFormHeader({ manifest }: { manifest: NodeManifest }) {
  const IconComponent = manifest.icon;
  const { close } = useNodeFormPanel();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: `linear-gradient(135deg, ${manifest.color}12 0%, transparent 100%)`,
        borderBottom: '1px solid rgba(6,7,9,0.08)',
        borderRadius: '8px 8px 0 0',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: manifest.color + '18',
          flexShrink: 0,
        }}
      >
        {IconComponent ? (
          <IconComponent size={16} color={manifest.color} />
        ) : (
          <span style={{ fontSize: 13, color: manifest.color }}>●</span>
        )}
      </div>

      {/* Name + Description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--g-fg-primary, #0f1529d1)',
            lineHeight: '18px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {manifest.name}
        </div>
        {manifest.description && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--g-fg-dim, #8c8f99)',
              lineHeight: '15px',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {manifest.description}
          </div>
        )}
      </div>

      {/* Close button */}
      <Button
        size="small"
        theme="borderless"
        type="tertiary"
        icon={<IconClose size="small" />}
        onClick={close}
        style={{ minWidth: 24, height: 24, color: 'var(--g-fg-dim, #8c8f99)', flexShrink: 0 }}
      />
    </div>
  );
}

// ─── NodeHeader（画布节点面标题） ───

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
  const paramEntries = Object.entries(manifest.params).slice(0, 4);

  return (
    <div style={{ fontSize: 12, width: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: paramEntries.length > 0 ? '1px solid rgba(6,7,9,0.06)' : 'none',
          background: `linear-gradient(135deg, ${manifest.color}08 0%, transparent 100%)`,
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
            background: manifest.color + '18',
            flexShrink: 0,
          }}
        >
          {IconComponent ? (
            <IconComponent size={13} color={manifest.color} />
          ) : (
            <span style={{ fontSize: 11, color: manifest.color }}>●</span>
          )}
        </div>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--g-fg-primary)' }}>
          {manifest.name}
        </span>
      </div>

      {/* Params summary */}
      {paramEntries.length > 0 ? (
        <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {paramEntries.map(([key, def]) => {
            const val = values[key] ?? def.default;
            if (val === undefined || val === null || val === '') return null;
            const display =
              String(val).length > 12 ? String(val).slice(0, 10) + '…' : String(val);
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
          {manifest.description || '点击配置'}
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

// ─── 侧边栏参数表单 ───

function isStringLikeType(t: string): boolean {
  return ['string', 'textarea', 'json', 'select'].includes(t);
}

function renderParamFields(
  manifest: NodeManifest,
  nodeId?: string,
  currentParams?: Record<string, unknown>,
) {
  const paramEntries = Object.entries(manifest.params);
  if (paramEntries.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--g-fg-dim, #8c8f99)', fontSize: 13, textAlign: 'center' }}>
        此节点无可配置参数
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      {paramEntries.map(([key, def]) => {
        // 条件显示检查
        if (def.visibleIf && currentParams) {
          const paramValue = currentParams[def.visibleIf.param];
          const expectedValues = Array.isArray(def.visibleIf.value)
            ? def.visibleIf.value
            : [def.visibleIf.value];
          if (!expectedValues.includes(paramValue as string)) {
            return null;
          }
        }

        const validator = buildParamValidator(def, key);
        const showVarPicker = nodeId && isStringLikeType(def.type);
        return (
          <div key={key} style={{ marginBottom: 14 }}>
            {/* Label */}
            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--g-fg-primary, #0f1529d1)',
                  lineHeight: '16px',
                }}
              >
                {def.label}
                {def.required && <span style={{ color: '#f93920', marginLeft: 2 }}>*</span>}
              </label>
              {def.description && (
                <span
                  title={def.description}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'var(--g-stroke-default, #e5e6eb)',
                    color: 'var(--g-fg-dim, #8c8f99)',
                    fontSize: 9,
                    fontWeight: 600,
                    cursor: 'help',
                    flexShrink: 0,
                    lineHeight: '14px',
                    textAlign: 'center',
                  }}
                >
                  ?
                </span>
              )}
            </div>

            {/* Field */}
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
          </div>
        );
      })}
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
        return (
          <div
            style={{
              height: '100%',
              width: '100%',
              background: 'rgb(251, 251, 251)',
              borderRadius: 8,
              border: '1px solid rgba(82,100,154, 0.13)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <SidebarFormHeader manifest={manifest} />
            <div style={{ flex: 1, overflow: 'auto' }}>
              {renderParamFields(manifest, nodeId, values)}
            </div>
          </div>
        );
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
