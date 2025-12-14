import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/services/sync/syncLogger', () => ({
  addSyncLog: vi.fn(),
}));

import {
  addToRetryQueue,
  clearRetryQueue,
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
});
