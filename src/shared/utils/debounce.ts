/**
 * Debounce Utilities
 *
 * @file debounce.ts
 * @description 설정 가능한 debounce 및 throttle 유틸리티 함수
 *
 * @role
 *   - 빈번한 함수 호출을 최적화하여 성능 개선
 *   - 동기화, 검색, 입력 처리 등에서 불필요한 호출 방지
 * @responsibilities
 *   - debounce: 마지막 호출 후 지정 시간이 지나면 실행
 *   - throttle: 지정 시간 동안 최대 1회만 실행
 *   - 취소 가능한 debounce 함수 제공
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Debounce된 함수 타입
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  /** 원본 함수를 debounce하여 호출 */
  (...args: Parameters<T>): void;
  /** 대기 중인 호출 취소 */
  cancel: () => void;
  /** 대기 중인 호출을 즉시 실행 */
  flush: () => void;
  /** 대기 중인 호출이 있는지 확인 */
  pending: () => boolean;
}

/**
 * Debounce 옵션
 */
export interface DebounceOptions {
  /** debounce 대기 시간 (ms), 기본값: 300 */
  wait?: number;
  /** 대기 시작 시 즉시 실행 여부 */
  leading?: boolean;
  /** 대기 종료 시 실행 여부 (기본: true) */
  trailing?: boolean;
  /** 최대 대기 시간 (ms) - 이 시간이 지나면 강제 실행 */
  maxWait?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 기본 debounce 대기 시간 (ms) */
export const DEFAULT_DEBOUNCE_WAIT = 300;

/** 동기화용 debounce 대기 시간 (ms) */
export const SYNC_DEBOUNCE_WAIT = 500;

/** 검색용 debounce 대기 시간 (ms) */
export const SEARCH_DEBOUNCE_WAIT = 200;

// ============================================================================
// Debounce Implementation
// ============================================================================

/**
 * Debounce 함수 생성기
 *
 * 마지막 호출 후 지정된 시간이 지나면 함수를 실행합니다.
 * 연속된 호출은 무시되고, 마지막 호출만 실행됩니다.
 *
 * @template T 원본 함수 타입
 * @param fn 실행할 함수
 * @param options debounce 옵션 또는 대기 시간 (ms)
 * @returns debounce된 함수
 *
 * @example
 * ```typescript
 * const debouncedSave = debounce(saveData, { wait: 500 });
 * debouncedSave(data); // 500ms 후 실행
 * debouncedSave(data); // 이전 호출 취소, 다시 500ms 대기
 * debouncedSave.cancel(); // 대기 중인 호출 취소
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: DebounceOptions | number = {}
): DebouncedFunction<T> {
  const opts: DebounceOptions =
    typeof options === 'number' ? { wait: options } : options;

  const {
    wait = DEFAULT_DEBOUNCE_WAIT,
    leading = false,
    trailing = true,
    maxWait,
  } = opts;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;

  function invokeFunc(): void {
    const args = lastArgs;
    lastArgs = null;

    if (args !== null) {
      fn(...args);
    }
  }

  function startTimer(pendingFunc: () => void, waitTime: number): ReturnType<typeof setTimeout> {
    return setTimeout(pendingFunc, waitTime);
  }

  function cancelTimer(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
  }

  function trailingEdge(): void {
    timeoutId = null;

    if (trailing && lastArgs !== null) {
      invokeFunc();
    }
    lastArgs = null;
  }

  function leadingEdge(_time: number): void {
    if (leading) {
      invokeFunc();
    }

    timeoutId = startTimer(trailingEdge, wait);
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = lastCallTime !== null ? time - lastCallTime : 0;
    return wait - timeSinceLastCall;
  }

  function shouldInvoke(time: number): boolean {
    if (lastCallTime === null) {
      return true;
    }

    const timeSinceLastCall = time - lastCallTime;

    return timeSinceLastCall >= wait;
  }

  function debounced(...args: Parameters<T>): void {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        leadingEdge(time);

        // maxWait 설정이 있으면 최대 대기 타이머 시작
        if (maxWait !== undefined && maxTimeoutId === null) {
          maxTimeoutId = startTimer(() => {
            maxTimeoutId = null;
            if (lastArgs !== null) {
              cancelTimer();
              invokeFunc();
            }
          }, maxWait);
        }

        return;
      }
    }

    // 기존 타이머가 있으면 리셋
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = startTimer(trailingEdge, remainingWait(time));
  }

  debounced.cancel = function cancel(): void {
    cancelTimer();
    lastArgs = null;
    lastCallTime = null;
  };

  debounced.flush = function flush(): void {
    if (timeoutId !== null && lastArgs !== null) {
      cancelTimer();
      invokeFunc();
    }
  };

  debounced.pending = function pending(): boolean {
    return timeoutId !== null;
  };

  return debounced;
}

// ============================================================================
// Throttle Implementation
// ============================================================================

/**
 * Throttle 함수 생성기
 *
 * 지정된 시간 동안 최대 1회만 함수를 실행합니다.
 * leading edge에서 실행됩니다.
 *
 * @template T 원본 함수 타입
 * @param fn 실행할 함수
 * @param wait 제한 시간 (ms), 기본값: 300
 * @returns throttle된 함수
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number = DEFAULT_DEBOUNCE_WAIT
): DebouncedFunction<T> {
  return debounce(fn, {
    wait,
    leading: true,
    trailing: true,
    maxWait: wait,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 비동기 함수용 debounce
 *
 * Promise를 반환하는 함수를 debounce합니다.
 * 마지막 호출의 Promise만 resolve됩니다.
 *
 * @template T 원본 비동기 함수 타입
 * @param fn 실행할 비동기 함수
 * @param wait 대기 시간 (ms)
 * @returns debounce된 비동기 함수
 *
 * @example
 * ```typescript
 * const debouncedFetch = debounceAsync(fetchData, 500);
 * const result = await debouncedFetch(query); // 500ms 후 실행
 * ```
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  wait: number = DEFAULT_DEBOUNCE_WAIT
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: Awaited<ReturnType<T>>) => void) | null = null;
  let pendingReject: ((reason: unknown) => void) | null = null;

  return function asyncDebounced(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    // 이전 대기 중인 호출 취소
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      // 이전 Promise는 무시 (resolve/reject 하지 않음)
      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        timeoutId = null;

        try {
          const result = await fn(...args);
          if (pendingResolve === resolve) {
            pendingResolve(result as Awaited<ReturnType<T>>);
          }
        } catch (error) {
          if (pendingReject === reject) {
            pendingReject(error);
          }
        }
      }, wait);
    });
  };
}
