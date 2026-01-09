/**
 * Feature Flags
 *
 * @file featureFlags.ts
 * @description 기능 플래그 상수 정의
 *
 * @role
 *   - 점진적 기능 롤아웃을 위한 플래그 관리
 *   - 실험적 기능의 안전한 활성화/비활성화
 * @responsibilities
 *   - Phase별 기능 활성화 제어
 *   - 런타임에 영향 없이 빌드 타임에 결정
 *
 * @usage
 * ```typescript
 * import { FEATURE_FLAGS } from '@/shared/constants/featureFlags';
 *
 * if (FEATURE_FLAGS.ITEM_SYNC_ENABLED) {
 *   await syncItemToFirebase(strategy, item, uid);
 * }
 * ```
 */

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * 기능 플래그 상수
 *
 * 각 플래그는 특정 Phase에서 활성화됩니다:
 * - Phase A: 인프라 준비 (모든 플래그 false)
 * - Phase B: ITEM_SYNC_ENABLED = true
 * - Phase C: BATCH_EVENTS_ENABLED = true
 *
 * @constant
 */
export const FEATURE_FLAGS = {
  /**
   * 아이템 단위 동기화 활성화 여부
   *
   * true일 때:
   * - syncItemToFirebase/deleteItemFromFirebase가 실제 Firebase 작업 수행
   * - 기존 컬렉션 전체 동기화와 병행 가능
   *
   * false일 때:
   * - Item sync 함수들은 no-op으로 동작
   * - 기존 동기화 로직에 영향 없음
   *
   * @see Phase B에서 활성화됨
   */
  ITEM_SYNC_ENABLED: true,

  /**
   * 배치 이벤트 활성화 여부
   *
   * true일 때:
   * - EventBus에서 배치 이벤트(task:completed:batch 등) 발행
   * - 개별 이벤트와 배치 이벤트 병행 발행
   *
   * false일 때:
   * - 기존 개별 이벤트만 발행
   * - 배치 이벤트 리스너는 호출되지 않음
   *
   * @see Phase C에서 활성화됨
   */
  BATCH_EVENTS_ENABLED: true,

  /**
   * 디버그 모드 활성화 여부
   *
   * true일 때:
   * - 추가적인 로깅 출력
   * - 성능 메트릭 수집
   *
   * false일 때 (기본값):
   * - 프로덕션 모드로 동작
   */
  DEBUG_SYNC_ENABLED: false,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Feature flag 키 타입
 */
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Feature flag 값 타입
 */
export type FeatureFlagValue = (typeof FEATURE_FLAGS)[FeatureFlagKey];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 특정 기능 플래그가 활성화되어 있는지 확인
 *
 * @param flag 확인할 플래그 키
 * @returns 플래그 활성화 여부
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled('ITEM_SYNC_ENABLED')) {
 *   // Item sync 로직 실행
 * }
 * ```
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  // Note: as const로 선언된 객체에서 런타임 확인을 위해 Boolean 캐스팅 사용
  return Boolean(FEATURE_FLAGS[flag]);
}

/**
 * 모든 기능 플래그 상태를 객체로 반환 (디버깅용)
 *
 * @returns 현재 모든 플래그 상태
 */
export function getAllFeatureFlags(): Readonly<typeof FEATURE_FLAGS> {
  return FEATURE_FLAGS;
}
