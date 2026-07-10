import type { FC } from 'react';
import type { FormRenderProps } from '@flowgram.ai/free-layout-editor';

/** Supported param types for common nodes — expanded Coze-style */
export type ParamType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'select'
  | 'textarea'
  | 'json'
  | 'model'
  | 'object'
  | 'array'
  | 'image'
  | 'file'
  | 'audio'
  | 'video';

/** A single parameter definition with validation support */
export interface ParamDef {
  type: ParamType;
  label: string;
  default?: unknown;
  placeholder?: string;
  /** For select type */
  options?: Array<{ label: string; value: string }>;
  /** For number/integer type */
  min?: number;
  max?: number;
  step?: number;
  /** For textarea/string */
  rows?: number;
  maxLength?: number;
  /** Required — shows red * and validates non-empty */
  required?: boolean;
  /** Regex pattern validation (string only) */
  pattern?: string;
  patternMessage?: string;
  /** Description shown below the field */
  description?: string;
  /** Nested fields (for object/array types) */
  fields?: Record<string, ParamDef>;
}

/** Output variable */
export interface OutputDef {
  key: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'image' | 'file';
  description?: string;
}

/** Port definition */
export interface PortDef {
  type: 'input' | 'output';
  name?: string;
}

/** Common node manifest — Coze-inspired registry pattern */
export interface CommonNodeManifest {
  id: string;
  name: string;
  category: 'llm' | 'code' | 'http' | 'variable' | 'condition' | 'dataset' | 'loop' | 'utility';
  description: string;
  color: string;
  icon: FC<{ size?: number; color?: string }> | null;
  /** Input/output port definitions */
  ports: PortDef[];
  /** Parameter schema */
  params: Record<string, ParamDef>;
  /** Output variables this node produces */
  outputs?: OutputDef[];
  /** Size hint */
  width?: number;
  /** Whether the node is always the first/last */
  isStart?: boolean;
  isEnd?: boolean;
  /** Custom form renderer (overrides auto-generated form) */
  customFormRenderer?: (props: FormRenderProps<Record<string, unknown>>) => React.ReactElement;
  /** Default data for new instances */
  defaultData?: Record<string, unknown>;
}
