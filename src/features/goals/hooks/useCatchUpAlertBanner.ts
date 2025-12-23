/**
 * useCatchUpAlertBanner.ts
 *
 * @file 만회 알림 배너 관리 훅 (모달 대체)
 * @description
 *   - 앱 시작 시 뒤처진 장기목표 확인
 *   - 배너 표시/숨기기 및 스누즈 관리
 *   - Dexie systemState에 스누즈 상태 저장 (localStorage 미사용)
 *   - 스누즈 만료 후 자동 모달 금지 (배너만 표시)
 *   - 사용자 주도 재오픈 진입점 제공
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { calculateBehindGoalsSummary, type CatchUpInfo } from '@/features/goals/utils/catchUpUtils';
import type { WeeklyGoal } from '@/shared/types/domain';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { CATCH_UP_DEFAULTS, type CatchUpSnoozeState } from '@/shared/constants/defaults';

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
  /** 스누즈 종료 시각 (ISO 8601) */
  snoozeUntil: string | null;
  /** 배너 재오픈 (사용자 주도) */
  reopenBanner: () => void;
  /** 위험 상태 목표가 있는지 */
  hasDangerGoals: boolean;
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
 * 
 * 스누즈 만료 후:
 * - 자동 모달 금지 (배너만 표시)
 * - 사용자가 배너 클릭 시 모달 열기
 */
export function useCatchUpAlertBanner(): UseCatchUpAlertBannerReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(null);
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
    setSnoozeUntil(null);

    const state = await getSystemState<CatchUpSnoozeState>(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);
    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      ...state,
      snoozeUntil: null,
      dismissedDate: getTodayString(),
    });
  }, []);

  // 스누즈 (일정 시간 후 다시 표시)
  const snoozeBanner = useCallback(async (durationMinutes: number = CATCH_UP_DEFAULTS.DEFAULT_SNOOZE_MINUTES) => {
    setIsVisible(false);

    const snoozeEndTime = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    setSnoozeUntil(snoozeEndTime);

    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      snoozeUntil: snoozeEndTime,
      dismissedDate: null, // 스누즈하면 닫기 상태 초기화
    });

    // 스누즈 만료 후 배너 다시 표시 (자동 모달 금지 - 배너만)
    snoozeTimerRef.current = setTimeout(() => {
      // 뒤처진 목표가 여전히 있으면 배너 표시
      const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
      if (behind.length > 0) {
        setBehindGoals(behind);
        setIsVisible(true);
        setSnoozeUntil(null);
      }
    }, durationMinutes * 60 * 1000);
  }, [goals, getTodayTarget]);

  // 배너 재오픈 (사용자 주도)
  const reopenBanner = useCallback(async () => {
    // 스누즈 타이머 취소
    if (snoozeTimerRef.current) {
      clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }

    // 스누즈/닫기 상태 초기화
    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      snoozeUntil: null,
      dismissedDate: null,
    });
    setSnoozeUntil(null);

    // 뒤처진 목표 다시 계산 및 표시
    const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
    if (behind.length > 0) {
      setBehindGoals(behind);
      setIsVisible(true);
    }
  }, [goals, getTodayTarget]);

  // 위험 목표 여부 계산
  const hasDangerGoals = behindGoals.some(
    ({ catchUpInfo }) => catchUpInfo.severity === 'danger'
  );

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
        // 하지만 뒤처진 목표 정보는 업데이트 (재오픈 버튼용)
        const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
        if (!isCancelled) {
          setBehindGoals(behind);
        }
        return;
      }

      // 스누즈 중이면 표시 안 함
      if (state?.snoozeUntil) {
        const snoozeExpiry = new Date(state.snoozeUntil);
        if (snoozeExpiry > new Date()) {
          // 스누즈 상태 업데이트
          if (!isCancelled) {
            setSnoozeUntil(state.snoozeUntil);
            // 뒤처진 목표 정보는 업데이트 (재오픈 버튼용)
            const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
            setBehindGoals(behind);
          }

          // 스누즈 만료 시 자동 체크 설정 (배너만 표시, 모달 금지)
          const remainingMs = snoozeExpiry.getTime() - Date.now();
          snoozeTimerRef.current = setTimeout(() => {
            if (isCancelled) return;
            const behind = calculateBehindGoalsSummary(goals, getTodayTarget);
            if (behind.length > 0) {
              setBehindGoals(behind);
              setIsVisible(true);
              setSnoozeUntil(null);
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
    snoozeUntil,
    reopenBanner,
    hasDangerGoals,
  };
}
