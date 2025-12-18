import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prevent any embedding/network activity
vi.mock('@/shared/services/rag/ragService', () => ({
  ragService: {
    initialize: vi.fn(),
    indexDocument: vi.fn().mockResolvedValue(undefined),
    getCacheStats: vi.fn().mockResolvedValue({ count: 0, restoredFromCache: false }),
    resetIndexingStats: vi.fn(),
    getIndexingStats: vi.fn().mockReturnValue({ skipped: 0, indexed: 0 }),
  },
}));

// Keep initial indexing fast and deterministic
vi.mock('@/data/repositories/dailyDataRepository', () => ({
  getRecentDailyData: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/data/repositories/inboxRepository', () => ({
  loadInboxTasks: vi.fn().mockResolvedValue([]),
}));

describe('RAGSyncHandler basic smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initialize registers hooks and kicks initial indexing (no throw)', async () => {
    const { initializeDatabase } = await import('@/data/db');
    await initializeDatabase();

    const { ragSyncHandler } = await import('@/shared/services/rag/ragSyncHandler');
    const { ragService } = await import('@/shared/services/rag/ragService');

    await expect(ragSyncHandler.initialize()).resolves.toBeUndefined();

    // runInitialIndexing() starts immediately (async, not awaited)
    await Promise.resolve();
    expect(ragService.getCacheStats).toHaveBeenCalled();
  });

  it('initialize is idempotent', async () => {
    const { initializeDatabase } = await import('@/data/db');
    await initializeDatabase();

    const { ragSyncHandler } = await import('@/shared/services/rag/ragSyncHandler');

    await expect(ragSyncHandler.initialize()).resolves.toBeUndefined();
    await expect(ragSyncHandler.initialize()).resolves.toBeUndefined();
  });
});
