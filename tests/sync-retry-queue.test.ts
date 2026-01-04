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

// ============================================================================
// T80-03: 오프라인→온라인 재연결 시 drainRetryQueue 소모 검증
// ============================================================================
describe('syncRetryQueue - Offline→Online Reconnect Drain (T80-03)', () => {
  beforeEach(() => {
    clearRetryQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearRetryQueue();
  });

  it('simulates offline: failed writes enqueue, reconnect drains queue', async () => {
    // 시나리오: 네트워크 끊김 → 3개 write 실패 → 큐 적재 → 재연결 → drain 호출 → 성공
    const syncFn1 = vi.fn(async () => { /* 재연결 후 성공 */ });
    const syncFn2 = vi.fn(async () => { /* 재연결 후 성공 */ });
    const syncFn3 = vi.fn(async () => { /* 재연결 후 성공 */ });

    // 오프라인 상태에서 실패한 작업들이 큐에 추가됨
    addToRetryQueue('offline-task-1', { collection: 'dailyData' }, { task: 'a' }, '2024-01-15', syncFn1, 3);
    addToRetryQueue('offline-task-2', { collection: 'dailyData' }, { task: 'b' }, '2024-01-16', syncFn2, 3);
    addToRetryQueue('offline-task-3', { collection: 'gameState' }, { xp: 100 }, undefined, syncFn3, 3);

    expect(getRetryQueueSize()).toBe(3);

    // 재연결 시 drainRetryQueue 호출
    const result = await drainRetryQueue();

    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
    expect(getRetryQueueSize()).toBe(0);

    // 각 syncFn이 한 번씩 호출됨
    expect(syncFn1).toHaveBeenCalledTimes(1);
    expect(syncFn2).toHaveBeenCalledTimes(1);
    expect(syncFn3).toHaveBeenCalledTimes(1);
  });

  it('drain handles partial success: some items succeed, others fail', async () => {
    const successFn = vi.fn(async () => { /* success */ });
    const failFn = vi.fn(async () => { throw new Error('still offline'); });

    addToRetryQueue('partial-1', { collection: 'c1' }, {}, 'k1', successFn, 3);
    addToRetryQueue('partial-2', { collection: 'c2' }, {}, 'k2', failFn, 1); // 1회 재시도 후 실패
    addToRetryQueue('partial-3', { collection: 'c3' }, {}, 'k3', successFn, 3);

    expect(getRetryQueueSize()).toBe(3);

    const result = await drainRetryQueue();

    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    
    // 실패한 항목도 maxRetries 초과로 큐에서 제거됨
    expect(getRetryQueueSize()).toBe(0);
  });

  it('drain preserves order: items processed sequentially', async () => {
    const order: string[] = [];

    const makeSyncFn = (id: string) => vi.fn(async () => {
      order.push(id);
    });

    addToRetryQueue('order-a', { collection: 'c' }, {}, 'a', makeSyncFn('a'), 3);
    addToRetryQueue('order-b', { collection: 'c' }, {}, 'b', makeSyncFn('b'), 3);
    addToRetryQueue('order-c', { collection: 'c' }, {}, 'c', makeSyncFn('c'), 3);

    await drainRetryQueue();

    // Map의 삽입 순서대로 처리
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('multiple drains: second drain on empty queue is no-op', async () => {
    const syncFn = vi.fn(async () => { /* success */ });
    addToRetryQueue('multi-drain', { collection: 'c' }, {}, 'k', syncFn, 3);

    const result1 = await drainRetryQueue();
    expect(result1.success).toBe(1);
    expect(syncFn).toHaveBeenCalledTimes(1);

    // 두 번째 drain: 큐가 비어있음
    const result2 = await drainRetryQueue();
    expect(result2.success).toBe(0);
    expect(result2.failed).toBe(0);
    expect(syncFn).toHaveBeenCalledTimes(1); // 추가 호출 없음
  });
});
