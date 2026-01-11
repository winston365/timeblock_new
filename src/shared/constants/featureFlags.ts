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

  // ============================================================================
  // Data Optimization Flags (Phase 1-3)
  // ============================================================================

  /**
   * 레거시 RTDB 리스너 비활성화 여부
   *
   * true일 때:
   * - shopItems/all/data, globalInbox/all/data 리스너 비활성화
   * - 중복 구독 제거로 네트워크 트래픽 대폭 감소 (66배 → 1배)
   * - 신규 데이터 형태(/data)만 사용
   *
   * false일 때:
   * - 레거시 형태(/all/data) 리스너도 함께 구독
   * - 구 버전 데이터 호환성 유지 (롤백용)
   *
   * @see Firebase RTDB 199MB 과다 다운로드 문제 해결
   */
  LEGACY_RTDB_LISTENERS_DISABLED: true,

  /**
   * 수동 인박스 동기화 비활성화 여부 (Phase 1: Quick Win)
   *
   * true일 때:
   * - toggleInboxTaskCompletion에서 수동 syncBothInboxTablesToFirebase 호출 제거
   * - SyncEngine hooks가 자동으로 동기화 처리
   * - 이중 동기화 제거로 성능 향상
   *
   * false일 때:
   * - 기존 수동 동기화 로직 유지 (롤백용)
   *
   * @see PR-1에서 활성화됨
   */
  MANUAL_INBOX_SYNC_DISABLED: true,

  /**
   * CompletedInbox 증분 적용 활성화 여부 (Phase 2: Incremental Sync)
   *
   * true일 때:
   * - 리스너에서 dateKey 단위 diff 계산
   * - 변경된 task만 bulkDelete/bulkPut
   * - clear() 없이 증분 업데이트
   *
   * false일 때:
   * - 기존 clear() → bulkPut() 방식 유지
   *
   * @see PR-2/3에서 활성화됨
   */
  COMPLETED_INBOX_INCREMENTAL_APPLY_ENABLED: true,

  /**
   * CompletedInbox Dirty Date 추적 동기화 활성화 여부 (Phase 3)
   *
   * true일 때:
   * - task.completedAt 기반 dateKey 추출
   * - dateKey별 개별 debounce 스케줄링
   * - 해당 dateKey의 task만 조회/동기화
   *
   * false일 때:
   * - 모든 completedInbox 전체 동기화
   *
   * @see PR-5에서 활성화됨
   */
  COMPLETED_INBOX_DIRTY_DATE_SYNC_ENABLED: false,

  /**
   * 모든 RTDB 리스너 비활성화 여부
   *
   * true일 때:
   * - Firebase RTDB 리스너가 등록되지 않음
   * - 앱 → Firebase 업로드는 Dexie hooks로 계속 작동
   * - 다른 기기에서 변경한 내용이 실시간으로 반영되지 않음 (앱 재시작 필요)
   * - 네트워크 트래픽 대폭 감소 (250MB → ~0)
   *
   * false일 때:
   * - 기존 실시간 동기화 동작 (리스너 활성화)
   *
   * @see Firebase RTDB 250MB 과다 다운로드 문제 해결
   */
  ALL_RTDB_LISTENERS_DISABLED: true,
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
