/**
 * useQuotaAchievement.ts
 *
 * @file 오늘의 할당량 달성 추적 및 축하 훅
 * @description
 *   - Role: 목표의 오늘 할당량 달성 여부 추적
 *   - Responsibilities:
 *     - 목표별 오늘 할당량 달성 시 토스트 표시 (1회)
 *     - 달성 상태를 systemState에 저장하여 중복 방지
 *     - 날짜가 바뀌면 자동 리셋
 *   - Key Dependencies:
 *     - systemRepository: 달성 상태 영속성
 *     - react-hot-toast: 토스트 표시
 */

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import QuotaAchievementToast from '../components/QuotaAchievementToast';
import type { WeeklyGoal } from '@/shared/types/domain';

/** 오늘 할당량 달성 상태 저장 구조 */
interface QuotaAchievedState {
  /** 기록 날짜 (YYYY-MM-DD) */
  date: string;
  /** 오늘 달성한 목표 ID 목록 */
  achievedGoalIds: string[];
}

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * 오늘의 할당량 달성 추적 훅
 *
 * @description
 *   - 목표의 currentProgress가 todayTarget에 도달하면 축하 토스트 표시
 *   - 각 목표당 하루에 1회만 표시
 *   - 날짜가 바뀌면 자동 리셋
 *
 * @returns 달성 상태 확인 함수
 */
export function useQuotaAchievement() {
  const { goals, getTodayTarget } = useWeeklyGoalStore();
  const previousProgressRef = useRef<Record<string, number>>({});
  const achievedGoalsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // 달성 상태 로드 및 초기화
  useEffect(() => {
    const initState = async () => {
      const state = await getSystemState<QuotaAchievedState>(
        SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS
      );

      const today = getTodayString();

      if (state?.date === today) {
        // 오늘 기록이 있으면 복원
        achievedGoalsRef.current = new Set(state.achievedGoalIds);
      } else {
        // 날짜가 다르면 리셋
        achievedGoalsRef.current = new Set();
        await setSystemState(SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS, {
          date: today,
          achievedGoalIds: [],
        });
      }

      // 현재 진행도 스냅샷 저장 (초기 로드 시 토스트 방지)
      goals.forEach((goal) => {
        previousProgressRef.current[goal.id] = goal.currentProgress;
      });

      initializedRef.current = true;
    };

    void initState();
  }, []); // 초기화는 한 번만

  // 달성 상태 저장
  const saveAchievedState = useCallback(async (goalId: string) => {
    achievedGoalsRef.current.add(goalId);
    await setSystemState(SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS, {
      date: getTodayString(),
      achievedGoalIds: Array.from(achievedGoalsRef.current),
    });
  }, []);

  // 축하 토스트 표시
  const showCelebrationToast = useCallback((goal: WeeklyGoal) => {
    toast.custom(
      (t) => QuotaAchievementToast({
        goalTitle: goal.title,
        goalIcon: goal.icon,
        t,
      }),
      {
        duration: 4000,
        position: 'top-right',
      }
    );
  }, []);

  // 목표 진행도 변경 감지
  useEffect(() => {
    if (!initializedRef.current || goals.length === 0) return;

    goals.forEach((goal) => {
      const prevProgress = previousProgressRef.current[goal.id] ?? 0;
      const currentProgress = goal.currentProgress;
      const todayTarget = getTodayTarget(goal.target);

      // 진행도가 증가했고, 오늘 목표를 새로 달성한 경우
      const wasBelow = prevProgress < todayTarget;
      const isNowAbove = currentProgress >= todayTarget;
      const notYetCelebrated = !achievedGoalsRef.current.has(goal.id);
      const notFullyCompleted = currentProgress < goal.target; // 전체 목표 달성 시에는 다른 축하 표시

      if (wasBelow && isNowAbove && notYetCelebrated && notFullyCompleted) {
        showCelebrationToast(goal);
        void saveAchievedState(goal.id);
      }

      // 진행도 스냅샷 업데이트
      previousProgressRef.current[goal.id] = currentProgress;
    });
  }, [goals, getTodayTarget, showCelebrationToast, saveAchievedState]);

  /**
   * 특정 목표가 오늘 할당량을 달성했는지 확인
   */
  const isQuotaAchieved = useCallback(
    (goalId: string): boolean => {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return false;

      const todayTarget = getTodayTarget(goal.target);
      return goal.currentProgress >= todayTarget;
    },
    [goals, getTodayTarget]
  );

  return {
    isQuotaAchieved,
  };
}
