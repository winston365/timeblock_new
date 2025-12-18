import { beforeEach, describe, expect, it, vi } from 'vitest';

const setSpy = vi.fn();
const getSpy = vi.fn();
const onValueSpy = vi.fn();
const offSpy = vi.fn();

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  set: setSpy,
  get: getSpy,
  onValue: onValueSpy,
  off: offSpy,
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
vi.mock('@/shared/services/sync/firebase/syncRetryQueue', () => ({
  addToRetryQueue: addToRetryQueueSpy,
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

  it('syncToFirebase skips duplicate syncs by hash', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);

    getSpy.mockResolvedValue({ val: () => null });

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');
    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');

    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('syncToFirebase skips upload when remote newer per resolver', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);

    // Remote data exists, and resolver will choose remote by having newer updatedAt.
    getSpy.mockResolvedValue({
      val: () => ({ data: { a: 9 }, updatedAt: 999, deviceId: 'remoteDevice' }),
    });

    const { syncToFirebase } = await import('@/shared/services/sync/firebase/syncCore');

    await syncToFirebase({ collection: 'c' }, { a: 1 }, 'k');

    expect(setSpy).not.toHaveBeenCalled();
    expect(addSyncLogSpy).toHaveBeenCalled();
  });

  it('syncToFirebase catches errors and enqueues retry without throwing', async () => {
    vi.resetModules();

    isFirebaseInitializedSpy.mockReturnValue(true);

    getSpy.mockResolvedValue({ val: () => null });
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
});
