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

// ============================================================================
// T80-06: rtdbListenerRegistry 예외 격리 + stopAll 검증
// ============================================================================
describe('rtdbListenerRegistry - Exception Isolation & stopAll (T80-06)', () => {
  beforeEach(() => {
    vi.resetModules();
    onValueSpy.mockReset();
    refSpy.mockReset();
  });

  it('consumer exception does not break other consumers', async () => {
    refSpy.mockImplementation((_db: unknown, path: string) => ({ path }));

    // onValue 콜백을 캡처해서 나중에 호출
    let capturedCallback: ((snapshot: { val: () => unknown }) => void) | null = null;
    const unsubscribeSpy = vi.fn();
    onValueSpy.mockImplementation((_ref: unknown, callback: (snapshot: { val: () => unknown }) => void) => {
      capturedCallback = callback;
      return unsubscribeSpy;
    });

    const { attachRtdbOnValue } = await import(
      '@/shared/services/sync/firebase/rtdbListenerRegistry'
    );

    const db = { kind: 'db' } as unknown as Database;
    const path = 'users/user/test';

    // 첫 번째 consumer: 예외를 던짐
    const errorConsumer = vi.fn(() => {
      throw new Error('Consumer error!');
    });

    // 두 번째 consumer: 정상 동작
    const normalConsumer = vi.fn();

    attachRtdbOnValue(db, path, errorConsumer);
    attachRtdbOnValue(db, path, normalConsumer);

    // 데이터 이벤트 발생
    expect(capturedCallback).not.toBeNull();
    capturedCallback!({ val: () => ({ data: 'test' }) });

    // 첫 번째 consumer가 예외를 던져도 두 번째는 정상 호출됨
    expect(errorConsumer).toHaveBeenCalledTimes(1);
    expect(normalConsumer).toHaveBeenCalledTimes(1);
  });

  it('stopAllRtdbListeners clears all active listeners', async () => {
    refSpy.mockImplementation((_db: unknown, path: string) => ({ path }));

    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    let callCount = 0;
    onValueSpy.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsubscribe1 : unsubscribe2;
    });

    const { attachRtdbOnValue, stopAllRtdbListeners, getActiveRtdbListenerCount } = await import(
      '@/shared/services/sync/firebase/rtdbListenerRegistry'
    );

    const db = { kind: 'db' } as unknown as Database;

    // 서로 다른 path에 리스너 등록
    attachRtdbOnValue(db, 'path/one', vi.fn());
    attachRtdbOnValue(db, 'path/two', vi.fn());

    expect(getActiveRtdbListenerCount()).toBe(2);

    // stopAll 호출
    stopAllRtdbListeners();

    // 모든 리스너 해제
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
    expect(getActiveRtdbListenerCount()).toBe(0);
  });

  it('stopAllRtdbListeners handles unsubscribe errors gracefully', async () => {
    refSpy.mockImplementation((_db: unknown, path: string) => ({ path }));

    // unsubscribe가 에러를 던지도록 설정
    const faultyUnsubscribe = vi.fn(() => {
      throw new Error('Unsubscribe failed');
    });
    onValueSpy.mockReturnValue(faultyUnsubscribe);

    const { attachRtdbOnValue, stopAllRtdbListeners, getActiveRtdbListenerCount } = await import(
      '@/shared/services/sync/firebase/rtdbListenerRegistry'
    );

    const db = { kind: 'db' } as unknown as Database;
    attachRtdbOnValue(db, 'error/path', vi.fn());

    expect(getActiveRtdbListenerCount()).toBe(1);

    // 에러가 발생해도 throw하지 않음
    expect(() => stopAllRtdbListeners()).not.toThrow();

    // 내부 맵은 클리어됨
    expect(getActiveRtdbListenerCount()).toBe(0);
  });

  it('re-attaching after stopAll creates fresh listeners', async () => {
    refSpy.mockImplementation((_db: unknown, path: string) => ({ path }));
    const unsubscribeSpy = vi.fn();
    onValueSpy.mockReturnValue(unsubscribeSpy);

    const { attachRtdbOnValue, stopAllRtdbListeners, getActiveRtdbListenerCount } = await import(
      '@/shared/services/sync/firebase/rtdbListenerRegistry'
    );

    const db = { kind: 'db' } as unknown as Database;

    // 첫 번째 attach
    attachRtdbOnValue(db, 'path/fresh', vi.fn());
    expect(getActiveRtdbListenerCount()).toBe(1);
    expect(onValueSpy).toHaveBeenCalledTimes(1);

    // stopAll
    stopAllRtdbListeners();
    expect(getActiveRtdbListenerCount()).toBe(0);

    // 다시 attach - 새로운 리스너 생성
    onValueSpy.mockClear();
    attachRtdbOnValue(db, 'path/fresh', vi.fn());
    expect(getActiveRtdbListenerCount()).toBe(1);
    expect(onValueSpy).toHaveBeenCalledTimes(1); // 새로 호출됨
  });
});
