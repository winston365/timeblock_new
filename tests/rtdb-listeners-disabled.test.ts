/**
 * @file RTDB Listeners Disabled Feature Flag Tests
 * @description ALL_RTDB_LISTENERS_DISABLED 플래그가 true일 때 RTDB 리스너가 비활성화되는지 검증
 * @see Firebase RTDB 250MB 과다 다운로드 문제 해결
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FEATURE_FLAGS } from '@/shared/constants/featureFlags';

// Mock Firebase modules
vi.mock('@/shared/services/sync/firebase/firebaseClient', () => ({
  getFirebaseDatabase: vi.fn(),
  isFirebaseInitialized: vi.fn(() => true),
}));

vi.mock('@/shared/services/sync/firebase/firebaseSyncLeaderLock', () => ({
  acquireFirebaseSyncLeaderLock: vi.fn(() =>
    Promise.resolve({
      isLeader: true,
      instanceId: 'test-instance',
      release: vi.fn(),
    })
  ),
}));

vi.mock('@/shared/services/sync/firebase/syncUtils', () => ({
  getDeviceId: vi.fn(() => 'test-device-id'),
}));

// Track if startRtdbListeners was called
const startRtdbListenersMock = vi.fn(() => []);
const stopRtdbListenersMock = vi.fn();

vi.mock('@/data/db/infra/syncEngine/listener', () => ({
  startRtdbListeners: startRtdbListenersMock,
  stopRtdbListeners: stopRtdbListenersMock,
}));

// Mock addSyncLog to track logs
const addSyncLogMock = vi.fn();
vi.mock('@/shared/services/sync/syncLogger', () => ({
  addSyncLog: addSyncLogMock,
}));

describe('ALL_RTDB_LISTENERS_DISABLED feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature flag existence', () => {
    it('ALL_RTDB_LISTENERS_DISABLED flag exists in FEATURE_FLAGS', () => {
      expect(FEATURE_FLAGS).toHaveProperty('ALL_RTDB_LISTENERS_DISABLED');
    });

    it('ALL_RTDB_LISTENERS_DISABLED defaults to true', () => {
      expect(FEATURE_FLAGS.ALL_RTDB_LISTENERS_DISABLED).toBe(true);
    });
  });

  describe('SyncEngine.startListening() behavior when flag is true', () => {
    it('does not call startRtdbListeners when ALL_RTDB_LISTENERS_DISABLED is true', async () => {
      // Given: Feature flag is true (which is the default)
      expect(FEATURE_FLAGS.ALL_RTDB_LISTENERS_DISABLED).toBe(true);

      // When: Import and call startListening
      const { SyncEngine } = await import('@/data/db/infra/syncEngine');
      
      // Reset instance for clean test
      // @ts-expect-error - accessing private static for test reset
      SyncEngine.instance = undefined;
      
      const engine = SyncEngine.getInstance();
      await engine.startListening();

      // Then: startRtdbListeners should NOT have been called
      expect(startRtdbListenersMock).not.toHaveBeenCalled();
    });

    it('logs that RTDB listeners are disabled by feature flag', async () => {
      // Given: Feature flag is true
      expect(FEATURE_FLAGS.ALL_RTDB_LISTENERS_DISABLED).toBe(true);

      // When: Import and call startListening
      const { SyncEngine } = await import('@/data/db/infra/syncEngine');
      
      // Reset instance for clean test
      // @ts-expect-error - accessing private static for test reset
      SyncEngine.instance = undefined;
      
      const engine = SyncEngine.getInstance();
      await engine.startListening();

      // Then: Should log that listeners are disabled
      expect(addSyncLogMock).toHaveBeenCalledWith(
        'firebase',
        'info',
        'RTDB listeners disabled by feature flag'
      );
    });
  });
});
