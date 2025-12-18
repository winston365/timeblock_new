import { describe, it, expect, vi } from 'vitest';

describe('Infra re-export smoke', () => {
  it('syncEngine re-export points to infra singleton', async () => {
    const shared = await import('@/shared/services/sync/syncEngine');
    const infra = await import('@/data/db/infra/syncEngine');

    expect(shared.syncEngine).toBe(infra.syncEngine);
    expect(shared.SyncEngine).toBe(infra.SyncEngine);
    expect(shared.syncEngine).toBe(infra.SyncEngine.getInstance());
  });

  it('ragSyncHandler re-export points to infra singleton', async () => {
    // Prevent accidental network calls during module evaluation
    vi.mock('@/shared/services/rag/ragService', () => ({
      ragService: {
        initialize: vi.fn(),
        indexDocument: vi.fn().mockResolvedValue(undefined),
        getCacheStats: vi.fn().mockResolvedValue({ count: 0, restoredFromCache: false }),
        resetIndexingStats: vi.fn(),
        getIndexingStats: vi.fn().mockReturnValue({ skipped: 0, indexed: 0 }),
      },
    }));
    vi.mock('@/data/repositories/dailyDataRepository', () => ({
      getRecentDailyData: vi.fn().mockResolvedValue([]),
    }));
    vi.mock('@/data/repositories/inboxRepository', () => ({
      loadInboxTasks: vi.fn().mockResolvedValue([]),
    }));

    const shared = await import('@/shared/services/rag/ragSyncHandler');
    const infra = await import('@/data/db/infra/ragSyncHandler');

    expect(shared.ragSyncHandler).toBe(infra.ragSyncHandler);
    expect(shared.RAGSyncHandler).toBe(infra.RAGSyncHandler);
    expect(shared.ragSyncHandler).toBe(infra.RAGSyncHandler.getInstance());
  });

  it('useAppInitialization re-export points to infra hook', async () => {
    const shared = await import('@/app/hooks/useAppInitialization');
    const infra = await import('@/data/db/infra/useAppInitialization');

    expect(typeof shared.useAppInitialization).toBe('function');
    expect(shared.useAppInitialization).toBe(infra.useAppInitialization);
  });
});
