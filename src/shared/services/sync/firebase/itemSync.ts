/**
 * Item-Level Firebase Sync Utilities
 *
 * @file itemSync.ts
 * @description 개별 아이템 단위의 Firebase 동기화 유틸리티
 *
 * @role
 *   - 컬렉션 전체가 아닌 개별 아이템 단위의 동기화 수행
 *   - 기존 syncToFirebase의 N+1 문제를 해결하는 세밀한 제어 제공
 * @responsibilities
 *   - 단일 아이템 Firebase 동기화 (syncItemToFirebase)
 *   - 단일 아이템 Firebase 삭제 (deleteItemFromFirebase)
 *   - 동기화 전략에 따른 경로 계산 및 직렬화
 * @external_dependencies
 *   - firebase/database: Firebase Realtime Database SDK
 *   - ./types: ItemSyncStrategy 타입 정의
 *   - ./firebaseClient: Firebase 클라이언트 관리
 *   - @/shared/utils/firebaseSanitizer: Firebase 데이터 정제
 */

import { ref, set, remove } from 'firebase/database';
import type { ItemSyncStrategy, ItemSyncResult } from './types';
import { getFirebaseDatabase, isFirebaseInitialized } from './firebaseClient';
import { sanitizeForFirebase } from '@/shared/utils/firebaseSanitizer';
import { addSyncLog } from '../syncLogger';
import { FEATURE_FLAGS } from '@/shared/constants/featureFlags';

// ============================================================================
// Item Sync Functions
// ============================================================================

/**
 * 단일 아이템을 Firebase에 동기화합니다.
 *
 * 기존 syncToFirebase와 달리 컬렉션 전체가 아닌 개별 아이템만
 * 동기화하여 네트워크 효율성을 높입니다.
 *
 * @template T 아이템 타입
 * @param strategy 아이템 동기화 전략
 * @param item 동기화할 아이템
 * @param uid 사용자 ID
 * @returns 동기화 결과
 *
 * @example
 * ```typescript
 * const result = await syncItemToFirebase(taskStrategy, task, 'user123');
 * if (!result.success) {
 *   console.error('Sync failed:', result.error);
 * }
 * ```
 */
export async function syncItemToFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  item: T,
  uid: string
): Promise<ItemSyncResult> {
  const itemId = strategy.getItemId(item);

  // Feature flag 체크 - 비활성화 시 no-op
  if (!FEATURE_FLAGS.ITEM_SYNC_ENABLED) {
    return {
      success: true,
      itemId,
      path: undefined,
    };
  }

  try {
    if (!isFirebaseInitialized()) {
      return {
        success: false,
        itemId,
        error: 'Firebase not initialized',
      };
    }

    const db = getFirebaseDatabase();
    const basePath = strategy.getBasePath(uid);
    const itemPath = `${basePath}/${itemId}`;
    const itemRef = ref(db, itemPath);

    // 직렬화 적용
    let dataToSync: Record<string, unknown>;
    if (strategy.serializeItem) {
      dataToSync = strategy.serializeItem(item);
    } else {
      dataToSync = item as Record<string, unknown>;
    }

    // Firebase sanitization
    const sanitizedData = sanitizeForFirebase(dataToSync);

    // Firebase에 저장
    await set(itemRef, {
      data: sanitizedData,
      updatedAt: Date.now(),
    });

    addSyncLog(
      'firebase',
      'sync',
      `Item synced: ${strategy.collection}/${itemId}`
    );

    return {
      success: true,
      itemId,
      path: itemPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    addSyncLog(
      'firebase',
      'error',
      `Failed to sync item: ${strategy.collection}/${itemId}`,
      undefined,
      error as Error
    );

    return {
      success: false,
      itemId,
      error: errorMessage,
    };
  }
}

/**
 * Firebase에서 단일 아이템을 삭제합니다.
 *
 * @template T 아이템 타입 (타입 정보만 사용)
 * @param strategy 아이템 동기화 전략
 * @param itemId 삭제할 아이템 ID
 * @param uid 사용자 ID
 * @returns 삭제 결과
 *
 * @example
 * ```typescript
 * const result = await deleteItemFromFirebase(taskStrategy, 'task-123', 'user123');
 * if (!result.success) {
 *   console.error('Delete failed:', result.error);
 * }
 * ```
 */
export async function deleteItemFromFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  itemId: string,
  uid: string
): Promise<ItemSyncResult> {
  // Feature flag 체크 - 비활성화 시 no-op
  if (!FEATURE_FLAGS.ITEM_SYNC_ENABLED) {
    return {
      success: true,
      itemId,
      path: undefined,
    };
  }

  try {
    if (!isFirebaseInitialized()) {
      return {
        success: false,
        itemId,
        error: 'Firebase not initialized',
      };
    }

    const db = getFirebaseDatabase();
    const basePath = strategy.getBasePath(uid);
    const itemPath = `${basePath}/${itemId}`;
    const itemRef = ref(db, itemPath);

    // Firebase에서 삭제
    await remove(itemRef);

    addSyncLog(
      'firebase',
      'sync',
      `Item deleted: ${strategy.collection}/${itemId}`
    );

    return {
      success: true,
      itemId,
      path: itemPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    addSyncLog(
      'firebase',
      'error',
      `Failed to delete item: ${strategy.collection}/${itemId}`,
      undefined,
      error as Error
    );

    return {
      success: false,
      itemId,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Batch Operations (Future Phase C)
// ============================================================================

/**
 * 여러 아이템을 배치로 동기화합니다.
 * Phase C에서 구현될 예정입니다.
 *
 * @template T 아이템 타입
 * @param strategy 아이템 동기화 전략
 * @param items 동기화할 아이템 배열
 * @param uid 사용자 ID
 * @returns 배치 동기화 결과
 */
export async function syncItemsBatchToFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  items: T[],
  uid: string
): Promise<{ success: boolean; results: ItemSyncResult[] }> {
  // Phase C에서 구현 예정 - 현재는 순차 실행
  const results: ItemSyncResult[] = [];

  for (const item of items) {
    const result = await syncItemToFirebase(strategy, item, uid);
    results.push(result);
  }

  const success = results.every(r => r.success);

  return { success, results };
}
