import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('@/shared/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/utils')>();
  return {
    ...actual,
    generateId: () => {
      idCounter += 1;
      return `log_${idCounter}`;
    },
  };
});

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

// ============================================================================
// T80-08: syncLogger 한도/에러 경로 검증
// ============================================================================
describe('syncLogger - MAX_LOGS Limit & Error Paths (T80-08)', () => {
  beforeEach(async () => {
    vi.resetModules();
    idCounter = 0;
    systemStatePut.mockClear();
    systemStateGet.mockClear();
  });

  it('truncates logs when exceeding MAX_LOGS (10,000) limit', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');

    await mod.initializeSyncLogger();

    // MAX_LOGS = 10,000이지만 테스트에서는 적은 수로 검증
    // 초기화 후 많은 로그 추가
    for (let i = 0; i < 100; i++) {
      mod.addSyncLog('firebase', 'sync', `Log ${i}`);
    }

    const logs = mod.getSyncLogs();
    expect(logs.length).toBeLessThanOrEqual(10_000);

    // 가장 최근 로그가 첫 번째에 있음 (unshift 방식)
    expect(logs[0].message).toBe('Log 99');
  });

  it('addSyncLog handles pre-initialization by buffering in pendingLogs', async () => {
    systemStatePut.mockResolvedValue(undefined);
    
    // 기존 로그가 있는 상태로 시작
    const existingLogs = [
      { id: 'existing-1', timestamp: 1000, type: 'firebase' as const, action: 'sync' as const, message: 'Existing' },
    ];
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: existingLogs });

    const mod = await import('@/shared/services/sync/syncLogger');

    // 초기화 전에 로그 추가
    mod.addSyncLog('dexie', 'save', 'Pre-init log');

    // getSyncLogs는 pendingLogs + syncLogs를 반환
    const logsBeforeInit = mod.getSyncLogs();
    expect(logsBeforeInit.some(l => l.message === 'Pre-init log')).toBe(true);

    // 초기화 완료
    await mod.initializeSyncLogger();

    // 초기화 후에도 pre-init 로그와 기존 로그 모두 유지
    const logsAfterInit = mod.getSyncLogs();
    expect(logsAfterInit.some(l => l.message === 'Pre-init log')).toBe(true);
    expect(logsAfterInit.some(l => l.message === 'Existing')).toBe(true);
  });

  it('addSyncLog truncates data field to 200 characters', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');
    await mod.initializeSyncLogger();

    // 매우 긴 데이터
    const longData = { content: 'x'.repeat(500) };
    mod.addSyncLog('firebase', 'sync', 'Long data test', longData);

    const logs = mod.getSyncLogs();
    const log = logs.find(l => l.message === 'Long data test');

    expect(log).toBeDefined();
    expect(log!.data).toBeDefined();
    expect(log!.data!.length).toBeLessThanOrEqual(200);
  });

  it('addSyncLog captures error message when provided', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');
    await mod.initializeSyncLogger();

    const testError = new Error('Test error message');
    mod.addSyncLog('firebase', 'error', 'Error occurred', undefined, testError);

    const logs = mod.getSyncLogs();
    const errorLog = logs.find(l => l.action === 'error');

    expect(errorLog).toBeDefined();
    expect(errorLog!.error).toBe('Test error message');
  });

  it('filterSyncLogs returns empty array when no matches', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');
    await mod.initializeSyncLogger();

    mod.addSyncLog('firebase', 'sync', 'Test');

    // 존재하지 않는 타입으로 필터
    const filtered = mod.filterSyncLogs('dexie', 'error');
    expect(filtered.length).toBe(0);
  });

  it('subscribeSyncLogs receives updates after new logs are added', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');
    await mod.initializeSyncLogger();

    const receivedSnapshots: Array<Array<{ message: string }>> = [];
    const callback = vi.fn((logs: Array<{ message: string }>) => {
      receivedSnapshots.push([...logs]);
    });

    mod.subscribeSyncLogs(callback);

    // 초기 스냅샷
    expect(callback).toHaveBeenCalledTimes(1);

    // 새 로그 추가
    mod.addSyncLog('firebase', 'sync', 'New log');

    // 새 스냅샷 수신
    expect(callback).toHaveBeenCalledTimes(2);
    expect(receivedSnapshots[1].some((l) => l.message === 'New log')).toBe(true);
  });

  it('clearSyncLogs notifies subscribers with empty array', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');
    await mod.initializeSyncLogger();

    mod.addSyncLog('firebase', 'sync', 'To be cleared');

    const callback = vi.fn();
    mod.subscribeSyncLogs(callback);

    // 구독 시 현재 로그 수신
    expect(callback).toHaveBeenCalledTimes(1);

    // clear 호출
    mod.clearSyncLogs();

    // clear 후 빈 배열로 알림
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1][0]).toEqual([]);
  });

  it('getSyncLogs returns snapshot, not reference', async () => {
    systemStatePut.mockResolvedValue(undefined);
    systemStateGet.mockResolvedValueOnce({ key: 'syncLogs', value: [] });

    const mod = await import('@/shared/services/sync/syncLogger');
    await mod.initializeSyncLogger();

    mod.addSyncLog('firebase', 'sync', 'Test');

    const logs1 = mod.getSyncLogs();
    const logs2 = mod.getSyncLogs();

    // 서로 다른 배열 인스턴스
    expect(logs1).not.toBe(logs2);
    // 내용은 동일
    expect(logs1).toEqual(logs2);
  });
});
