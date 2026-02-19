/**
 * @file battleTaskCompletionSubscriber.ts
 * @module shared/subscribers
 *
 * @description Task 완료 이벤트를 전투 데미지로 변환하는 구독자
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useBattleStore } from '@/features/battle/stores/battleStore';

let initialized = false;
const processedTaskIds = new Set<string>();

export function initBattleTaskCompletionSubscriber(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  eventBus.on('task:completed', async ({ taskId, adjustedDuration }) => {
    if (processedTaskIds.has(taskId)) {
      return;
    }

    processedTaskIds.add(taskId);

    try {
      await useBattleStore.getState().applyTaskCompletionDamage({
        taskId,
        adjustedDuration,
      });
    } catch (error) {
      // 오류 시 재시도를 위해 락 해제
      processedTaskIds.delete(taskId);
      console.error('[BattleTaskCompletionSubscriber] Failed to apply task completion damage:', error);
    }
  });

  // 사용자가 완료 취소 후 다시 완료할 수 있도록 taskId 락 해제
  eventBus.on('task:uncompleted', ({ taskId }) => {
    processedTaskIds.delete(taskId);
  });
}

export function resetBattleTaskCompletionSubscriber(): void {
  initialized = false;
  processedTaskIds.clear();
}
