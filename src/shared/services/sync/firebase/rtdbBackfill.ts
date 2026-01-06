import { fetchFromFirebase, type SyncStrategy } from './syncCore';

export type FetchFromFirebaseFn = <T>(strategy: SyncStrategy<T>, key?: string) => Promise<T | null>;

export type RtdbBackfillManager = Readonly<{
  /**
   * Performs a single-shot backfill `get()` for a specific key.
   *
   * - Dedupes concurrent calls for the same (userId, collection, key)
   * - Clears in-flight state after completion (success or failure)
   */
  backfillKeyOnce: <T>(strategy: SyncStrategy<T>, key: string) => Promise<T | null>;
}>;

type CreateRtdbBackfillManagerDeps = Readonly<{
  fetchFromFirebase: FetchFromFirebaseFn;
  getDefaultUserId: () => string;
}>;

const defaultDeps: CreateRtdbBackfillManagerDeps = {
  fetchFromFirebase,
  getDefaultUserId: () => 'user',
};

const getBackfillCacheKey = (params: {
  readonly userId: string;
  readonly collection: string;
  readonly key: string;
}): string => `${params.userId}:${params.collection}:${params.key}`;

export const createRtdbBackfillManager = (
  deps?: Partial<CreateRtdbBackfillManagerDeps>
): RtdbBackfillManager => {
  const resolvedDeps: CreateRtdbBackfillManagerDeps = {
    ...defaultDeps,
    ...deps,
  };

  const inFlight = new Map<string, Promise<unknown | null>>();

  const backfillKeyOnce = async <T>(strategy: SyncStrategy<T>, key: string): Promise<T | null> => {
    if (!key) {
      return null;
    }

    const userId = strategy.getUserId?.() ?? resolvedDeps.getDefaultUserId();

    const cacheKey = getBackfillCacheKey({
      userId,
      collection: strategy.collection,
      key,
    });

    const existing = inFlight.get(cacheKey) as Promise<T | null> | undefined;
    if (existing) {
      return existing;
    }

    const promise: Promise<T | null> = (async () => {
      try {
        return await resolvedDeps.fetchFromFirebase(strategy, key);
      } finally {
        inFlight.delete(cacheKey);
      }
    })();

    inFlight.set(cacheKey, promise as Promise<unknown | null>);

    return promise;
  };

  return {
    backfillKeyOnce,
  } as const;
};

export const rtdbBackfillManager = createRtdbBackfillManager();
