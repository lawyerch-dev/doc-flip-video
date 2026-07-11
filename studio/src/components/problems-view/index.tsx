/**
 * ProblemsView — 工作流验证问题面板
 *
 * 生命周期：idle → validating → monitoring → completed
 * - idle: 初始状态，等待首次触发
 * - validating: 正在执行验证
 * - monitoring: 实时监听内容变化
 * - completed: 验证完成，显示结果
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Tag, Typography, Spin } from '@douyinfe/semi-ui';
import { IconRefresh, IconClose } from '@douyinfe/semi-icons';
import { useService, WorkflowDocument } from '@flowgram.ai/free-layout-editor';
import { debounce } from 'lodash-es';

import { ValidateService, type ValidateResult } from '../../services/validate-service';

// ─── Types ───

export type ProblemsState = 'idle' | 'validating' | 'monitoring' | 'completed';

export interface Problem {
  nodeId: string;
  nodeName: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ProblemsLifecycle {
  state: ProblemsState;
  problems: Problem[];
  isRunning: boolean;
  triggerValidation: () => void;
  reset: () => void;
}

// ─── Hook ───

export function useProblemsLifecycle(): ProblemsLifecycle {
  const [state, setState] = useState<ProblemsState>('idle');
  const [problems, setProblems] = useState<Problem[]>([]);
  const isRunning = state === 'validating';

  const triggerValidation = useCallback(() => {
    if (state === 'validating') return;
    setState('validating');
    // Simulate async validation
    setTimeout(() => {
      setProblems([]);
      setState('monitoring');
    }, 50);
  }, [state]);

  const reset = useCallback(() => {
    setState('idle');
    setProblems([]);
  }, []);

  return { state, problems, isRunning, triggerValidation, reset };
}

// ─── Component ───

export const ProblemsView = () => {
  const validateService = useService(ValidateService);
  const workflowDocument = useService(WorkflowDocument);

  const [state, setState] = useState<ProblemsState>('idle');
  const [results, setResults] = useState<ValidateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const disposableRef = useRef<{ dispose: () => void } | null>(null);

  const isRunning = state === 'validating';
  const errorCount = results.length;

  // Run validation
  const runValidation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await validateService.validateNodes();
      validateService.validateLines();
      setResults(res);
    } finally {
      setLoading(false);
    }
  }, [validateService]);

  // Debounced validation for real-time monitoring
  const debouncedValidation = useCallback(
    debounce(async () => {
      await runValidation();
    }, 1000),
    [runValidation],
  );

  // Manual trigger
  const triggerValidation = useCallback(async () => {
    if (state === 'validating') return;
    setState('validating');
    await runValidation();
    setState('monitoring');
  }, [state, runValidation]);

  // Reset to idle
  const reset = useCallback(() => {
    setState('idle');
    setResults([]);
    if (disposableRef.current) {
      disposableRef.current.dispose();
      disposableRef.current = null;
    }
  }, []);

  // Start monitoring after first validation
  useEffect(() => {
    if (state === 'monitoring' && !disposableRef.current) {
      const disposable = workflowDocument.onContentChange(() => {
        debouncedValidation();
      });
      disposableRef.current = disposable;
    }
    return () => {
      if (disposableRef.current) {
        disposableRef.current.dispose();
        disposableRef.current = null;
      }
    };
  }, [state, workflowDocument, debouncedValidation]);

  // Auto-trigger on first mount
  useEffect(() => {
    triggerValidation();
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgb(251, 251, 251)',
        borderRadius: 8,
        border: '1px solid rgba(82,100,154, 0.13)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid rgba(6,7,9,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            问题检查
          </Typography.Text>
          {isRunning && <Spin size="small" />}
          {errorCount > 0 && (
            <Tag color="red" size="small">
              {errorCount}
            </Tag>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            size="small"
            theme="borderless"
            type="tertiary"
            icon={<IconRefresh size="small" />}
            onClick={triggerValidation}
            loading={isRunning}
            style={{ minWidth: 24, height: 24 }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {state === 'idle' && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--g-fg-dim)' }}>
            点击刷新按钮开始检查
          </div>
        )}

        {state === 'validating' && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--g-fg-dim)' }}>
            正在检查...
          </div>
        )}

        {state === 'monitoring' && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#52c41a' }}>
            检查通过，没有发现问题
          </div>
        )}

        {results.map((result) => (
          <div
            key={result.node.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px',
              marginBottom: 4,
              borderRadius: 6,
              background: 'rgba(233, 69, 96, 0.04)',
              border: '1px solid rgba(233, 69, 96, 0.12)',
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g-fg-primary)' }}>
                {result.node.form?.values?.title || result.node.id}
              </div>
              <div style={{ fontSize: 11, color: '#e94560', marginTop: 2 }}>
                {result.feedbacks.map((f) => f.feedbackText).join(', ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── TopBar Button ───

export const ProblemsButton = ({ onClick }: { onClick: () => void }) => {
  const validateService = useService(ValidateService);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await validateService.validateNodes();
        setErrorCount(res.length);
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [validateService]);

  return (
    <Button
      size="small"
      theme="borderless"
      type="tertiary"
      icon={
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconRefresh size="small" />
          {errorCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                background: '#e94560',
                color: '#fff',
                fontSize: 9,
                fontWeight: 600,
                width: 14,
                height: 14,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {errorCount > 9 ? '9+' : errorCount}
            </span>
          )}
        </span>
      }
      onClick={onClick}
      style={{ fontSize: 12, color: 'var(--g-fg-secondary, #666)' }}
    >
      问题
    </Button>
  );
};
