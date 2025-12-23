/**
 * useCatchUpAlertBanner.ts
 *
 * @file 만회 알림 배너 관리 훅 (모달 대체)
 * @description
 *   - 앱 시작 시 뒤처진 장기목표 확인
 *   - 배너 표시/숨기기 및 스누즈 관리
 *   - Dexie systemState에 스누즈 상태 저장 (localStorage 미사용)
 *   - 스누즈 만료 후 자동 표시 (모달 없이 배너만)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { calculateBehindGoalsSummary } from '@/features/goals/utils/catchUpUtils';
import type { WeeklyGoal } from '@/shared/types/domain';
import type { CatchUpInfo } from '@/features/goals/utils/catchUpUtils';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';

interface UseCatchUpAlertBannerReturn {
  /** 배너 표시 여부 */
  isVisible: boolean;
  /** 뒤처진 목표들 */
  behindGoals: Array<{
    goal: WeeklyGoal;
    catchUpInfo: CatchUpInfo;
  }>;
  /** 배너 닫기 (오늘 더 이상 표시 안 함) */
  dismissBanner: () => void;
  /** 스누즈 (일정 시간 후 다시 표시) */
  snoozeBanner: (durationMinutes: number) => void;
}

/** 스누즈 상태 저장 구조 */
interface CatchUpSnoozeState {
  /** 스누즈 만료 시각 (ISO 8601) */
  snoozeUntil: string | null;
  /** 오늘 닫기 처리 날짜 (YYYY-MM-DD) */
  dismissedDate: string | null;
}

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * 만회 알림 배너 관리 훅
 *
 * 앱 시작 시:
 * 1. 오늘 이미 닫았는지 확인
 * 2. 스누즈 중인지 확인
 * 3. 뒤처진 목표가 있는지 확인
 * 4. 조건 충족 시 배너 표시
 */
export function useCatchUpAlertBanner(): UseCatchUpAlertBannerReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [behindGoals, setBehindGoals] = useState<
    Array<{ goal: WeeklyGoal; catchUpInfo: CatchUpInfo }>
  >([]);

  const { goals, getTodayTarget, loading } = useWeeklyGoalStore();
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 스누즈 타이머 정리
  useEffect(() => {
    return () => {
      if (snoozeTimerRef.current) {
        clearTimeout(snoozeTimerRef.current);
      }
    };
  }, []);

  // 배너 닫기 (오늘 더 이상 표시 안 함)
  const dismissBanner = useCallback(async () => {
    setIsVisible(false);

    const state = await getSystemState<CatchUpSnoozeState>(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);
    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      ...state,
      snoozeUntil: null,
      dismissedDate: getTodayString(),
    });
  }, []);

  // 스누즈 (일정 시간 후 다시 표시)
  const snoozeBanner = useCallback(async (durationMinutes: number) => {
    setIsVisible(false);

    const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      snoozeUntil,
      dismissedDate: null, // 스누즈하면 닫기 상태 초기화
    });

    // 스누즈 만료 후 배너 다시 표시 (자동 - 모달 없이)
    snoozeTimerRef.current = setTimeout(() => {
      // 뒤처진 목표가 여전히 있으면 배너 표시
      const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
      if (behind.length > 0) {
        setBehindGoals(behind);
        setIsVisible(true);
      }
    }, durationMinutes * 60 * 1000);
  }, [goals, getTodayTarget]);

  // 배너 표시 여부 결정
  useEffect(() => {
    // 로딩 중이면 대기
    if (loading) return;

    // 목표가 없으면 표시 안 함
    if (goals.length === 0) return;

    let isCancelled = false;

    const checkVisibility = async (): Promise<void> => {
      const state = await getSystemState<CatchUpSnoozeState>(
        SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE
      );

      // 오늘 이미 닫았으면 표시 안 함
      if (state?.dismissedDate === getTodayString()) {
        return;
      }

      // 스누즈 중이면 표시 안 함
      if (state?.snoozeUntil) {
        const snoozeExpiry = new Date(state.snoozeUntil);
        if (snoozeExpiry > new Date()) {
          // 스누즈 만료 시 자동 체크 설정
          const remainingMs = snoozeExpiry.getTime() - Date.now();
          snoozeTimerRef.current = setTimeout(() => {
            if (isCancelled) return;
            const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
            if (behind.length > 0) {
              setBehindGoals(behind);
              setIsVisible(true);
            }
          }, remainingMs);
          return;
        }
      }

      // 뒤처진 목표 계산
      const behind = calculateBehindGoalsSummary(goals, getTodayTarget);

      // 뒤처진 목표가 있으면 배너 표시
      if (behind.length > 0 && !isCancelled) {
        setBehindGoals(behind);
        // 약간의 딜레이 후 표시 (앱 로딩 완료 후 자연스럽게)
        setTimeout(() => {
          if (!isCancelled) setIsVisible(true);
        }, 500);
      }
    };

    void checkVisibility();

    return () => {
      isCancelled = true;
    };
  }, [goals, getTodayTarget, loading]);

  return {
    isVisible,
    behindGoals,
    dismissBanner,
    snoozeBanner,
  };
}
