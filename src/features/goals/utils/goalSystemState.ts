/**
 * goalSystemState.ts
 *
 * @file Goals 관련 systemState 헬퍼
 * @description
 *   - T03: systemState 로드/세이브 경로 표준화
 *   - Goals 관련 systemState 접근을 중앙화
 *   - 타입 안전한 읽기/쓰기 제공
 */

import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { 
  SYSTEM_STATE_DEFAULTS, 
  type GoalsProgressChange 
} from '@/shared/constants/defaults';

// ============================================================================
// Goals SystemState 타입
// ============================================================================

export interface GoalsSystemState {
  /** 목표 필터: 오늘만 보기 */
  filterTodayOnly: boolean;
  /** 목표 카드 축소 모드 */
  compactMode: boolean;
  /** 고급 입력 UI 활성화 */
  advancedInputEnabled: boolean;
  /** 주간 리셋 배너 마지막 본 주 */
  resetBannerLastSeenWeek: string | null;
  /** Catch-up 스누즈된 주 */
  catchUpSnoozedWeek: string | null;
  /** 더보기 힌트 노출 여부 */
  expandHintShown: boolean;
  /** 테마 필터 */
  themeFilter: string | null;
  /** 마지막 진행도 변경 (Undo용) */
  lastProgressChange: GoalsProgressChange | null;
}

// ============================================================================
// 개별 키 읽기/쓰기 함수
// ============================================================================

/**
 * 오늘만 보기 필터 상태 조회
 */
export async function getGoalsFilterTodayOnly(): Promise<boolean> {
  const value = await getSystemState<boolean>(SYSTEM_KEYS.GOALS_FILTER_TODAY_ONLY);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsFilterTodayOnly;
}

/**
 * 오늘만 보기 필터 상태 설정
 */
export async function setGoalsFilterTodayOnly(value: boolean): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_FILTER_TODAY_ONLY, value);
}

/**
 * 축소 모드 상태 조회
 */
export async function getGoalsCompactMode(): Promise<boolean> {
  const value = await getSystemState<boolean>(SYSTEM_KEYS.GOALS_COMPACT_MODE);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsCompactMode;
}

/**
 * 축소 모드 상태 설정
 */
export async function setGoalsCompactMode(value: boolean): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_COMPACT_MODE, value);
}

/**
 * 고급 입력 활성화 상태 조회
 */
export async function getGoalsAdvancedInputEnabled(): Promise<boolean> {
  const value = await getSystemState<boolean>(SYSTEM_KEYS.GOALS_ADVANCED_INPUT_ENABLED);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsAdvancedInputEnabled;
}

/**
 * 고급 입력 활성화 상태 설정
 */
export async function setGoalsAdvancedInputEnabled(value: boolean): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_ADVANCED_INPUT_ENABLED, value);
}

/**
 * 주간 리셋 배너 마지막 본 주 조회
 */
export async function getGoalsResetBannerLastSeenWeek(): Promise<string | null> {
  const value = await getSystemState<string | null>(SYSTEM_KEYS.GOALS_RESET_BANNER_LAST_SEEN_WEEK);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsResetBannerLastSeenWeek;
}

/**
 * 주간 리셋 배너 마지막 본 주 설정
 */
export async function setGoalsResetBannerLastSeenWeek(value: string | null): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_RESET_BANNER_LAST_SEEN_WEEK, value);
}

/**
 * Catch-up 스누즈된 주 조회
 */
export async function getGoalsCatchUpSnoozedWeek(): Promise<string | null> {
  const value = await getSystemState<string | null>(SYSTEM_KEYS.GOALS_CATCH_UP_SNOOZED_WEEK);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsCatchUpSnoozedWeek;
}

/**
 * Catch-up 스누즈된 주 설정
 */
export async function setGoalsCatchUpSnoozedWeek(value: string | null): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_CATCH_UP_SNOOZED_WEEK, value);
}

/**
 * 더보기 힌트 노출 여부 조회
 */
export async function getGoalsExpandHintShown(): Promise<boolean> {
  const value = await getSystemState<boolean>(SYSTEM_KEYS.GOALS_EXPAND_HINT_SHOWN);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsExpandHintShown;
}

/**
 * 더보기 힌트 노출 여부 설정
 */
export async function setGoalsExpandHintShown(value: boolean): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_EXPAND_HINT_SHOWN, value);
}

/**
 * 테마 필터 조회
 */
export async function getGoalsThemeFilter(): Promise<string | null> {
  const value = await getSystemState<string | null>(SYSTEM_KEYS.GOALS_THEME_FILTER);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsThemeFilter;
}

/**
 * 테마 필터 설정
 */
export async function setGoalsThemeFilter(value: string | null): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_THEME_FILTER, value);
}

/**
 * 마지막 진행도 변경 조회 (Undo용)
 */
export async function getGoalsLastProgressChange(): Promise<GoalsProgressChange | null> {
  const value = await getSystemState<GoalsProgressChange | null>(SYSTEM_KEYS.GOALS_LAST_PROGRESS_CHANGE);
  return value ?? SYSTEM_STATE_DEFAULTS.goalsLastProgressChange;
}

/**
 * 마지막 진행도 변경 설정 (Undo용)
 */
export async function setGoalsLastProgressChange(value: GoalsProgressChange | null): Promise<void> {
  await setSystemState(SYSTEM_KEYS.GOALS_LAST_PROGRESS_CHANGE, value);
}

// ============================================================================
// 전체 상태 읽기 (편의 함수)
// ============================================================================

/**
 * 모든 Goals systemState를 한 번에 조회
 */
export async function getAllGoalsSystemState(): Promise<GoalsSystemState> {
  const [
    filterTodayOnly,
    compactMode,
    advancedInputEnabled,
    resetBannerLastSeenWeek,
    catchUpSnoozedWeek,
    expandHintShown,
    themeFilter,
    lastProgressChange,
  ] = await Promise.all([
    getGoalsFilterTodayOnly(),
    getGoalsCompactMode(),
    getGoalsAdvancedInputEnabled(),
    getGoalsResetBannerLastSeenWeek(),
    getGoalsCatchUpSnoozedWeek(),
    getGoalsExpandHintShown(),
    getGoalsThemeFilter(),
    getGoalsLastProgressChange(),
  ]);

  return {
    filterTodayOnly,
    compactMode,
    advancedInputEnabled,
    resetBannerLastSeenWeek,
    catchUpSnoozedWeek,
    expandHintShown,
    themeFilter,
    lastProgressChange,
  };
}
