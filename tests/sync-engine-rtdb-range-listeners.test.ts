import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalDate } from '@/shared/lib/utils';
import { FIREBASE_SYNC_DEFAULTS } from '@/shared/constants/defaults';

const attachRtdbOnValueSpy = vi.fn(() => vi.fn());
const attachRtdbOnValueKeyRangeSpy = vi.fn(() => vi.fn());
const attachRtdbOnChildKeyRangeSpy = vi.fn(() => vi.fn());
const attachRtdbOnChildSpy = vi.fn(() => vi.fn());

vi.mock('@/shared/services/sync/firebase/rtdbListenerRegistry', () => ({
  attachRtdbOnValue: attachRtdbOnValueSpy,
  attachRtdbOnValueKeyRange: attachRtdbOnValueKeyRangeSpy,
  attachRtdbOnChildKeyRange: attachRtdbOnChildKeyRangeSpy,
  attachRtdbOnChild: attachRtdbOnChildSpy,
}));

describe('SyncEngine RTDB listeners - date-keyed range subscriptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Noon local time to avoid edge cases around midnight.
    vi.setSystemTime(new Date('2026-01-07T12:00:00'));

    attachRtdbOnValueSpy.mockClear();
    attachRtdbOnValueKeyRangeSpy.mockClear();
    attachRtdbOnChildKeyRangeSpy.mockClear();
    attachRtdbOnChildSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses child key-range listeners for dailyData/completedInbox/tokenUsage', async () => {
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
    expect(attachRtdbOnValueKeyRangeSpy).not.toHaveBeenCalled();
    expect(attachRtdbOnChildKeyRangeSpy).toHaveBeenCalledTimes(3);
    expect(attachRtdbOnChildKeyRangeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/dailyData',
      expectedStartAtKey,
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.dailyData' })
    );
    expect(attachRtdbOnChildKeyRangeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/completedInbox',
      expectedStartAtKey,
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.completedInbox' })
    );
    expect(attachRtdbOnChildKeyRangeSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/tokenUsage',
      expectedStartAtKey,
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.tokenUsage' })
    );

    // other collections: small single-node objects stay as onValue
    expect(attachRtdbOnValueSpy).toHaveBeenCalledTimes(2);

    // array-like collections should use child listeners to avoid full re-download
    expect(attachRtdbOnChildSpy).toHaveBeenCalledTimes(5);
    expect(attachRtdbOnChildSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/templates/data',
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.templates' })
    );
    expect(attachRtdbOnChildSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/shopItems/data',
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.shopItems' })
    );
    expect(attachRtdbOnChildSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/shopItems/all/data',
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.shopItems' })
    );
    expect(attachRtdbOnChildSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/globalInbox/data',
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.globalInbox' })
    );
    expect(attachRtdbOnChildSpy).toHaveBeenCalledWith(
      expect.anything(),
      'users/user/globalInbox/all/data',
      expect.any(Function),
      expect.objectContaining({ tag: 'SyncEngine.globalInbox' })
    );
  });
});
