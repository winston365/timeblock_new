import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalDate } from '@/shared/lib/utils';
import { FIREBASE_SYNC_DEFAULTS } from '@/shared/constants/defaults';

const attachRtdbOnValueSpy = vi.fn(() => vi.fn());
const attachRtdbOnValueKeyRangeSpy = vi.fn(() => vi.fn());

vi.mock('@/shared/services/sync/firebase/rtdbListenerRegistry', () => ({
  attachRtdbOnValue: attachRtdbOnValueSpy,
  attachRtdbOnValueKeyRange: attachRtdbOnValueKeyRangeSpy,
}));

describe('SyncEngine RTDB listeners - date-keyed range subscriptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Noon local time to avoid edge cases around midnight.
    vi.setSystemTime(new Date('2026-01-07T12:00:00'));

    attachRtdbOnValueSpy.mockClear();
    attachRtdbOnValueKeyRangeSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses key-range listeners for dailyData/completedInbox/tokenUsage', async () => {
    vi.resetModules();

    const { startRtdbListeners } = await import('@/data/db/infra/syncEngine/listener');

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - FIREBASE_SYNC_DEFAULTS.rtdbDateKeyedLookbackDays);
    const expectedStartAtKey = getLocalDate(cutoff);

    startRtdbListeners({
      database: { kind: 'db' },
      userId: 'user',
      deviceId: 'device1',
      applyRemoteUpdate: async () => undefined,
      sanitizeTokenUsage: (v) => v,
    });

    // date-keyed collections should use range-limited subscriptions
    expect(attachRtdbOnValueKeyRangeSpy).toHaveBeenCalledTimes(3);
    expect(attachRtdbOnValueKeyRangeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/dailyData',
      expectedStartAtKey,
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.dailyData' })
    );
    expect(attachRtdbOnValueKeyRangeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/completedInbox',
      expectedStartAtKey,
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.completedInbox' })
    );
    expect(attachRtdbOnValueKeyRangeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/tokenUsage',
      expectedStartAtKey,
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.tokenUsage' })
    );

    // other collections stay as full onValue listeners
    expect(attachRtdbOnValueSpy).toHaveBeenCalledTimes(5);
  });
});
