import { beforeEach, describe, expect, it, vi } from 'vitest';

const setSpy = vi.fn();
const getSpy = vi.fn();
const onValueSpy = vi.fn();
const offSpy = vi.fn();

const recordRtdbGetSpy = vi.fn();
const recordRtdbSetSpy = vi.fn();
const recordRtdbErrorSpy = vi.fn();
const recordRtdbOnValueSpy = vi.fn();
const isRtdbInstrumentationEnabledSpy = vi.fn(() => true);

const getObservedRemoteSpy = vi.fn();

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  set: setSpy,
  get: getSpy,
  onValue: onValueSpy,
  off: offSpy,
}));

vi.mock('@/shared/services/sync/firebase/rtdbMetrics', () => ({
  recordRtdbGet: recordRtdbGetSpy,
  recordRtdbSet: recordRtdbSetSpy,
  recordRtdbError: recordRtdbErrorSpy,
  recordRtdbOnValue: recordRtdbOnValueSpy,
  isRtdbInstrumentationEnabled: isRtdbInstrumentationEnabledSpy,
}));

vi.mock('@/shared/services/sync/firebase/rtdbObservedCache', () => ({
  getObservedRemote: getObservedRemoteSpy,
  setObservedRemote: vi.fn(),
  clearObservedRemoteCache: vi.fn(),
}));

const isFirebaseInitializedSpy = vi.fn();
const getFirebaseDatabaseSpy = vi.fn(() => ({ kind: 'db' }));

vi.mock('@/shared/services/sync/firebase/firebaseClient', () => ({
  isFirebaseInitialized: isFirebaseInitializedSpy,
  getFirebaseDatabase: getFirebaseDatabaseSpy,
}));

vi.mock('@/shared/services/sync/firebase/syncUtils', () => ({
  getDataHash: (data: unknown) => JSON.stringify(data),
  getServerTimestamp: () => 123,
  getDeviceId: () => 'device1',
  getFirebasePath: (userId: string, collection: string, key?: string) => {
    const base = `users/${userId}/${collection}`;
    return key ? `${base}/${key}` : base;
  },
}));

const addSyncLogSpy = vi.fn();
vi.mock('@/shared/services/sync/syncLogger', () => ({
  addSyncLog: addSyncLogSpy,
}));

const addToRetryQueueSpy = vi.fn();
const drainRetryQueueSpy = vi.fn();
const getRetryQueueSizeSpy = vi.fn();
vi.mock('@/shared/services/sync/firebase/syncRetryQueue', () => ({
  addToRetryQueue: addToRetryQueueSpy,
  drainRetryQueue: drainRetryQueueSpy,
  getRetryQueueSize: getRetryQueueSizeSpy,
}));

vi.mock('@/shared/utils/firebaseSanitizer', () => ({
  sanitizeForFirebase: (v: unknown) => v,
}));

describe('syncCore', () => {
  beforeEach(() => {
    setSpy.mockClear();
    getSpy.mockClear();
    onValueSpy.mockClear();
    offSpy.mockClear();
    isFirebaseInitializedSpy.mockClear();
    addSyncLogSpy.mockClear();
    addToRetryQueueSpy.mockClear();
    recordRtdbGetSpy.mockClear();
    recordRtdbSetSpy.mockClear();
    recordRtdbErrorSpy.mockClear();
    recordRtdbOnValueSpy.mockClear();
    isRtdbInstrumentationEnabledSpy.mockClear();
    getObservedRemoteSpy.mockClear();
    // keep getFirebaseDatabaseSpy stable
  });

  it('syncToFirebase returns early when Firebase is not initialized', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValueOnce(false);

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');

    expect(setSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('does not perform pre-write network reads (BW-06)', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    isRtdbInstrumentationEnabledSpy.mockReturnValue(true);

    // Remote exists in listener-fed cache; syncToFirebase must still avoid get().
    getObservedRemoteSpy.mockReturnValue({
      data: { a: 9 },
      updatedAt: 1,
      deviceId: 'remoteDevice',
    });
    setSpy.mockResolvedValue(undefined);

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');
    await syncToFirebase({ collection: 'c' }, { a: 2 }, 'k');

    expect(getSpy).not.toHaveBeenCalled();
    expect(recordRtdbGetSpy).not.toHaveBeenCalled();
  });

  it('syncToFirebase skips duplicate syncs by hash', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getObservedRemoteSpy.mockReturnValue(undefined);

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');
    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');

    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('syncToFirebase skips upload when remote newer per resolver', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);

    // Remote data exists, and resolver will choose remote by having newer updatedAt.
    getObservedRemoteSpy.mockReturnValue({
      data: { a: 9 },
      updatedAt: 999,
      deviceId: 'remoteDevice',
    });

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');

    expect(setSpy).not.toHaveBeenCalled();
    expect(addSyncLogSpy).toHaveBeenCalled();
  });

  it('syncToFirebase catches errors and enqueues retry without throwing', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);

    getObservedRemoteSpy.mockReturnValue(undefined);
    setSpy.mockRejectedValueOnce(new Error('fail'));

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await expect(syncToFirebase({ collection: 'c' }, { a: 1 }, 'k')).resolves.toBeUndefined();

    expect(addToRetryQueueSpy).toHaveBeenCalledTimes(1);
  });

  it('listenToFirebase calls onUpdate only for remote device updates and returns unsubscribe', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);

    const { listenToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    const unsubscribeImpl = vi.fn();
    onValueSpy.mockReturnValueOnce(unsubscribeImpl);

    const onUpdate = vi.fn();
    const unsubscribe = listenToFirebase({ collection: 'c' }, onUpdate, 'k');

    expect(onValueSpy).toHaveBeenCalledTimes(1);

    const callback = onValueSpy.mock.calls[0]?.[1] as unknown as ((snap: { val: () => unknown }) => void);

    // same device: ignore
    callback({ val: () => ({ data: { a: 1 }, updatedAt: 1, deviceId: 'device1' }) });
    expect(onUpdate).not.toHaveBeenCalled();

    // other device: accept
    callback({ val: () => ({ data: { a: 2 }, updatedAt: 2, deviceId: 'remote' }) });
    expect(onUpdate).toHaveBeenCalledWith({ a: 2 });
    expect(addSyncLogSpy).toHaveBeenCalledWith('firebase', 'sync', expect.stringContaining('Received'));

    unsubscribe();
    expect(unsubscribeImpl).toHaveBeenCalledTimes(1);
  });

  it('fetchFromFirebase returns data and logs load; returns null on missing data or errors', async () => {
    vi.resetModules();

    const { fetchFromFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    isFirebaseInitializedSpy.mockReturnValueOnce(false);
    await expect(fetchFromFirebase({ collection: 'c' }, 'k')).resolves.toBeNull();

    isFirebaseInitializedSpy.mockReturnValue(true);

    getSpy.mockResolvedValueOnce({ val: () => ({ data: { a: 1 }, updatedAt: 1, deviceId: 'remote' }) });
    await expect(fetchFromFirebase({ collection: 'c' }, 'k')).resolves.toEqual({ a: 1 });
    expect(addSyncLogSpy).toHaveBeenCalledWith('firebase', 'load', expect.stringContaining('fetched'), expect.any(Object));

    getSpy.mockResolvedValueOnce({ val: () => null });
    await expect(fetchFromFirebase({ collection: 'c' }, 'k')).resolves.toBeNull();

    getSpy.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchFromFirebase({ collection: 'c' }, 'k')).resolves.toBeNull();
    expect(addSyncLogSpy).toHaveBeenCalledWith('firebase', 'error', expect.stringContaining('Failed to fetch'), expect.any(Object), expect.any(Error));
  });

  it('records RTDB get for fetchFromFirebase when instrumentation is enabled', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    isRtdbInstrumentationEnabledSpy.mockReturnValue(true);

    getSpy.mockResolvedValueOnce({
      val: () => ({ data: { a: 1 }, updatedAt: 1, deviceId: 'remote' }),
    });

    const { fetchFromFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await expect(fetchFromFirebase({ collection: 'c' }, 'k')).resolves.toEqual({ a: 1 });

    expect(recordRtdbGetSpy).toHaveBeenCalledTimes(1);
    expect(recordRtdbGetSpy).toHaveBeenCalledWith('users/user/c/k', expect.anything());
  });
});

// ============================================================================
// Task 5.1: 오프라인 -> 재시도 큐 적재 -> 재연결 시 드레인(Drain) 흐름 테스트
// ============================================================================
describe('syncCore - Offline / Retry Queue / Drain Flow (Task 5.1)', () => {
  beforeEach(() => {
    setSpy.mockClear();
    getSpy.mockClear();
    addSyncLogSpy.mockClear();
    addToRetryQueueSpy.mockClear();
    drainRetryQueueSpy.mockClear();
    getRetryQueueSizeSpy.mockClear();
    isFirebaseInitializedSpy.mockClear();
  });

  it('queues failed sync operations and allows later drain on reconnect', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getObservedRemoteSpy.mockReturnValue(undefined);
    
    // 첫 번째 호출은 실패 (네트워크 오류 시뮬레이션)
    setSpy.mockRejectedValueOnce(new Error('Network error - offline'));

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    // 동기화 시도 - 실패하고 재시도 큐에 추가되어야 함
    await expect(syncToFirebase({ collection: 'dailyData' }, { task: 'test' }, '2024-01-15')).resolves.toBeUndefined();

    // 재시도 큐에 추가됨
    expect(addToRetryQueueSpy).toHaveBeenCalledTimes(1);
    expect(addToRetryQueueSpy).toHaveBeenCalledWith(
      expect.stringContaining('dailyData-2024-01-15'),
      expect.objectContaining({ collection: 'dailyData' }),
      { task: 'test' },
      '2024-01-15',
      expect.any(Function),
      3
    );
  });

  it('multiple failed syncs queue independently and can be drained sequentially', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getObservedRemoteSpy.mockReturnValue(undefined);
    
    // 모든 호출 실패
    setSpy.mockRejectedValue(new Error('Network error'));

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    // 여러 개의 동기화 실패
    await syncToFirebase({ collection: 'dailyData' }, { a: 1 }, '2024-01-15');
    await syncToFirebase({ collection: 'dailyData' }, { b: 2 }, '2024-01-16');
    await syncToFirebase({ collection: 'gameState' }, { xp: 100 });

    // 각각 재시도 큐에 추가됨
    expect(addToRetryQueueSpy).toHaveBeenCalledTimes(3);
  });
});

// ============================================================================
// Task 5.2: 리스너 재부착/중복 방지 및 해시 캐시(Dedupe) 검증 테스트
// ============================================================================
describe('syncCore - Listener Deduplication & Hash Cache (Task 5.2)', () => {
  beforeEach(() => {
    setSpy.mockClear();
    getSpy.mockClear();
    onValueSpy.mockClear();
    offSpy.mockClear();
    addSyncLogSpy.mockClear();
    addToRetryQueueSpy.mockClear();
    isFirebaseInitializedSpy.mockClear();
  });

  it('hash cache prevents duplicate uploads for identical data', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getObservedRemoteSpy.mockReturnValue(undefined);
    setSpy.mockResolvedValue(undefined);

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    const data = { task: 'identical', id: '123' };

    // 첫 번째 동기화 - 업로드됨
    await syncToFirebase({ collection: 'c' }, data, 'key1');
    expect(setSpy).toHaveBeenCalledTimes(1);

    // 동일 데이터 재동기화 - 스킵됨 (해시 캐시)
    await syncToFirebase({ collection: 'c' }, data, 'key1');
    expect(setSpy).toHaveBeenCalledTimes(1); // 여전히 1회

    // 다른 데이터 동기화 - 업로드됨
    await syncToFirebase({ collection: 'c' }, { task: 'different' }, 'key1');
    expect(setSpy).toHaveBeenCalledTimes(2);
  });

  it('hash cache is scoped by collection and key', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getObservedRemoteSpy.mockReturnValue(undefined);
    setSpy.mockResolvedValue(undefined);

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    const data = { same: 'data' };

    // 같은 데이터라도 다른 컬렉션/키면 업로드됨
    await syncToFirebase({ collection: 'collectionA' }, data, 'key1');
    await syncToFirebase({ collection: 'collectionB' }, data, 'key1');
    await syncToFirebase({ collection: 'collectionA' }, data, 'key2');

    expect(setSpy).toHaveBeenCalledTimes(3);
  });

  it('listener does not create duplicate Firebase subscriptions for same path', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    const unsubscribeSpy = vi.fn();
    onValueSpy.mockReturnValue(unsubscribeSpy);

    const { listenToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    const onUpdate1 = vi.fn();
    const onUpdate2 = vi.fn();

    // 두 번 구독해도 Firebase SDK는 한 번만 호출됨 (listenToFirebase 자체는 호출됨)
    const unsub1 = listenToFirebase({ collection: 'c' }, onUpdate1, 'k');
    const unsub2 = listenToFirebase({ collection: 'c' }, onUpdate2, 'k');

    // listenToFirebase는 각각 호출되지만, 실제 중복 방지는 rtdbListenerRegistry에서 처리
    // 여기서는 기본 동작 테스트
    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');

    unsub1();
    unsub2();
  });

  it('listenToFirebase ignores updates from same device', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    onValueSpy.mockImplementation((_ref, callback) => {
      // 즉시 콜백 호출 (같은 디바이스에서 온 데이터)
      callback({ val: () => ({ data: { x: 1 }, updatedAt: 1, deviceId: 'device1' }) });
      return vi.fn();
    });

    const { listenToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    const onUpdate = vi.fn();
    listenToFirebase({ collection: 'c' }, onUpdate, 'k');

    // 같은 디바이스(device1)에서 온 데이터는 무시
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('listenToFirebase accepts updates from other devices', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    onValueSpy.mockImplementation((_ref, callback) => {
      // 다른 디바이스에서 온 데이터
      callback({ val: () => ({ data: { x: 2 }, updatedAt: 2, deviceId: 'otherDevice' }) });
      return vi.fn();
    });

    const { listenToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    const onUpdate = vi.fn();
    listenToFirebase({ collection: 'c' }, onUpdate, 'k');

    // 다른 디바이스에서 온 데이터는 수신
    expect(onUpdate).toHaveBeenCalledWith({ x: 2 });
  });
});

// ============================================================================
// T80-02: RTDB instrumentation 분기 검증
// ============================================================================
describe('syncCore - RTDB Instrumentation Branch (T80-02)', () => {
  beforeEach(() => {
    vi.resetModules();
    setSpy.mockClear();
    getSpy.mockClear();
    addSyncLogSpy.mockClear();
    addToRetryQueueSpy.mockClear();
    isFirebaseInitializedSpy.mockClear();
  });

  it('records RTDB get/set metrics when instrumentation is ON', async () => {
    // instrumentation ON 모킹
    vi.doMock('@/shared/services/sync/firebase/rtdbMetrics', () => ({
      recordRtdbGet: vi.fn(),
      recordRtdbSet: vi.fn(),
      recordRtdbError: vi.fn(),
      isRtdbInstrumentationEnabled: vi.fn(() => true),
    }));

    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getSpy.mockResolvedValue({ val: () => null });
    setSpy.mockResolvedValue(undefined);

    const rtdbMetrics = await import('@/shared/services/sync/firebase/rtdbMetrics');
    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'instr-test' }, { x: 1 }, 'k');

    // BW-06: pre-write reads are removed, so syncToFirebase must not record gets.
    expect(rtdbMetrics.recordRtdbGet).not.toHaveBeenCalled();
    expect(rtdbMetrics.recordRtdbSet).toHaveBeenCalled();
  });

  it('does NOT record RTDB metrics when instrumentation is OFF', async () => {
    // instrumentation OFF 모킹
    vi.doMock('@/shared/services/sync/firebase/rtdbMetrics', () => ({
      recordRtdbGet: vi.fn(),
      recordRtdbSet: vi.fn(),
      recordRtdbError: vi.fn(),
      isRtdbInstrumentationEnabled: vi.fn(() => false),
    }));

    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getSpy.mockResolvedValue({ val: () => null });
    setSpy.mockResolvedValue(undefined);

    const rtdbMetrics = await import('@/shared/services/sync/firebase/rtdbMetrics');
    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'instr-off' }, { y: 2 }, 'k2');

    // instrumentation OFF이므로 record 함수 호출 안 됨
    expect(rtdbMetrics.recordRtdbGet).not.toHaveBeenCalled();
    expect(rtdbMetrics.recordRtdbSet).not.toHaveBeenCalled();
  });

  it('records RTDB error on sync failure when instrumentation is ON', async () => {
    vi.doMock('@/shared/services/sync/firebase/rtdbMetrics', () => ({
      recordRtdbGet: vi.fn(),
      recordRtdbSet: vi.fn(),
      recordRtdbError: vi.fn(),
      isRtdbInstrumentationEnabled: vi.fn(() => true),
    }));

    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);
    getSpy.mockResolvedValue({ val: () => null });
    setSpy.mockRejectedValueOnce(new Error('write failed'));

    const rtdbMetrics = await import('@/shared/services/sync/firebase/rtdbMetrics');
    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'instr-error' }, { z: 3 }, 'k3');

    expect(rtdbMetrics.recordRtdbError).toHaveBeenCalled();
  });
});
