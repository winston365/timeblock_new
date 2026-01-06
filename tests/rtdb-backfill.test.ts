import { describe, expect, it, vi } from 'vitest';

import { createRtdbBackfillManager } from '@/shared/services/sync/firebase/rtdbBackfill';
import type { SyncStrategy } from '@/shared/services/sync/firebase/syncCore';

type TestData = Readonly<{ value: number }>;

const makeStrategy = (collection: string, userId = 'user1'): SyncStrategy<TestData> => ({
  collection,
  getUserId: () => userId,
});

describe('rtdbBackfill', () => {
  it('dedupes concurrent backfills for the same key', async () => {
    const fetchSpy = vi.fn(async () => ({ value: 123 } as const));

    const mgr = createRtdbBackfillManager({
      fetchFromFirebase: fetchSpy,
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
    const fetchSpy = vi.fn(async (_strategy: SyncStrategy<TestData>, key?: string) => ({
      value: key === 'a' ? 1 : 2,
    }));

    const mgr = createRtdbBackfillManager({
      fetchFromFirebase: fetchSpy,
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
    const fetchSpy = vi
      .fn<(
        strategy: SyncStrategy<TestData>,
        key?: string
      ) => Promise<TestData | null>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ value: 9 });

    const mgr = createRtdbBackfillManager({
      fetchFromFirebase: fetchSpy,
    });

    const strategy = makeStrategy('dailyData');

    await expect(mgr.backfillKeyOnce(strategy, '2026-01-02')).rejects.toThrow('boom');

    await expect(mgr.backfillKeyOnce(strategy, '2026-01-02')).resolves.toEqual({ value: 9 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
