/**
 * useCatchUpAlert.ts
 *
 * @file 앱 시작 시 만회 알림 관리 훅
 * @description
 *   - 앱 시작 시 뒤처진 장기목표 확인
 *   - 하루에 한 번만 알림 표시 (같은 날 재시작 시 표시 안 함)
 *   - 뒤처진 목표가 있을 때만 모달 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { calculateBehindGoalsSummary } from '@/features/goals/utils/catchUpUtils';
import type { WeeklyGoal } from '@/shared/types/domain';
import type { CatchUpInfo } from '@/features/goals/utils/catchUpUtils';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';

interface UseCatchUpAlertReturn {
  isOpen: boolean;
  behindGoals: Array<{
    goal: WeeklyGoal;
    catchUpInfo: CatchUpInfo;
  }>;
  closeAlert: () => void;
}

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * 만회 알림 관리 훅
 *
 * 앱 시작 시:
 * 1. 오늘 이미 알림을 표시했는지 확인
 * 2. 뒤처진 목표가 있는지 확인
 * 3. 조건 충족 시 모달 표시
 */
export function useCatchUpAlert(): UseCatchUpAlertReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [behindGoals, setBehindGoals] = useState<
    Array<{ goal: WeeklyGoal; catchUpInfo: CatchUpInfo }>
  >([]);

  const { goals, getTodayTarget, loading } = useWeeklyGoalStore();

  // 알림 닫기 및 오늘 표시 완료 기록
  const closeAlert = useCallback(() => {
    setIsOpen(false);
    void setSystemState(SYSTEM_KEYS.CATCH_UP_ALERT_SHOWN_DATE, getTodayString());
  }, []);

  // 앱 시작 시 알림 표시 여부 결정
  useEffect(() => {
    // 로딩 중이면 대기
    if (loading) return;

    // 목표가 없으면 표시 안 함
    if (goals.length === 0) return;

    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (): Promise<void> => {
      const lastShown = await getSystemState<string>(SYSTEM_KEYS.CATCH_UP_ALERT_SHOWN_DATE);
      if (lastShown === getTodayString()) return;

      // 뒤처진 목표 계산
      const behind = calculateBehindGoalsSummary(goals, getTodayTarget);

      // 뒤처진 목표가 있으면 모달 표시
      if (behind.length > 0 && !isCancelled) {
        setBehindGoals(behind);
        // 약간의 딜레이 후 표시 (앱 로딩 완료 후 자연스럽게)
        timer = setTimeout(() => {
          if (!isCancelled) setIsOpen(true);
        }, 1000);
      }
    };

    void run();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [goals, getTodayTarget, loading]);

  return {
    isOpen,
    behindGoals,
    closeAlert,
  };
}
