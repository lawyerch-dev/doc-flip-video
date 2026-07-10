/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Coze-style form item with label + input layout
 */

import React, { useCallback } from 'react';
import { DisplaySchemaTag } from '@flowgram.ai/form-materials';
import { Typography, Tooltip } from '@douyinfe/semi-ui';

const { Text } = Typography;

interface FormItemProps {
  children: React.ReactNode;
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  labelWidth?: number;
  labelStyle?: React.CSSProperties;
  vertical?: boolean;
  style?: React.CSSProperties;
}

export function FormItem({
  children,
  name,
  required,
  description,
  type,
  labelWidth = 148,
  labelStyle,
  vertical = false,
  style,
}: FormItemProps): JSX.Element {
  const renderTitle = useCallback(
    (showTooltip?: boolean) => (
      <div style={{ width: '0', display: 'flex', flex: '1' }}>
        <Text style={{ width: '100%', fontSize: 12, fontWeight: 500 }} ellipsis={{ showTooltip: !!showTooltip }}>
          {name}
          {required && <span style={{ color: '#f93920', paddingLeft: 2 }}>*</span>}
        </Text>
      </div>
    ),
    [required],
  );

  return (
    <div
      style={{
        fontSize: 12,
        marginBottom: 16,
        width: '100%',
        position: 'relative',
        display: 'flex',
        gap: 8,
        ...(vertical
          ? { flexDirection: 'column' }
          : {
              justifyContent: 'center',
              alignItems: 'flex-start',
            }),
        ...style,
      }}
    >
      <div
        style={{
          justifyContent: 'flex-start',
          alignItems: 'center',
          color: 'var(--semi-color-text-0)',
          width: labelWidth,
          minWidth: labelWidth,
          maxWidth: labelWidth,
          position: 'relative',
          display: 'flex',
          columnGap: 4,
          flexShrink: 0,
          height: 32,
          paddingRight: 4,
          ...labelStyle,
        }}
      >
        {type && <DisplaySchemaTag value={{ type }} />}
        {description ? (
          <Tooltip content={description}>{renderTitle()}</Tooltip>
        ) : (
          renderTitle(true)
        )}
      </div>
      <div style={{ flexGrow: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
