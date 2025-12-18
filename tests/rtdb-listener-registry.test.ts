import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from 'firebase/database';

const onValueSpy = vi.fn();
const refSpy = vi.fn();

vi.mock('firebase/database', () => ({
  ref: refSpy,
  onValue: onValueSpy,
}));

vi.mock('@/shared/services/sync/syncLogger', () => ({
  addSyncLog: vi.fn(),
}));

vi.mock('@/shared/services/sync/firebase/rtdbMetrics', () => ({
  recordRtdbAttach: vi.fn(),
  recordRtdbDetach: vi.fn(),
  recordRtdbOnValue: vi.fn(() => 0),
  recordRtdbError: vi.fn(),
  isRtdbInstrumentationEnabled: vi.fn(() => false),
}));

describe('rtdbListenerRegistry', () => {
  beforeEach(() => {
    vi.resetModules();
    onValueSpy.mockReset();
    refSpy.mockReset();
  });

  it('deduplicates onValue per path and refCounts consumers', async () => {
    const unsubscribeImpl = vi.fn();
    onValueSpy.mockReturnValue(unsubscribeImpl);
    refSpy.mockImplementation((_db: unknown, path: string) => ({ path }));

    const { attachRtdbOnValue, getActiveRtdbListenerCount } = await import(
      '@/shared/services/sync/firebase/rtdbListenerRegistry'
    );

    const db = { kind: 'db' } as unknown as Database;
    const path = 'users/user/dailyData';

    const h1 = vi.fn();
    const h2 = vi.fn();

    const u1 = attachRtdbOnValue(db, path, h1);
    const u2 = attachRtdbOnValue(db, path, h2);

    expect(onValueSpy).toHaveBeenCalledTimes(1);
    expect(getActiveRtdbListenerCount()).toBe(1);

    // detach first consumer: still attached
    u1();
    expect(unsubscribeImpl).not.toHaveBeenCalled();
    expect(getActiveRtdbListenerCount()).toBe(1);

    // detach last consumer: actual unsubscribe
    u2();
    expect(unsubscribeImpl).toHaveBeenCalledTimes(1);
    expect(getActiveRtdbListenerCount()).toBe(0);
  });
});
