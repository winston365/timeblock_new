/**
 * Goal Subscriber
 * 
 * @description 목표 진행률 재계산 (Store 간 순환 의존성 해소)
 */

import { eventBus } from '@/shared/lib/eventBus';
import { recalculateGlobalGoalProgress } from '@/data/repositories';
import { useGoalStore } from '@/shared/stores/goalStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
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
            // NOTE: 여기서는 Store를 직접 호출하지만, goalSubscriber는 
            // 오직 goal 관련 이벤트만 처리하므로 순환 의존성이 발생하지 않음
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
