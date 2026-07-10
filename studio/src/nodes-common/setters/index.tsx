/**
 * Setter components — Coze-inspired form controls
 * Each setter is a simple controlled React component for a specific data type.
 */
import React from 'react';
import { Input, InputNumber, Select, Switch, TextArea } from '@douyinfe/semi-ui';
import type { ParamDef } from '../types';

// ─── Explicit prop interfaces (no generics, avoids TS complexity) ───

interface StringProps {
  value?: string;
  onChange?: (v: string) => void;
  readonly?: boolean;
  placeholder?: string;
  maxCount?: number;
}

interface NumberProps {
  value?: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

interface BoolProps {
  value?: boolean;
  onChange?: (v: boolean) => void;
  readonly?: boolean;
}

interface EnumProps {
  value?: string;
  onChange?: (v: string) => void;
  readonly?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

interface TextProps {
  value?: string;
  onChange?: (v: string) => void;
  readonly?: boolean;
  placeholder?: string;
  rows?: number;
  maxCount?: number;
}

// ─── Setters ───

export const StringSetter: React.FC<StringProps> = ({
  value, onChange, readonly, placeholder, maxCount,
}) => (
  <div style={{ position: 'relative' }}>
    <Input
      size="small"
      value={value ?? ''}
      onChange={(v: string) => onChange?.(v)}
      placeholder={placeholder}
      maxLength={maxCount}
      disabled={readonly}
      style={{ width: '100%' }}
    />
    {maxCount ? (
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--g-fg-dim)' }}>
        {(value ?? '').length}/{maxCount}
      </span>
    ) : null}
  </div>
);

export const NumberSetter: React.FC<NumberProps> = ({
  value, onChange, readonly, placeholder, min, max, step,
}) => (
  <InputNumber
    size="small"
    value={value ?? 0}
    onChange={(v: string | number) => onChange?.(typeof v === 'number' ? v : parseFloat(v))}
    min={min}
    max={max}
    step={step ?? 1}
    placeholder={placeholder}
    disabled={readonly}
    style={{ width: '100%' }}
  />
);

export const BooleanSetter: React.FC<BoolProps> = ({
  value, onChange, readonly,
}) => (
  <Switch
    checked={value ?? false}
    onChange={(v: boolean) => onChange?.(v)}
    disabled={readonly}
    size="small"
  />
);

export const EnumSetter: React.FC<EnumProps> = ({
  value, onChange, readonly, placeholder, options,
}) => (
  <Select
    size="small"
    value={value}
    onChange={(v: any) => onChange?.(String(v))}
    placeholder={placeholder ?? '请选择...'}
    disabled={readonly}
    style={{ width: '100%' }}
  >
    {(options ?? []).map((opt) => (
      <Select.Option key={opt.value} value={opt.value}>
        {opt.label}
      </Select.Option>
    ))}
  </Select>
);

export const TextSetter: React.FC<TextProps> = ({
  value, onChange, readonly, placeholder, rows = 3, maxCount,
}) => (
  <div style={{ position: 'relative' }}>
    <TextArea
      value={value ?? ''}
      onChange={(v: string) => onChange?.(v)}
      placeholder={placeholder}
      rows={rows}
      disabled={readonly}
      maxLength={maxCount}
      style={{ width: '100%', fontSize: 12 }}
    />
    {maxCount ? (
      <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 10, color: 'var(--g-fg-dim)' }}>
        {(value ?? '').length}/{maxCount}
      </span>
    ) : null}
  </div>
);

const KNOWN_MODELS = [
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet' },
  { label: 'Claude 3.5 Haiku', value: 'claude-3.5-haiku' },
  { label: 'DeepSeek V3', value: 'deepseek-v3' },
  { label: 'DeepSeek R1', value: 'deepseek-r1' },
  { label: 'Qwen 2.5', value: 'qwen-2.5' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
];

export const ModelSetter: React.FC<EnumProps> = ({
  value, onChange, readonly,
}) => (
  <Select
    size="small"
    value={value}
    onChange={(v: any) => onChange?.(String(v))}
    placeholder="选择模型..."
    disabled={readonly}
    style={{ width: '100%' }}
  >
    {KNOWN_MODELS.map(m => (
      <Select.Option key={m.value} value={m.value}>
        {m.label}
      </Select.Option>
    ))}
  </Select>
);

/** JSON/Object editor — textarea with monospace */
export const JsonSetter: React.FC<TextProps> = (props) => (
  <div style={{ position: 'relative' }}>
    <TextArea
      value={props.value ?? ''}
      onChange={(v: string) => props.onChange?.(v)}
      placeholder={props.placeholder ?? '{}'}
      rows={props.rows ?? 6}
      disabled={props.readonly}
      style={{ width: '100%', fontSize: 12, fontFamily: 'monospace' }}
    />
  </div>
);

/** File/image/audio/video type — renders as string with type hint */
export const FileSetter: React.FC<StringProps & { fileType: string }> = ({
  value, onChange, readonly, placeholder, fileType,
}) => (
  <div style={{ position: 'relative' }}>
    <Input
      size="small"
      value={value ?? ''}
      onChange={(v: string) => onChange?.(v)}
      placeholder={placeholder ?? `输入${fileType}路径或URL`}
      disabled={readonly}
      prefix={<span style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase' }}>{fileType}</span>}
      style={{ width: '100%' }}
    />
  </div>
);

// ─── Validation context — wraps a setter with error display ───

interface SetterWrapperProps {
  error?: string;
  children: React.ReactNode;
}

export const SetterWrapper: React.FC<SetterWrapperProps> = ({ error, children }) => (
  <div>
    {children}
    {error && (
      <div style={{
        fontSize: 11, color: '#e94560', marginTop: 2,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span>⚠</span>
        <span>{error}</span>
      </div>
    )}
  </div>
);

// ─── Dynamic setter dispatch ───

export function renderSetter(
  def: ParamDef,
  value: unknown,
  onChange: (v: unknown) => void,
): React.ReactElement {
  switch (def.type) {
    case 'model':
      return <ModelSetter value={value as string} onChange={(v) => onChange(v)} readonly={def.required === false} />;
    case 'select':
      return <EnumSetter value={value as string} onChange={(v) => onChange(v)} options={def.options ?? []} />;
    case 'boolean':
      return <BooleanSetter value={value as boolean} onChange={(v) => onChange(v)} />;
    case 'number':
    case 'integer':
      return <NumberSetter value={value as number} onChange={(v) => onChange(v)} min={def.min} max={def.max} step={def.step ?? (def.type === 'integer' ? 1 : 0.1)} />;
    case 'textarea':
      return <TextSetter value={value as string} onChange={(v) => onChange(v)} rows={def.rows ?? 4} maxCount={def.maxLength} />;
    case 'json':
    case 'object':
      return <JsonSetter value={value as string} onChange={(v) => onChange(v)} rows={def.rows ?? 6} />;
    case 'array':
      return <JsonSetter value={value as string} onChange={(v) => onChange(v)} placeholder={def.placeholder ?? '[]'} rows={def.rows ?? 4} />;
    case 'image':
      return <FileSetter value={value as string} onChange={(v) => onChange(v)} fileType="图片" />;
    case 'file':
      return <FileSetter value={value as string} onChange={(v) => onChange(v)} fileType="文件" />;
    case 'audio':
      return <FileSetter value={value as string} onChange={(v) => onChange(v)} fileType="音频" />;
    case 'video':
      return <FileSetter value={value as string} onChange={(v) => onChange(v)} fileType="视频" />;
    default:
      return <StringSetter value={value as string} onChange={(v) => onChange(v)} maxCount={def.maxLength} />;
  }
}

/** Build validators from a param definition */
export function buildParamValidator(def: ParamDef, key: string): (value: unknown) => string | undefined {
  return (value: unknown): string | undefined => {
    const val = value as string | number | boolean | undefined | null;

    // Required check
    if (def.required) {
      if (val === undefined || val === null || val === '') {
        return `${def.label} 为必填项`;
      }
    }

    // Type-specific checks
    switch (def.type) {
      case 'number':
      case 'integer':
        if (val !== undefined && val !== '' && val !== null) {
          const num = Number(val);
          if (isNaN(num)) return `${def.label} 必须是数字`;
          if (def.type === 'integer' && num !== Math.floor(num)) return `${def.label} 必须是整数`;
          if (def.min !== undefined && num < def.min) return `${def.label} 不能小于 ${def.min}`;
          if (def.max !== undefined && num > def.max) return `${def.label} 不能大于 ${def.max}`;
        }
        break;
      case 'select':
        if (def.required && val && def.options) {
          const validValues = def.options.map(o => o.value);
          if (!validValues.includes(val as string)) return `${def.label} 请选择有效选项`;
        }
        break;
      case 'string':
      case 'textarea':
        if (val && typeof val === 'string') {
          if (def.maxLength && val.length > def.maxLength) return `${def.label} 不能超过 ${def.maxLength} 个字符`;
          if (def.pattern) {
            try {
              const regex = new RegExp(def.pattern);
              if (!regex.test(val)) return def.patternMessage || `${def.label} 格式不正确`;
            } catch {}
          }
        }
        break;
      case 'json':
      case 'object':
        if (val && typeof val === 'string') {
          try {
            JSON.parse(val);
          } catch {
            return `${def.label} 必须是有效的 JSON 格式`;
          }
        }
        break;
      case 'image':
      case 'file':
      case 'audio':
      case 'video':
        if (def.required && (!val || (typeof val === 'string' && val.trim() === ''))) {
          return `${def.label} 为必填项`;
        }
        break;
    }
    return undefined;
  };
}
