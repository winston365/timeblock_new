/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sync Retry Queue
 *
 * @role Firebase 동기화 실패 시 재시도를 관리하는 큐 시스템
 * @input 실패한 동기화 작업
 * @output 재시도 로직, 에러 알림 콜백
 * @external_dependencies
 *   - addSyncLog: 동기화 로그 기록
 */

import { addSyncLog } from '../syncLogger';

// ============================================================================
// Types
// ============================================================================

interface RetryItem<T> {
  id: string;
  strategy: {
    collection: string;
    getUserId?: () => string;
  };
  data: T;
  key?: string;
  retryCount: number;
  maxRetries: number;
  lastAttempt: number;
  syncFunction: () => Promise<void>;
}

interface SyncErrorCallback {
  (collection: string, message: string, canRetry: boolean): void;
}

// ============================================================================
// Retry Queue State
// ============================================================================

const retryQueue: Map<string, RetryItem<any>> = new Map();
let errorCallback: SyncErrorCallback | null = null;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s

// ============================================================================
// Public API
// ============================================================================

/**
 * 에러 콜백 등록 (토스트 알림 표시용)
 *
 * @param {SyncErrorCallback} callback - 에러 발생 시 호출될 콜백
 */
export function setErrorCallback(callback: SyncErrorCallback) {
  errorCallback = callback;
}

/**
 * 동기화 작업을 재시도 큐에 추가
 *
 * @template T 데이터 타입
 * @param {string} id - 작업 고유 ID
 * @param {Object} strategy - 동기화 전략
 * @param {T} data - 동기화할 데이터
 * @param {string} key - 데이터 키
 * @param {Function} syncFunction - 재시도할 동기화 함수
 * @param {number} maxRetries - 최대 재시도 횟수 (기본: 3)
 */
export function addToRetryQueue<T>(
  id: string,
  strategy: { collection: string; getUserId?: () => string },
  data: T,
  key: string | undefined,
  syncFunction: () => Promise<void>,
  maxRetries = DEFAULT_MAX_RETRIES
) {
  const existingItem = retryQueue.get(id);

  if (existingItem) {
    // 이미 큐에 있으면 재시도 횟수만 증가
    existingItem.retryCount++;
    existingItem.lastAttempt = Date.now();
  } else {
    // 새로운 항목 추가
    retryQueue.set(id, {
      id,
      strategy,
      data,
      key,
      retryCount: 0,
      maxRetries,
      lastAttempt: Date.now(),
      syncFunction,
    });
  }

  addSyncLog('firebase', 'retry', `Added to retry queue: ${strategy.collection}/${key || 'root'}`);
}

/**
 * 재시도 큐에서 작업 제거
 *
 * @param {string} id - 작업 고유 ID
 */
export function removeFromRetryQueue(id: string) {
  retryQueue.delete(id);
}

/**
 * 특정 작업을 즉시 재시도
 *
 * @param {string} id - 작업 고유 ID
 * @returns {Promise<boolean>} 재시도 성공 여부
 */
export async function retryNow(id: string): Promise<boolean> {
  const item = retryQueue.get(id);

  if (!item) {
    console.warn(`Retry item not found: ${id}`);
    return false;
  }

  if (item.retryCount >= item.maxRetries) {
    addSyncLog(
      'firebase',
      'error',
      `Max retries exceeded for ${item.strategy.collection}/${item.key || 'root'}`
    );

    // 에러 콜백 호출 (재시도 불가)
    if (errorCallback) {
      errorCallback(
        item.strategy.collection,
        `최대 재시도 횟수를 초과했습니다 (${item.maxRetries}회)`,
        false
      );
    }

    removeFromRetryQueue(id);
    return false;
  }

  try {
    addSyncLog(
      'firebase',
      'retry',
      `Retrying ${item.strategy.collection}/${item.key || 'root'} (attempt ${item.retryCount + 1}/${item.maxRetries})`
    );

    await item.syncFunction();

    addSyncLog(
      'firebase',
      'sync',
      `Retry successful: ${item.strategy.collection}/${item.key || 'root'}`
    );

    removeFromRetryQueue(id);
    return true;
  } catch (error) {
    item.retryCount++;
    item.lastAttempt = Date.now();

    addSyncLog(
      'firebase',
      'error',
      `Retry failed for ${item.strategy.collection}/${item.key || 'root'} (attempt ${item.retryCount}/${item.maxRetries})`,
      undefined,
      error as Error
    );

    // 재시도 가능 여부 확인
    const canRetry = item.retryCount < item.maxRetries;

    // 에러 콜백 호출
    if (errorCallback) {
      errorCallback(
        item.strategy.collection,
        canRetry
          ? `동기화 실패 (재시도 ${item.retryCount}/${item.maxRetries})`
          : `동기화 실패 (최대 재시도 초과)`,
        canRetry
      );
    }

    if (!canRetry) {
      removeFromRetryQueue(id);
    } else {
      // 자동 재시도 예약
      scheduleRetry(id);
    }

    return false;
  }
}

/**
 * 지연 후 자동 재시도 예약
 *
 * @param {string} id - 작업 고유 ID
 */
function scheduleRetry(id: string) {
  const item = retryQueue.get(id);

  if (!item) return;

  const retryIndex = Math.min(item.retryCount - 1, RETRY_DELAYS.length - 1);
  const delay = RETRY_DELAYS[retryIndex];

  addSyncLog(
    'firebase',
    'retry',
    `Scheduling retry for ${item.strategy.collection}/${item.key || 'root'} in ${delay}ms`
  );

  setTimeout(() => {
    retryNow(id);
  }, delay);
}

/**
 * 모든 재시도 큐 항목 반환 (디버깅용)
 *
 * @returns {Array} 재시도 큐 항목 배열
 */
export function getRetryQueue() {
  return Array.from(retryQueue.values());
}

/**
 * 재시도 큐 초기화
 */
export function clearRetryQueue() {
  retryQueue.clear();
  addSyncLog('firebase', 'info', 'Retry queue cleared');
}

/**
 * 재시도 큐의 모든 항목을 순차적으로 재시도합니다 (Drain).
 * 네트워크 재연결 시 호출하여 대기 중인 모든 동기화 작업을 처리합니다.
 *
 * @returns {Promise<{ success: number; failed: number }>} 성공/실패 수
 */
export async function drainRetryQueue(): Promise<{ success: number; failed: number }> {
  const ids = Array.from(retryQueue.keys());
  let success = 0;
  let failed = 0;

  addSyncLog('firebase', 'info', `Draining retry queue: ${ids.length} items`);

  for (const id of ids) {
    const ok = await retryNow(id);
    if (ok) {
      success++;
    } else {
      failed++;
    }
  }

  addSyncLog('firebase', 'info', `Retry queue drained: ${success} succeeded, ${failed} failed`);

  return { success, failed };
}

/**
 * 재시도 큐 크기 반환
 *
 * @returns {number} 현재 큐에 있는 항목 수
 */
export function getRetryQueueSize(): number {
  return retryQueue.size;
}
