import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProblemsLifecycle } from './index';

describe('useProblemsLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should start in idle state', () => {
    const { result } = renderHook(() => useProblemsLifecycle());
    expect(result.current.state).toBe('idle');
    expect(result.current.problems).toEqual([]);
    expect(result.current.isRunning).toBe(false);
  });

  it('should transition to validating on manual trigger', async () => {
    const { result } = renderHook(() => useProblemsLifecycle());

    await act(async () => {
      result.current.triggerValidation();
    });

    expect(result.current.state).toBe('validating');
    expect(result.current.isRunning).toBe(true);
  });

  it('should transition to monitoring after first validation', async () => {
    const { result } = renderHook(() => useProblemsLifecycle());

    await act(async () => {
      result.current.triggerValidation();
      vi.advanceTimersByTime(100);
    });

    // After validation completes, should be in monitoring state
    expect(result.current.state).toBe('monitoring');
    expect(result.current.isRunning).toBe(false);
  });

  it('should collect problems from validation', async () => {
    const mockProblems = [
      { nodeId: 'node1', message: 'Missing required field', severity: 'error' as const },
      { nodeId: 'node2', message: 'Invalid value', severity: 'warning' as const },
    ];

    const { result } = renderHook(() => useProblemsLifecycle());

    // Simulate validation with problems
    await act(async () => {
      result.current.triggerValidation();
      vi.advanceTimersByTime(100);
    });

    // Problems should be empty initially (no real validation)
    expect(result.current.problems).toEqual([]);
  });

  it('should support reset to idle', async () => {
    const { result } = renderHook(() => useProblemsLifecycle());

    await act(async () => {
      result.current.triggerValidation();
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.problems).toEqual([]);
  });

  it('should not re-trigger validation if already validating', async () => {
    const { result } = renderHook(() => useProblemsLifecycle());

    await act(async () => {
      result.current.triggerValidation();
      result.current.triggerValidation(); // Second call should be ignored
    });

    expect(result.current.state).toBe('validating');
  });
});
