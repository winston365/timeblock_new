import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure any toast side-effects are harmless during tests
vi.mock('@/shared/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}));

describe('SyncEngine basic smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initialize is idempotent after DB init', async () => {
    const { initializeDatabase } = await import('@/data/db');
    const { syncEngine } = await import('@/shared/services/sync/syncEngine');

    await initializeDatabase();

    expect(() => syncEngine.initialize()).not.toThrow();
    expect(() => syncEngine.initialize()).not.toThrow();
  });

  it('applyRemoteUpdate executes callback and drains queue', async () => {
    const { initializeDatabase } = await import('@/data/db');
    const { syncEngine } = await import('@/shared/services/sync/syncEngine');
    const { createInitialGameState, saveGameState } = await import('@/data/repositories/gameStateRepository');

    await initializeDatabase();
    syncEngine.initialize();

    await syncEngine.applyRemoteUpdate(async () => {
      await saveGameState(createInitialGameState());
    }, 'gameState:current');

    expect(syncEngine.getPendingOperationsCount()).toBe(0);
  });
});
