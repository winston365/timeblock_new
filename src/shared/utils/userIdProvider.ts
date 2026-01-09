/**
 * User ID Provider
 *
 * @file userIdProvider.ts
 * @description Firebase 동기화에 사용되는 사용자 ID 관리
 *
 * @role
 *   - 중앙집중식 사용자 ID 관리
 *   - 향후 인증 시스템 연동을 위한 확장점 제공
 * @responsibilities
 *   - 현재 사용자 ID 반환
 *   - 인증 시스템 연동 시 단일 변경점 제공
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * 기본 사용자 ID
 * @internal
 */
const DEFAULT_USER_ID = 'user';

// ============================================================================
// Public API
// ============================================================================

/**
 * 현재 사용자 ID를 반환합니다.
 *
 * Firebase 동기화 시 경로 생성에 사용됩니다.
 * 현재는 'user'로 고정되어 있으며, 향후 인증 시스템 연동 시
 * 이 함수만 수정하면 모든 repository에 적용됩니다.
 *
 * @returns 사용자 ID 문자열
 *
 * @example
 * ```typescript
 * import { getCurrentUserId } from '@/shared/utils/userIdProvider';
 *
 * const uid = getCurrentUserId();
 * await syncItemToFirebase(strategy, item, uid);
 * ```
 *
 * @todo AUTH-001: 인증 시스템 연동 시 실제 사용자 ID 반환하도록 변경
 */
export function getCurrentUserId(): string {
  // TODO: 추후 실제 인증 시스템과 연동 시 변경
  // 예: return useAuthStore.getState().user?.uid ?? DEFAULT_USER_ID;
  return DEFAULT_USER_ID;
}
