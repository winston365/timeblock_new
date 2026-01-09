/**
 * Debounced Sync Utilities
 *
 * @file debouncedSync.ts
 * @description 동기화 호출을 debounce하여 빈도를 최적화하는 유틸리티
 *
 * @role
 *   - 빈번한 동기화 호출을 debounce하여 네트워크 부하 감소
 *   - 동기화 전략별로 독립적인 debounce 관리
 * @responsibilities
 *   - createDebouncedSync: 동기화 함수를 debounce로 래핑
 *   - 전략별 debounce 인스턴스 캐싱
 *   - flush/cancel API 제공
 */

import { debounce, type DebouncedFunction, SYNC_DEBOUNCE_WAIT } from '@/shared/utils/debounce';

// ============================================================================
// Constants
// ============================================================================

/** 동기화용 기본 debounce 대기 시간 (ms) */
export const DEFAULT_SYNC_DEBOUNCE_MS = 300;

// ============================================================================
// Types
// ============================================================================

type SyncFunction = () => Promise<void>;

interface DebouncedSyncEntry {
  debounced: DebouncedFunction<() => unknown>;
  lastCall: number;
}

// ============================================================================
// State
// ============================================================================

/**
 * 전략 키별 debounced sync 함수 캐시
 * 동일 키에 대해 중복 debounce 인스턴스 생성 방지
 */
const debouncedSyncCache = new Map<string, DebouncedSyncEntry>();

// ============================================================================
// Public API
// ============================================================================

/**
 * 동기화 함수를 debounce로 래핑합니다.
 *
 * 동일한 strategyKey에 대해 호출하면 같은 debounce 인스턴스를 재사용합니다.
 * 이를 통해 여러 곳에서 동일 동기화를 호출해도 한 번만 실행됩니다.
 *
 * @param strategyKey 동기화 전략 식별 키 (예: 'weeklyGoals', 'globalInbox')
 * @param syncFn 실제 동기화를 수행하는 비동기 함수
 * @param waitMs debounce 대기 시간 (ms), 기본값: 300
 * @returns debounced 동기화 함수
 *
 * @example
 * ```typescript
 * const debouncedSync = createDebouncedSync(
 *   'weeklyGoals',
 *   async () => {
 *     const goals = await db.weeklyGoals.toArray();
 *     await syncToFirebase(weeklyGoalStrategy, goals);
 *   }
 * );
 *
 * // 여러 번 호출해도 300ms 내에는 한 번만 실행
 * debouncedSync();
 * debouncedSync();
 * debouncedSync();
 * ```
 */
export function createDebouncedSync(
  strategyKey: string,
  syncFn: SyncFunction,
  waitMs: number = DEFAULT_SYNC_DEBOUNCE_MS
): () => void {
  // 캐시에 있으면 기존 인스턴스 반환
  const existing = debouncedSyncCache.get(strategyKey);
  if (existing) {
    existing.lastCall = Date.now();
    return () => existing.debounced();
  }

  // 새 debounce 인스턴스 생성
  const wrappedFn = () => {
    syncFn().catch(error => {
      console.error(`[DebouncedSync] Error in ${strategyKey}:`, error);
    });
  };

  const debounced = debounce(wrappedFn, {
    wait: waitMs,
    leading: false,
    trailing: true,
  });

  const entry: DebouncedSyncEntry = {
    debounced,
    lastCall: Date.now(),
  };

  debouncedSyncCache.set(strategyKey, entry);

  return () => debounced();
}

/**
 * 특정 전략의 대기 중인 동기화를 즉시 실행합니다.
 *
 * @param strategyKey 동기화 전략 식별 키
 */
export function flushDebouncedSync(strategyKey: string): void {
  const entry = debouncedSyncCache.get(strategyKey);
  if (entry) {
    entry.debounced.flush();
  }
}

/**
 * 특정 전략의 대기 중인 동기화를 취소합니다.
 *
 * @param strategyKey 동기화 전략 식별 키
 */
export function cancelDebouncedSync(strategyKey: string): void {
  const entry = debouncedSyncCache.get(strategyKey);
  if (entry) {
    entry.debounced.cancel();
  }
}

/**
 * 모든 대기 중인 동기화를 즉시 실행합니다.
 * 앱 종료 또는 로그아웃 시 사용합니다.
 */
export function flushAllDebouncedSyncs(): void {
  debouncedSyncCache.forEach((entry) => {
    entry.debounced.flush();
  });
}

/**
 * 모든 대기 중인 동기화를 취소합니다.
 */
export function cancelAllDebouncedSyncs(): void {
  debouncedSyncCache.forEach((entry) => {
    entry.debounced.cancel();
  });
}

/**
 * debounce 캐시를 초기화합니다.
 * 주로 테스트에서 사용합니다.
 */
export function clearDebouncedSyncCache(): void {
  cancelAllDebouncedSyncs();
  debouncedSyncCache.clear();
}

/**
 * 대기 중인 동기화가 있는지 확인합니다.
 *
 * @param strategyKey 동기화 전략 식별 키
 * @returns 대기 중인 동기화 여부
 */
export function hasPendingSync(strategyKey: string): boolean {
  const entry = debouncedSyncCache.get(strategyKey);
  return entry?.debounced.pending() ?? false;
}

/**
 * 동기화용 debounce 대기 시간 상수 재export
 * 다른 모듈에서 일관된 값 사용을 위해 제공
 */
export { SYNC_DEBOUNCE_WAIT };
