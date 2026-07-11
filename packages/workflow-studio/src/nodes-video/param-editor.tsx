/**
 * Start/End 节点的参数编辑器
 */

import React from 'react';
import { Field } from '@flowgram.ai/free-layout-editor';
import type { FieldRenderProps } from '@flowgram.ai/free-layout-editor';
import { Input } from '@douyinfe/semi-ui';

/** 参数定义（扩展类型） */
type ParamItemType =
  | 'string' | 'number' | 'integer' | 'boolean' | 'select'
  | 'textarea' | 'json' | 'object' | 'array' | 'image' | 'file';

interface ParamItem {
  name: string;
  type: ParamItemType;
  default: string;
  required?: boolean;
  description?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export type { ParamItem, ParamItemType };

const paramInputStyle: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid var(--g-stroke-default)',
  borderRadius: 4,
  fontSize: 12,
  color: 'var(--g-fg-primary)',
  background: 'var(--g-bg-plus)',
  outline: 'none',
  boxSizing: 'border-box',
};

const paramBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--g-stroke-default)',
  borderRadius: 4,
  background: 'var(--g-bg-secondary)',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--g-fg-primary)',
};

/** Start/End 节点的参数编辑器 */
export function ParamEditor({
  value,
  onChange,
}: {
  value: ParamItem[];
  onChange: (v: ParamItem[]) => void;
}) {
  const items = Array.isArray(value) ? value : [];

  const addItem = () => {
    onChange([...items, { name: '', type: 'string', default: '', required: false }]);
  };

  const updateItem = (i: number, patch: Partial<ParamItem>) => {
    const next = items.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
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
          type:
            v === null || v === undefined
              ? 'string'
              : typeof v === 'number'
                ? 'number'
                : typeof v === 'boolean'
                  ? 'boolean'
                  : typeof v === 'object'
                    ? 'json'
                    : 'string',
          default: v !== null && v !== undefined ? String(v) : '',
        }));
        onChange(imported);
      }
    } catch {
      alert('JSON 格式错误');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={addItem} style={{ ...paramBtnStyle }}>
          + 添加参数
        </button>
        <button onClick={importJSON} style={{ ...paramBtnStyle }}>
          📥 导入 JSON
        </button>
      </div>

      {items.length === 0 && (
        <div style={{ fontSize: 12, color: '#999', padding: '12px 0', textAlign: 'center' }}>
          暂无参数，点击「添加参数」或「导入 JSON」
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => {
          const nameError = item.name ? undefined : '参数名不能为空';
          return (
            <div
              key={i}
              style={{
                border: '1px solid var(--g-stroke-default)',
                borderRadius: 6,
                padding: 8,
                background: 'var(--g-bg-plus)',
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                    placeholder="参数名 *"
                    style={{
                      ...paramInputStyle,
                      width: '100%',
                      borderColor: nameError && item.name === '' ? '#e94560' : undefined,
                    }}
                  />
                  {nameError && item.name === '' && (
                    <div style={{ fontSize: 10, color: '#e94560', marginTop: 1 }}>{nameError}</div>
                  )}
                </div>
                <select
                  value={item.type}
                  onChange={(e) => updateItem(i, { type: e.target.value as ParamItemType })}
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
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 11,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.required ?? false}
                    onChange={(e) => updateItem(i, { required: e.target.checked })}
                  />
                  必填
                </label>
                <button
                  onClick={() => removeItem(i)}
                  style={{
                    ...paramBtnStyle,
                    color: '#e94560',
                    padding: '2px 6px',
                    border: 'none',
                    background: 'none',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {item.type === 'select' ? (
                  <input
                    value={item.options?.join(', ') ?? ''}
                    onChange={(e) =>
                      updateItem(i, {
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="选项值，逗号分隔"
                    style={{ ...paramInputStyle, flex: 1 }}
                  />
                ) : item.type === 'number' || item.type === 'integer' ? (
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    <input
                      type="number"
                      value={item.default}
                      onChange={(e) => updateItem(i, { default: e.target.value })}
                      placeholder="默认值"
                      style={{ ...paramInputStyle, width: '40%' }}
                    />
                    <input
                      type="number"
                      value={item.min ?? ''}
                      onChange={(e) =>
                        updateItem(i, { min: e.target.value ? Number(e.target.value) : undefined })
                      }
                      placeholder="最小值"
                      style={{ ...paramInputStyle, width: '28%' }}
                    />
                    <input
                      type="number"
                      value={item.max ?? ''}
                      onChange={(e) =>
                        updateItem(i, { max: e.target.value ? Number(e.target.value) : undefined })
                      }
                      placeholder="最大值"
                      style={{ ...paramInputStyle, width: '28%' }}
                    />
                  </div>
                ) : ['textarea', 'json', 'object', 'array'].includes(item.type) ? (
                  <input
                    value={item.default}
                    onChange={(e) => updateItem(i, { default: e.target.value })}
                    placeholder={
                      item.type === 'json' || item.type === 'object'
                        ? '{"key": "value"}'
                        : item.type === 'array'
                          ? '["item1", "item2"]'
                          : '默认值...'
                    }
                    style={{ ...paramInputStyle, flex: 1 }}
                  />
                ) : (
                  <input
                    value={item.default}
                    onChange={(e) => updateItem(i, { default: e.target.value })}
                    placeholder="默认值"
                    style={{ ...paramInputStyle, flex: 1 }}
                  />
                )}
              </div>

              <input
                value={item.description ?? ''}
                onChange={(e) => updateItem(i, { description: e.target.value })}
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
