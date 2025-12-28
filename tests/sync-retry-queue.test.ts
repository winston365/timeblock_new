import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/services/sync/syncLogger', () => ({
  addSyncLog: vi.fn(),
}));

import {
  addToRetryQueue,
  clearRetryQueue,
  drainRetryQueue,
  getRetryQueueSize,
  retryNow,
  setErrorCallback,
} from '@/shared/services/sync/firebase/syncRetryQueue';

describe('syncRetryQueue', () => {
  beforeEach(() => {
    clearRetryQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearRetryQueue();
  });

  it('returns false when retrying a missing item', async () => {
    const ok = await retryNow('missing');
    expect(ok).toBe(false);
  });

  it('calls errorCallback and removes item when max retries exceeded', async () => {
    const cb = vi.fn();
    setErrorCallback(cb);

    addToRetryQueue(
      'id1',
      { collection: 'c' },
      { x: 1 },
      undefined,
      async () => {
        // no-op
      },
      0
    );

    const ok = await retryNow('id1');

    expect(ok).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]?.[2]).toBe(false);
  });

  it('removes item after a successful retry', async () => {
    const syncFn = vi.fn(async () => {
      // success
    });

    addToRetryQueue('id2', { collection: 'c' }, { x: 1 }, 'k', syncFn, 3);

    const ok = await retryNow('id2');

    expect(ok).toBe(true);
    expect(syncFn).toHaveBeenCalledTimes(1);

    const ok2 = await retryNow('id2');
    expect(ok2).toBe(false);
  });

  it('schedules automatic retry with exponential backoff after failure', async () => {
    const cb = vi.fn();
    setErrorCallback(cb);

    const syncFn = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    addToRetryQueue('id3', { collection: 'c' }, { x: 1 }, 'k', syncFn, 3);

    const ok = await retryNow('id3');
    expect(ok).toBe(false);
    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]?.[2]).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);

    expect(syncFn).toHaveBeenCalledTimes(2);

    const ok2 = await retryNow('id3');
    expect(ok2).toBe(false);
  });

  it('increments retryCount when adding an existing id', async () => {
    const syncFn = vi.fn(async () => {
      throw new Error('fail');
    });

    addToRetryQueue('id4', { collection: 'c' }, { x: 1 }, 'k', syncFn, 3);
    addToRetryQueue('id4', { collection: 'c' }, { x: 1 }, 'k', syncFn, 3);

    // First retry should be attempt 2/3 due to the increment.
    const ok = await retryNow('id4');
    expect(ok).toBe(false);
  });

  // ============================================================================
  // Task 5.1: Drain (재연결 시 순차 처리) 테스트
  // ============================================================================
  it('drainRetryQueue processes all queued items sequentially', async () => {
    const syncFn1 = vi.fn(async () => { /* success */ });
    const syncFn2 = vi.fn(async () => { /* success */ });
    const syncFn3 = vi.fn(async () => { throw new Error('fail'); });

    addToRetryQueue('drain1', { collection: 'c1' }, { a: 1 }, 'k1', syncFn1, 3);
    addToRetryQueue('drain2', { collection: 'c2' }, { b: 2 }, 'k2', syncFn2, 3);
    addToRetryQueue('drain3', { collection: 'c3' }, { c: 3 }, 'k3', syncFn3, 0); // maxRetries=0, will fail

    expect(getRetryQueueSize()).toBe(3);

    const result = await drainRetryQueue();

    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(syncFn1).toHaveBeenCalledTimes(1);
    expect(syncFn2).toHaveBeenCalledTimes(1);
    expect(syncFn3).toHaveBeenCalledTimes(0); // maxRetries=0이므로 호출 안 됨
  });

  it('drainRetryQueue returns zeros when queue is empty', async () => {
    clearRetryQueue();
    expect(getRetryQueueSize()).toBe(0);

    const result = await drainRetryQueue();

    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('getRetryQueueSize returns correct count', () => {
    clearRetryQueue();
    expect(getRetryQueueSize()).toBe(0);

    addToRetryQueue('size1', { collection: 'c' }, {}, 'k1', async () => {}, 3);
    expect(getRetryQueueSize()).toBe(1);

    addToRetryQueue('size2', { collection: 'c' }, {}, 'k2', async () => {}, 3);
    expect(getRetryQueueSize()).toBe(2);

    clearRetryQueue();
    expect(getRetryQueueSize()).toBe(0);
  });

  it('drain removes successful items from queue', async () => {
    clearRetryQueue();

    const syncFn = vi.fn(async () => { /* success */ });
    addToRetryQueue('drainRemove1', { collection: 'c' }, {}, 'k', syncFn, 3);

    expect(getRetryQueueSize()).toBe(1);

    await drainRetryQueue();

    expect(getRetryQueueSize()).toBe(0);
  });
});
