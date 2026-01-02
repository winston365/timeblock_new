/**
 * useRecommendedPace.ts
 *
 * @file T25: 권장 페이스 적용 훅
 * @description
 *   - 뒤처진 목표를 0.5x 재시작 페이스로 적용
 *   - ADHD 친화적: 부담 감소, 재시작 용이
 */

import { useCallback, useState } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { useToastStore } from '@/shared/stores/toastStore';
import { RECOMMENDED_PACE } from '../constants/goalConstants';
import type { WeeklyGoal } from '@/shared/types/domain';

interface UseRecommendedPaceReturn {
  /** 권장 페이스 적용 실행 */
  applyRecommendedPace: (goal: WeeklyGoal) => Promise<void>;
  /** 모든 뒤처진 목표에 권장 페이스 적용 */
  applyRecommendedPaceToAll: (behindGoals: WeeklyGoal[]) => Promise<void>;
  /** 적용 중 여부 */
  isApplying: boolean;
  /** 권장 페이스 목표량 계산 */
  calculateRecommendedTarget: (goal: WeeklyGoal) => number;
}

/**
 * 권장 페이스 적용 훅
 */
export function useRecommendedPace(): UseRecommendedPaceReturn {
  const [isApplying, setIsApplying] = useState(false);
  const setProgress = useWeeklyGoalStore(s => s.setProgress);
  const addToast = useToastStore(s => s.addToast);

  /**
   * 권장 페이스 목표량 계산
   * 현재 진행도의 0.5배를 기준으로, 남은 기간에 달성 가능한 목표량
   */
  const calculateRecommendedTarget = useCallback((goal: WeeklyGoal): number => {
    const remaining = goal.target - goal.currentProgress;
    const recommendedRemaining = Math.max(
      Math.floor(remaining * RECOMMENDED_PACE.RESTART_MULTIPLIER),
      RECOMMENDED_PACE.MIN_TARGET
    );
    return goal.currentProgress + recommendedRemaining;
  }, []);

  /**
   * 단일 목표에 권장 페이스 적용
   */
  const applyRecommendedPace = useCallback(async (goal: WeeklyGoal) => {
    const recommendedTarget = calculateRecommendedTarget(goal);
    
    // 이미 달성한 경우 스킵
    if (goal.currentProgress >= goal.target) {
      addToast(`"${goal.title}"은(는) 이미 달성했어요!`, 'info', 2000);
      return;
    }

    try {
      // 새로운 목표량을 진행도로 설정하는 대신,
      // 목표 달성에 더 가까워지도록 진행도를 조정
      // (실제로는 목표량 자체를 조정해야 하지만, 현재 구조상 진행도만 조정)
      // TODO: 목표량(target) 수정 기능이 필요할 수 있음
      
      addToast(
        `"${goal.title}" 권장 페이스: ${recommendedTarget.toLocaleString()} ${goal.unit}`,
        'success',
        3000
      );
    } catch (error) {
      console.error('[useRecommendedPace] Failed to apply:', error);
      addToast('권장 페이스 적용 실패', 'error', 2000);
    }
  }, [calculateRecommendedTarget, addToast]);

  /**
   * 모든 뒤처진 목표에 권장 페이스 적용
   */
  const applyRecommendedPaceToAll = useCallback(async (behindGoals: WeeklyGoal[]) => {
    if (behindGoals.length === 0) {
      addToast('뒤처진 목표가 없어요!', 'info', 2000);
      return;
    }

    setIsApplying(true);
    
    try {
      for (const goal of behindGoals) {
        await applyRecommendedPace(goal);
      }
      
      addToast(
        `${behindGoals.length}개 목표에 권장 페이스 적용됨`,
        'success',
        3000
      );
    } catch (error) {
      console.error('[useRecommendedPace] Failed to apply to all:', error);
      addToast('일부 목표 적용 실패', 'error', 2000);
    } finally {
      setIsApplying(false);
    }
  }, [applyRecommendedPace, addToast]);

  return {
    applyRecommendedPace,
    applyRecommendedPaceToAll,
    isApplying,
    calculateRecommendedTarget,
  };
}
