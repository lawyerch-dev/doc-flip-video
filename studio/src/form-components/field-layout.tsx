/**
 * Coze-style form field layout
 *
 * Horizontal: label (148px) + input (flex 1)
 * Vertical: label above input (for textareas)
 * Includes required star, tooltip icon, and error feedback
 */
import React from 'react';

interface FieldLayoutProps {
  label?: string;
  tooltip?: string;
  required?: boolean;
  vertical?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function CozeFieldLayout({
  label,
  tooltip,
  required = false,
  vertical = false,
  error,
  children,
}: FieldLayoutProps) {
  return (
    <div
      style={{
        marginBottom: 16,
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        gap: vertical ? 6 : 0,
        alignItems: vertical ? 'stretch' : 'flex-start',
      }}
    >
      {label && (
        <div
          style={{
            width: vertical ? 'auto' : 148,
            minWidth: vertical ? 'auto' : 148,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 32,
            paddingRight: vertical ? 0 : 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--g-fg-primary, #0f1529d1)',
              lineHeight: '16px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
            {required && <span style={{ color: '#f93920', marginLeft: 2 }}>*</span>}
          </span>
          {tooltip && (
            <span
              title={tooltip}
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
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
        {error && (
          <div
            style={{
              fontSize: 11,
              color: '#f93920',
              marginTop: 4,
              lineHeight: '14px',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
