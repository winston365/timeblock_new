/**
 * themeGroupUtils.ts
 *
 * @file T28: 테마 기반 그룹화/필터 유틸리티
 * @description
 *   - 목표를 테마별로 그룹화
 *   - 테마별 필터링
 *   - ADHD 친화적: 시각적 분류, 인지 부하 감소
 */

import type { WeeklyGoal } from '@/shared/types/domain';
import { GOAL_THEME_PRESETS } from '../constants/goalConstants';

/**
 * 테마 그룹 타입
 */
export interface ThemeGroup {
  /** 테마 ID (또는 'uncategorized') */
  themeId: string;
  /** 테마 라벨 */
  label: string;
  /** 테마 색상 */
  color: string;
  /** 해당 테마의 목표들 */
  goals: WeeklyGoal[];
}

/**
 * 테마가 없는 목표를 위한 기본 그룹
 */
const UNCATEGORIZED_GROUP = {
  themeId: 'uncategorized',
  label: '📁 기타',
  color: '#6b7280',
};

/**
 * 목표를 테마별로 그룹화
 * @param goals - 전체 목표 목록
 * @returns 테마별 그룹 배열
 */
export function groupGoalsByTheme(goals: WeeklyGoal[]): ThemeGroup[] {
  const groups = new Map<string, ThemeGroup>();

  // 프리셋 테마들 초기화
  for (const preset of GOAL_THEME_PRESETS) {
    groups.set(preset.id, {
      themeId: preset.id,
      label: preset.label,
      color: preset.color,
      goals: [],
    });
  }

  // uncategorized 그룹 초기화
  groups.set(UNCATEGORIZED_GROUP.themeId, {
    ...UNCATEGORIZED_GROUP,
    goals: [],
  });

  // 목표를 그룹에 분배
  for (const goal of goals) {
    const themeId = goal.theme || UNCATEGORIZED_GROUP.themeId;
    
    // 프리셋에 없는 커스텀 테마 처리
    if (!groups.has(themeId)) {
      groups.set(themeId, {
        themeId,
        label: `🏷️ ${themeId}`,
        color: '#9ca3af',
        goals: [],
      });
    }

    groups.get(themeId)!.goals.push(goal);
  }

  // 빈 그룹 제거 및 배열로 변환
  return Array.from(groups.values())
    .filter(group => group.goals.length > 0)
    .sort((a, b) => {
      // uncategorized는 항상 마지막
      if (a.themeId === UNCATEGORIZED_GROUP.themeId) return 1;
      if (b.themeId === UNCATEGORIZED_GROUP.themeId) return -1;
      // 나머지는 목표 수로 정렬 (많은 것 우선)
      return b.goals.length - a.goals.length;
    });
}

/**
 * 특정 테마로 목표 필터링
 * @param goals - 전체 목표 목록
 * @param themeId - 필터링할 테마 ID (null이면 전체)
 * @returns 필터링된 목표 목록
 */
export function filterGoalsByTheme(
  goals: WeeklyGoal[],
  themeId: string | null
): WeeklyGoal[] {
  if (!themeId) return goals;
  
  if (themeId === UNCATEGORIZED_GROUP.themeId) {
    return goals.filter(g => !g.theme);
  }
  
  return goals.filter(g => g.theme === themeId);
}

/**
 * 사용 중인 테마 목록 추출
 * @param goals - 전체 목표 목록
 * @returns 사용 중인 테마 ID 목록
 */
export function getUsedThemes(goals: WeeklyGoal[]): string[] {
  const themes = new Set<string>();
  
  for (const goal of goals) {
    if (goal.theme) {
      themes.add(goal.theme);
    } else {
      themes.add(UNCATEGORIZED_GROUP.themeId);
    }
  }
  
  return Array.from(themes);
}

/**
 * 테마 정보 조회
 * @param themeId - 테마 ID
 * @returns 테마 정보 (없으면 기본값)
 */
export function getThemeInfo(themeId: string): {
  label: string;
  color: string;
} {
  if (themeId === UNCATEGORIZED_GROUP.themeId) {
    return {
      label: UNCATEGORIZED_GROUP.label,
      color: UNCATEGORIZED_GROUP.color,
    };
  }

  const preset = GOAL_THEME_PRESETS.find(p => p.id === themeId);
  if (preset) {
    return {
      label: preset.label,
      color: preset.color,
    };
  }

  return {
    label: `🏷️ ${themeId}`,
    color: '#9ca3af',
  };
}
