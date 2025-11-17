/**
 * Goal Progress Handler
 *
 * @role 작업 완료/미완료 시 연결된 목표의 진행률 자동 업데이트
 * @responsibility 단일 책임: 목표 진행률 재계산만 처리
 */

import type { TaskCompletionHandler, TaskCompletionContext } from '../types';
import { recalculateGoalProgress } from '@/data/repositories/dailyGoalRepository';

/**
 * 목표 진행률 업데이트 핸들러
 *
 * @description 작업이 완료/미완료될 때 연결된 목표의 진행률을 재계산합니다.
 * - plannedMinutes: 목표에 연결된 모든 작업의 adjustedDuration 합계
 * - completedMinutes: 목표에 연결된 완료된 작업의 actualDuration (또는 adjustedDuration) 합계
 */
export class GoalProgressHandler implements TaskCompletionHandler {
  name = 'GoalProgressHandler';

  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameState').GameStateEvent[]> {
    const { task, date } = context;

    // 목표가 연결되어 있지 않으면 스킵
    if (!task.goalId) {
      return [];
    }

    try {
      // 목표 진행률 재계산
      await recalculateGoalProgress(date, task.goalId);
      console.log(`[${this.name}] ✅ Updated progress for goal: ${task.goalId}`);
    } catch (error) {
      console.error(`[${this.name}] ❌ Failed to update goal progress:`, error);
      // 에러가 발생해도 작업 완료 자체는 성공시킴 (목표 진행률은 나중에 수동으로도 재계산 가능)
    }

    // 이벤트 없음 (UI 토스트 등 불필요)
    return [];
  }
}
