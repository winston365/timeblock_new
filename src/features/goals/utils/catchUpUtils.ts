/**
 * catchUpUtils.ts
 *
 * @file 만회 심각도 계산 유틸리티
 * @description
 *   - 만회 심각도 레벨 계산
 *   - 만회 필요량 및 관련 정보 계산
 */

import {
  CatchUpSeverity,
  CATCH_UP_THRESHOLDS,
  CATCH_UP_SEVERITY_CONFIG,
} from '../constants/goalConstants';
import type { WeeklyGoal } from '@/shared/types/domain';

export interface CatchUpInfo {
  /** 심각도 레벨 */
  severity: CatchUpSeverity;
  /** 뒤처진 양 (todayTarget - currentProgress) */
  catchUpNeeded: number;
  /** 뒤처진 비율 (catchUpNeeded / dailyTarget) */
  behindRatio: number;
  /** 심각도 설정 (아이콘, 색상 등) */
  config: (typeof CATCH_UP_SEVERITY_CONFIG)[CatchUpSeverity];
  /** 뒤처졌는지 여부 */
  isBehind: boolean;
  /** 목표 달성 여부 */
  isCompleted: boolean;
}

/**
 * 만회 심각도 계산
 *
 * @param catchUpNeeded - 만회 필요량
 * @param dailyTarget - 하루 목표량 (주간 목표 / 7)
 * @returns 심각도 레벨
 */
export function calculateCatchUpSeverity(
  catchUpNeeded: number,
  dailyTarget: number
): CatchUpSeverity {
  if (catchUpNeeded <= 0 || dailyTarget <= 0) {
    return 'safe';
  }

  const behindRatio = catchUpNeeded / dailyTarget;

  if (behindRatio >= CATCH_UP_THRESHOLDS.DANGER_RATIO) {
    return 'danger';
  }
  if (behindRatio >= CATCH_UP_THRESHOLDS.WARNING_RATIO) {
    return 'warning';
  }
  // 하루치 미만으로 뒤처진 경우도 경고로 표시
  return 'warning';
}

/**
 * 만회 정보 전체 계산
 *
 * @param goal - 주간 목표
 * @param todayTarget - 오늘까지의 누적 목표량
 * @returns 만회 정보 객체
 */
export function calculateCatchUpInfo(
  goal: WeeklyGoal,
  todayTarget: number
): CatchUpInfo {
  const isCompleted = goal.currentProgress >= goal.target;
  const isBehind = goal.currentProgress < todayTarget && !isCompleted;
  const catchUpNeeded = Math.max(0, todayTarget - goal.currentProgress);
  const dailyTarget = goal.target / 7;
  const behindRatio = dailyTarget > 0 ? catchUpNeeded / dailyTarget : 0;

  const severity: CatchUpSeverity =
    isCompleted || !isBehind
      ? 'safe'
      : calculateCatchUpSeverity(catchUpNeeded, dailyTarget);

  return {
    severity,
    catchUpNeeded,
    behindRatio,
    config: CATCH_UP_SEVERITY_CONFIG[severity],
    isBehind,
    isCompleted,
  };
}

/**
 * 뒤처진 목표들 요약 정보 계산
 * (앱 시작 시 알림용)
 *
 * @param goals - 주간 목표 배열
 * @param getTodayTarget - 오늘 목표량 계산 함수
 * @returns 뒤처진 목표 정보 배열
 */
export function calculateBehindGoalsSummary(
  goals: WeeklyGoal[],
  getTodayTarget: (target: number) => number
): Array<{
  goal: WeeklyGoal;
  catchUpInfo: CatchUpInfo;
}> {
  return goals
    .map((goal) => ({
      goal,
      catchUpInfo: calculateCatchUpInfo(goal, getTodayTarget(goal.target)),
    }))
    .filter(({ catchUpInfo }) => catchUpInfo.isBehind)
    .sort((a, b) => {
      // 심각도 우선 정렬 (danger > warning > safe)
      const severityOrder: Record<CatchUpSeverity, number> = {
        danger: 0,
        warning: 1,
        safe: 2,
      };
      return (
        severityOrder[a.catchUpInfo.severity] -
        severityOrder[b.catchUpInfo.severity]
      );
    });
}
