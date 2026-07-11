/**
 * Coze-style collapsible section for grouping form fields
 */
import React, { useState } from 'react';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CozeSection({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        marginBottom: 8,
        border: '1px solid var(--g-stroke-divider, #e9eaed)',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--g-bg-plus, #ffffff)',
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--g-bg-secondary, rgba(0,0,0,0.03))',
          borderBottom: open ? '1px solid var(--g-stroke-divider, #e9eaed)' : 'none',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            flexShrink: 0,
          }}
        >
          <path
            d="M4.5 2.5L7.5 6L4.5 9.5"
            fill="none"
            stroke="var(--g-fg-dim, #8c8f99)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--g-fg-primary, #0f1529d1)',
            lineHeight: '16px',
          }}
        >
          {title}
        </span>
      </div>
      {open && (
        <div style={{ padding: '10px 10px 4px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
