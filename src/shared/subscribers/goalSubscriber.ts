/**
 * @file goalSubscriber.ts
 * @module shared/subscribers
 * 
 * @description Goal Subscriber - 목표 진행률 재계산 이벤트 처리
 * 
 * @role EventBus를 통해 목표 진행률 변경 이벤트를 수신하고 Store를 동기화
 * 
 * @responsibilities
 * - goal:progressChanged 이벤트 수신 → 목표 진행률 재계산
 * - GoalStore 및 DailyDataStore 갱신
 * - Store 간 순환 의존성 해소
 * 
 * @dependencies
 * - eventBus: 이벤트 구독
 * - recalculateGlobalGoalProgress: 목표 진행률 재계산
 * - useGoalStore: 목표 상태 관리
 * - useDailyDataStore: 일일 데이터 상태 관리
 */

import { eventBus } from '@/shared/lib/eventBus';
import { recalculateGlobalGoalProgress } from '@/data/repositories';
import { useGoalStore } from '@/shared/stores/goalStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { getLocalDate } from '@/shared/lib/utils';

/**
 * Goal Subscriber를 초기화합니다.
 * 
 * goal:progressChanged 이벤트를 구독하고 목표 진행률을 재계산한 후
 * GoalStore와 DailyDataStore를 갱신합니다.
 * 
 * @returns {void}
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
        } catch (error) {
            console.error('[GoalSubscriber] Failed to recalculate goal progress:', error);
        }
    });
}
