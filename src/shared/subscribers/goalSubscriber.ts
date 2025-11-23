/**
 * Goal Subscriber
 * 
 * @description 목표 진행률 재계산
 */

import { eventBus } from '@/shared/lib/eventBus';
import { recalculateGlobalGoalProgress } from '@/data/repositories';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGoalStore } from '@/shared/stores/goalStore';
import { getLocalDate } from '@/shared/lib/utils';

/**
 * Goal Subscriber 초기화
 */
export function initGoalSubscriber(): void {
    // Goal 진행률 변경 이벤트 처리
    eventBus.on('goal:progressChanged', async ({ goalId }) => {
        if (!goalId) return;

        try {
            const currentDate = getLocalDate();
            await recalculateGlobalGoalProgress(goalId, currentDate);

            // 🔄 Goal Store와 Daily Data Store 모두 갱신
            await Promise.all([
                useGoalStore.getState().refresh(),
                useDailyDataStore.getState().refresh()
            ]);

            console.log(`✅ [GoalSubscriber] Recalculated progress for goal: ${goalId}`);
        } catch (error) {
            console.error('[GoalSubscriber] Failed to recalculate goal progress:', error);
        }
    });

    console.log('✅ [GoalSubscriber] Initialized');
}
