/**
 * Firebase Guard Utilities
 *
 * @fileoverview Firebase 동기화 가드 패턴 추상화
 *
 * @role Firebase 초기화 상태 확인 및 조건부 동기화 패턴 표준화
 * @responsibilities
 *   - Firebase 초기화 상태 확인 후 조건부 실행
 *   - 에러 발생 시 자동 catch 및 로깅
 *   - 선택적 fallback 값 반환
 * @dependencies
 *   - firebaseService: isFirebaseInitialized 함수
 */

import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';

/**
 * Firebase가 초기화된 경우에만 동기화 함수를 실행합니다.
 * 
 * 에러가 발생해도 로그만 출력하고 계속 진행합니다 (비핵심 기능).
 * 로컬 저장은 이미 완료된 상태에서 사용합니다.
 *
 * @param syncFn - 실행할 Firebase 동기화 함수
 * @param label - 에러 로깅용 라벨 (예: 'Settings sync')
 * @returns void
 *
 * @example
 * // 기존 패턴
 * if (isFirebaseInitialized()) {
 *   syncToFirebase(strategy, data).catch(err => {
 *     console.error('Firebase sync failed:', err);
 *   });
 * }
 * 
 * // 새 패턴
 * withFirebaseSync(() => syncToFirebase(strategy, data), 'Settings');
 */
export function withFirebaseSync(
  syncFn: () => Promise<void>,
  label?: string
): void {
  if (!isFirebaseInitialized()) return;

  syncFn().catch(err => {
    const prefix = label ? `[${label}] ` : '';
    console.error(`${prefix}Firebase sync failed, but local save succeeded:`, err);
  });
}

/**
 * Firebase가 초기화된 경우에만 데이터를 가져옵니다.
 * 
 * @param fetchFn - 실행할 Firebase fetch 함수
 * @param fallback - Firebase 미초기화 또는 에러 시 반환할 값
 * @returns fetch 결과 또는 fallback
 *
 * @example
 * const firebaseData = await withFirebaseFetch(
 *   () => fetchFromFirebase(strategy, key),
 *   null
 * );
 */
export async function withFirebaseFetch<T>(
  fetchFn: () => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isFirebaseInitialized()) return fallback;

  try {
    return await fetchFn();
  } catch (err) {
    console.error('Firebase fetch failed:', err);
    return fallback;
  }
}

/**
 * Firebase 초기화 상태와 조건을 함께 확인합니다.
 * 
 * @param condition - 추가 조건 (예: strategy가 있는지)
 * @returns Firebase 초기화됨 && 조건 충족
 *
 * @example
 * if (shouldSyncToFirebase(firebaseStrategy)) {
 *   syncToFirebase(firebaseStrategy, data);
 * }
 */
export function shouldSyncToFirebase(condition: unknown = true): boolean {
  return isFirebaseInitialized() && Boolean(condition);
}

/**
 * Firebase 동기화 실행 (옵션 기반)
 * 
 * Repository 패턴에서 사용하기 좋은 형태
 *
 * @param options - 동기화 옵션
 * @param options.enabled - 동기화 활성화 여부 (기본값: true)
 * @param options.strategy - Firebase 동기화 전략
 * @param options.syncFn - 실행할 동기화 함수
 * @param options.label - 에러 로깅용 라벨
 *
 * @example
 * executeFirebaseSync({
 *   enabled: options.syncFirebase,
 *   strategy: firebaseStrategy,
 *   syncFn: () => syncToFirebase(strategy, data, key),
 *   label: 'DailyData'
 * });
 */
export function executeFirebaseSync(options: {
  enabled?: boolean;
  strategy?: unknown;
  syncFn: () => Promise<void>;
  label?: string;
}): void {
  const { enabled = true, strategy, syncFn, label } = options;

  if (!enabled) return;
  if (strategy !== undefined && !strategy) return;
  if (!isFirebaseInitialized()) return;

  syncFn().catch(err => {
    const prefix = label ? `[${label}] ` : '';
    console.error(`${prefix}Firebase sync failed:`, err);
  });
}
