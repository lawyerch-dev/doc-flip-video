import type { ReactNode } from 'react';

export interface SetterProps<Value = unknown, Options = Record<string, never>> {
  value?: Value;
  onChange?: (value: Value) => void;
  readonly?: boolean;
  placeholder?: string;
  /** Char count limit */
  maxCount?: number;
  /** Width */
  width?: string | number;
  /** Extra context */
  children?: ReactNode;
}

export type Setter<Value = unknown, Options = Record<string, never>> =
  React.FC<SetterProps<Value, Options> & Options>;
