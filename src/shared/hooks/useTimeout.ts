/**
 * useTimeout - 타이머 정리 로직을 추상화하는 커스텀 훅
 *
 * @role 타이머 생성/정리 로직 캡슐화로 메모리 누수 방지
 * @description
 *   - 컴포넌트 언마운트 시 자동으로 타이머 정리
 *   - 중복 타이머 방지 (새 타이머 설정 시 기존 타이머 자동 정리)
 *   - 명시적 clear 메서드 제공
 *
 * @example
 * ```tsx
 * const damageTimer = useTimeout();
 * damageTimer.set(() => setLastDamage(null), 1000);
 * // 컴포넌트 언마운트 시 자동 정리
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';

type TimeoutId = ReturnType<typeof setTimeout>;

interface UseTimeoutReturn {
  /** 새 타이머 설정 (기존 타이머 자동 정리) */
  set: (callback: () => void, delay: number) => void;
  /** 현재 타이머 명시적 정리 */
  clear: () => void;
  /** 타이머 활성 여부 */
  isActive: () => boolean;
}

/**
 * 타이머 정리 로직을 캡슐화한 훅
 *
 * @returns {UseTimeoutReturn} 타이머 제어 객체
 */
export function useTimeout(): UseTimeoutReturn {
  const timeoutRef = useRef<TimeoutId | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const set = useCallback(
    (callback: () => void, delay: number) => {
      // 기존 타이머 정리 후 새 타이머 설정
      clear();
      timeoutRef.current = setTimeout(() => {
        callback();
        timeoutRef.current = null;
      }, delay);
    },
    [clear],
  );

  const isActive = useCallback(() => timeoutRef.current !== null, []);

  // 컴포넌트 언마운트 시 자동 정리
  useEffect(() => {
    return clear;
  }, [clear]);

  return { set, clear, isActive };
}

/**
 * 여러 개의 명명된 타이머를 관리하는 훅
 *
 * @example
 * ```tsx
 * const timers = useNamedTimeouts();
 * timers.set('damage', () => setLastDamage(null), 1000);
 * timers.set('sound', () => playSound(), 200);
 * timers.clear('damage'); // 특정 타이머만 정리
 * timers.clearAll(); // 모든 타이머 정리
 * ```
 */
export function useNamedTimeouts(): {
  set: (name: string, callback: () => void, delay: number) => void;
  clear: (name: string) => void;
  clearAll: () => void;
  isActive: (name: string) => boolean;
} {
  const timeoutsRef = useRef<Map<string, TimeoutId>>(new Map());

  const clear = useCallback((name: string) => {
    const timeoutId = timeoutsRef.current.get(name);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(name);
    }
  }, []);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current.clear();
  }, []);

  const set = useCallback(
    (name: string, callback: () => void, delay: number) => {
      clear(name);
      const timeoutId = setTimeout(() => {
        callback();
        timeoutsRef.current.delete(name);
      }, delay);
      timeoutsRef.current.set(name, timeoutId);
    },
    [clear],
  );

  const isActive = useCallback(
    (name: string) => timeoutsRef.current.has(name),
    [],
  );

  // 컴포넌트 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return clearAll;
  }, [clearAll]);

  return { set, clear, clearAll, isActive };
}
