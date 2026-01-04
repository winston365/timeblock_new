/**
 * goalsFilterUtils.ts
 *
 * @file 목표 필터링 유틸리티
 * @description
 *   - T11: "오늘만 보기" 필터링 로직
 *   - 컴포넌트와 분리하여 react-refresh 경고 해소
 */

import type { WeeklyGoal } from '@/shared/types/domain';
import { getTodayTarget, getDayOfWeekIndex } from '@/data/repositories/weeklyGoalRepository';

/**
 * 오늘 할당량이 있는 목표인지 확인
 */
export function hasTaskForToday(goal: WeeklyGoal): boolean {
  // 이미 완료된 목표는 오늘 할 일 없음
  if (goal.currentProgress >= goal.target) return false;
  
  // 오늘까지 해야 하는 목표량 계산
  const dayIndex = getDayOfWeekIndex();
  const todayTarget = getTodayTarget(goal.target, dayIndex);
  
  // 현재 진행도가 오늘 목표량보다 적으면 오늘 할 일 있음
  return goal.currentProgress < todayTarget || goal.currentProgress < goal.target;
}

/**
 * 필터 적용 함수 (WeeklyGoalPanel에서 사용)
 */
export function filterGoals(goals: WeeklyGoal[], filterTodayOnly: boolean): WeeklyGoal[] {
  if (!filterTodayOnly) return goals;
  return goals.filter(hasTaskForToday);
}
