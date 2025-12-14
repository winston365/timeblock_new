import { describe, expect, it, vi } from 'vitest';

const systemStateGet = vi.fn();
const systemStatePut = vi.fn();

vi.mock('@/data/db/dexieClient', () => ({
  db: {
    systemState: {
      get: systemStateGet,
      put: systemStatePut,
    },
  },
}));

let idCounter = 0;
vi.mock('@/shared/lib/utils', () => ({
  generateId: () => {
    idCounter += 1;
    return `log_${idCounter}`;
  },
}));

describe('syncLogger', () => {
  it('buffers logs before initialization and merges after init', async () => {
    vi.resetModules();
    idCounter = 0;

    systemStatePut.mockResolvedValue(undefined);

    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');

    mod.addSyncLog('firebase', 'sync', 'm1', { a: 1 });
    expect(mod.getSyncLogs().length).toBeGreaterThan(0);

    await mod.initializeSyncLogger();

    const logs = mod.getSyncLogs();
    expect(logs[0]?.message).toBe('m1');
    expect(systemStatePut).toHaveBeenCalled();
  });

  it('subscribeSyncLogs immediately emits a snapshot and can unsubscribe', async () => {
    vi.resetModules();
    idCounter = 0;

    systemStatePut.mockResolvedValue(undefined);

    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');

    const cb = vi.fn();
    const unsub = mod.subscribeSyncLogs(cb);

    expect(cb).toHaveBeenCalledTimes(1);

    unsub();

    mod.addSyncLog('firebase', 'info', 'm2');

    // unsubscribed: no further calls
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('filterSyncLogs filters by type/action/since', async () => {
    vi.resetModules();
    idCounter = 0;

    systemStatePut.mockResolvedValue(undefined);

    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');

    const base = Date.now();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(base - 10)
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 10);

    mod.addSyncLog('firebase', 'sync', 'a');
    mod.addSyncLog('dexie', 'save', 'b');
    mod.addSyncLog('firebase', 'error', 'c');

    const onlyFirebase = mod.filterSyncLogs('firebase');
    expect(onlyFirebase.every((l) => l.type === 'firebase')).toBe(true);

    const onlyError = mod.filterSyncLogs(undefined, 'error');
    expect(onlyError.every((l) => l.action === 'error')).toBe(true);

    const since = mod.filterSyncLogs(undefined, undefined, base);
    expect(since.every((l) => l.timestamp >= base)).toBe(true);

    (Date.now as unknown as { mockRestore: () => void }).mockRestore?.();
  });

  it('clearSyncLogs empties logs', async () => {
    vi.resetModules();
    idCounter = 0;

    systemStatePut.mockResolvedValue(undefined);

    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');

    mod.addSyncLog('firebase', 'sync', 'a');
    expect(mod.getSyncLogs().length).toBeGreaterThan(0);

    mod.clearSyncLogs();
    expect(mod.getSyncLogs().length).toBe(0);
  });
});
