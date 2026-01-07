import { describe, expect, it, vi } from 'vitest';

import { createRtdbBackfillManager } from '@/shared/services/sync/firebase/rtdbBackfill';
import type { FetchFromFirebaseFn } from '@/shared/services/sync/firebase/rtdbBackfill';
import type { SyncStrategy } from '@/shared/services/sync/firebase/syncCore';

type TestData = Readonly<{ value: number }>;

const makeStrategy = (collection: string, userId = 'user1'): SyncStrategy<TestData> => ({
  collection,
  getUserId: () => userId,
});

describe('rtdbBackfill', () => {
  it('dedupes concurrent backfills for the same key', async () => {
    const fetchFromFirebase: FetchFromFirebaseFn = async <T>() => ({ value: 123 } as unknown as T);
    const fetchSpy = vi.fn(fetchFromFirebase);

    const mgr = createRtdbBackfillManager({
      fetchFromFirebase: fetchSpy as unknown as FetchFromFirebaseFn,
    });

    const strategy = makeStrategy('dailyData');

    const [a, b, c] = await Promise.all([
      mgr.backfillKeyOnce(strategy, '2026-01-01'),
      mgr.backfillKeyOnce(strategy, '2026-01-01'),
      mgr.backfillKeyOnce(strategy, '2026-01-01'),
    ]);

    expect(a).toEqual({ value: 123 });
    expect(b).toEqual({ value: 123 });
    expect(c).toEqual({ value: 123 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe different keys', async () => {
    const fetchFromFirebase: FetchFromFirebaseFn = async <T>(_strategy: SyncStrategy<T>, key?: string) =>
      ({ value: key === 'a' ? 1 : 2 } as unknown as T);
    const fetchSpy = vi.fn(fetchFromFirebase);

    const mgr = createRtdbBackfillManager({
      fetchFromFirebase: fetchSpy as unknown as FetchFromFirebaseFn,
    });

    const strategy = makeStrategy('dailyData');

    const [a, b] = await Promise.all([
      mgr.backfillKeyOnce(strategy, 'a'),
      mgr.backfillKeyOnce(strategy, 'b'),
    ]);

    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('allows retry after a failure (inFlight cleared)', async () => {
    let callCount = 0;
    const fetchFromFirebase: FetchFromFirebaseFn = async <T>() => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('boom');
      }
      return { value: 9 } as unknown as T;
    };
    const fetchSpy = vi.fn(fetchFromFirebase);

    const mgr = createRtdbBackfillManager({
      fetchFromFirebase: fetchSpy as unknown as FetchFromFirebaseFn,
    });

    const strategy = makeStrategy('dailyData');

    await expect(mgr.backfillKeyOnce(strategy, '2026-01-02')).rejects.toThrow('boom');

    await expect(mgr.backfillKeyOnce(strategy, '2026-01-02')).resolves.toEqual({ value: 9 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
