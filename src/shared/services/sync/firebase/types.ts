/**
 * Firebase Sync - 타입 정의
 *
 * @file types.ts
 * @description 아이템 단위 동기화(Item Sync) 및 Firebase 동기화 관련 타입 정의
 *
 * @role
 *   - ItemSyncStrategy 인터페이스 정의 (개별 아이템 동기화 전략)
 *   - 기존 SyncStrategy와 병행하여 세밀한 동기화 제어 지원
 * @responsibilities
 *   - 컬렉션별 아이템 동기화 전략 타입 정의
 *   - 직렬화/역직렬화 인터페이스 제공
 *   - 타입 안전한 Firebase 경로 생성 지원
 */

// ============================================================================
// Item Sync Strategy Interface
// ============================================================================

/**
 * 개별 아이템 동기화 전략 인터페이스
 *
 * 기존 SyncStrategy와 달리, 컬렉션 전체가 아닌 개별 아이템 단위의
 * 동기화를 지원합니다. Phase B에서 실제 구현에 사용됩니다.
 *
 * @template T 아이템 타입
 *
 * @example
 * ```typescript
 * const taskItemStrategy: ItemSyncStrategy<Task> = {
 *   collection: 'dailyData',
 *   getItemId: (task) => task.id,
 *   getBasePath: (uid) => `users/${uid}/dailyData`,
 *   serializeItem: (task) => ({ ...task, syncedAt: Date.now() }),
 * };
 * ```
 */
export interface ItemSyncStrategy<T> {
  /**
   * 데이터 컬렉션 이름 (예: 'dailyData', 'tasks', 'inbox')
   */
  collection: string;

  /**
   * 아이템에서 고유 ID를 추출하는 함수
   * @param item 동기화할 아이템
   * @returns 아이템의 고유 식별자
   */
  getItemId: (item: T) => string;

  /**
   * Firebase 기본 경로를 생성하는 함수
   * @param uid 사용자 ID
   * @returns Firebase 경로 문자열 (예: 'users/{uid}/dailyData')
   */
  getBasePath: (uid: string) => string;

  /**
   * 아이템을 Firebase에 저장하기 전에 직렬화하는 함수 (선택적)
   * undefined 값 제거, 날짜 변환 등을 수행합니다.
   * @param item 원본 아이템
   * @returns Firebase에 저장할 직렬화된 데이터
   */
  serializeItem?: (item: T) => Record<string, unknown>;

  /**
   * Firebase에서 가져온 데이터를 아이템으로 역직렬화하는 함수 (선택적)
   * @param data Firebase에서 가져온 원시 데이터
   * @returns 복원된 아이템 객체
   */
  deserializeItem?: (data: Record<string, unknown>) => T;
}

// ============================================================================
// Item Sync Result Types
// ============================================================================

/**
 * 아이템 동기화 결과 타입
 */
export interface ItemSyncResult {
  /** 동기화 성공 여부 */
  success: boolean;
  /** 아이템 ID */
  itemId: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 동기화된 Firebase 경로 */
  path?: string;
}

/**
 * 배치 동기화 결과 타입
 */
export interface BatchSyncResult {
  /** 전체 성공 여부 */
  success: boolean;
  /** 성공한 아이템 수 */
  successCount: number;
  /** 실패한 아이템 수 */
  failedCount: number;
  /** 개별 결과 목록 */
  results: ItemSyncResult[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * ItemSyncStrategy 타입 가드
 */
export function isItemSyncStrategy<T>(obj: unknown): obj is ItemSyncStrategy<T> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const strategy = obj as Record<string, unknown>;

  return (
    typeof strategy.collection === 'string' &&
    typeof strategy.getItemId === 'function' &&
    typeof strategy.getBasePath === 'function'
  );
}
