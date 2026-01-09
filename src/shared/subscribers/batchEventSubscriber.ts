/**
 * @file batchEventSubscriber.ts
 * @module shared/subscribers
 *
 * @description 배치 이벤트 구독자 - task:completed:batch 등 배치 이벤트 처리
 *
 * @role EventBus를 통해 배치 이벤트를 수신하고 효율적으로 처리
 *
 * @responsibilities
 * - task:completed:batch 이벤트 수신 → 배치 단위로 GameState, XP 등 업데이트
 * - 개별 이벤트 대비 호출 횟수 감소로 성능 최적화
 *
 * @dependencies
 * - eventBus: 이벤트 구독
 * - featureFlags: 기능 플래그
 * - useGameStateStore: 게임 상태 관리
 */

import { eventBus } from '@/shared/lib/eventBus';
import { FEATURE_FLAGS } from '@/shared/constants/featureFlags';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

let initialized = false;

/**
 * 배치 이벤트 Subscriber를 초기화합니다.
 *
 * FEATURE_FLAGS.BATCH_EVENTS_ENABLED가 true일 때만 활성화됩니다.
 * 배치 이벤트를 구독하여 효율적으로 상태를 업데이트합니다.
 *
 * @returns {void}
 */
export function initBatchEventSubscriber(): void {
  if (initialized) return;
  initialized = true;

  // Feature flag 비활성화 시 스킵
  if (!FEATURE_FLAGS.BATCH_EVENTS_ENABLED) {
    if (import.meta.env.DEV) {
      console.debug('[BatchEventSubscriber] Disabled (BATCH_EVENTS_ENABLED = false)');
    }
    return;
  }

  /**
   * task:completed:batch 이벤트 핸들러
   * 여러 task 완료를 한 번에 처리하여 호출 횟수 감소
   */
  eventBus.on('task:completed:batch', async ({ completedTasks, totalXpEarned }) => {
    try {
      const gameStateStore = useGameStateStore.getState();

      // 1. 퀘스트 진행도 일괄 업데이트 (완료된 task 수만큼)
      if (completedTasks.length > 0) {
        await gameStateStore.updateQuestProgress('complete_tasks', completedTasks.length);
      }

      if (import.meta.env.DEV) {
        console.debug(
          `[BatchEventSubscriber] Processed batch: ${completedTasks.length} tasks, ${totalXpEarned} XP`
        );
      }
    } catch (error) {
      console.error('[BatchEventSubscriber] Failed to process task:completed:batch:', error);
    }
  });

  if (import.meta.env.DEV) {
    console.debug('[BatchEventSubscriber] Initialized');
  }
}

/**
 * 초기화 상태 리셋 (테스트용)
 */
export function resetBatchEventSubscriber(): void {
  initialized = false;
}
