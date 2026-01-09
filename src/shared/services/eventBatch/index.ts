/**
 * Event Batch Services - Public API
 *
 * @file index.ts
 * @module shared/services/eventBatch
 *
 * @description 이벤트 배치 처리 서비스의 진입점
 *
 * @role 배치 처리 관련 서비스 내보내기 및 초기화 함수 제공
 * @responsibilities
 *   - taskCompletionBatcher 내보내기
 *   - initEventBatchers()를 통한 일괄 초기화 제공
 */

import {
  initTaskCompletionBatcher,
  flushTaskCompletionBatch,
  cancelTaskCompletionBatch,
  getPendingBatchCount,
} from './taskCompletionBatcher';

export {
  initTaskCompletionBatcher,
  flushTaskCompletionBatch,
  cancelTaskCompletionBatch,
  getPendingBatchCount,
};

/**
 * 모든 이벤트 배치 서비스를 초기화합니다.
 *
 * FEATURE_FLAGS에 따라 각 batcher가 활성화됩니다.
 * 애플리케이션 시작 시 initAllSubscribers() 이후에 호출해야 합니다.
 */
export function initEventBatchers(): void {
  initTaskCompletionBatcher();
}
