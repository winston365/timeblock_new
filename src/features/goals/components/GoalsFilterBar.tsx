/**
 * GoalsFilterBar.tsx
 *
 * @file 목표 필터/모드 바
 * @description
 *   - T11: "오늘만 보기" 토글/칩 UI
 *   - T12: 필터 활성 시 숨김 카운트 표시
 *   - T15: 축소 모드 토글
 *   - ADHD 친화적: 인지 부하 감소, 필터링으로 집중
 */

import { useMemo } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import { getTodayTarget, getDayOfWeekIndex } from '@/data/repositories/weeklyGoalRepository';

interface GoalsFilterBarProps {
  /** 오늘만 보기 필터 상태 */
  filterTodayOnly: boolean;
  /** 필터 변경 콜백 */
  onFilterChange: (value: boolean) => void;
  /** 축소 모드 상태 */
  compactMode: boolean;
  /** 축소 모드 변경 콜백 */
  onCompactModeChange: (value: boolean) => void;
  /** 전체 목표 목록 (필터 적용 전) */
  allGoals: WeeklyGoal[];
}

/**
 * 오늘 할당량이 있는 목표인지 확인
 */
function hasTaskForToday(goal: WeeklyGoal): boolean {
  // 이미 완료된 목표는 오늘 할 일 없음
  if (goal.currentProgress >= goal.target) return false;
  
  // 오늘까지 해야 하는 목표량 계산
  const dayIndex = getDayOfWeekIndex();
  const todayTarget = getTodayTarget(goal.target, dayIndex);
  
  // 현재 진행도가 오늘 목표량보다 적으면 오늘 할 일 있음
  return goal.currentProgress < todayTarget || goal.currentProgress < goal.target;
}

/**
 * 목표 필터/모드 바 컴포넌트
 */
export default function GoalsFilterBar({
  filterTodayOnly,
  onFilterChange,
  compactMode,
  onCompactModeChange,
  allGoals,
}: GoalsFilterBarProps) {
  // 필터링 통계 계산
  const stats = useMemo(() => {
    const totalCount = allGoals.length;
    const todayCount = allGoals.filter(hasTaskForToday).length;
    const hiddenCount = totalCount - todayCount;
    const completedCount = allGoals.filter(g => g.currentProgress >= g.target).length;
    
    return { totalCount, todayCount, hiddenCount, completedCount };
  }, [allGoals]);

  // 목표가 없으면 표시 안 함
  if (allGoals.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 mb-2 flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2">
      {/* 왼쪽: 필터 토글 */}
      <div className="flex items-center gap-3">
        {/* 오늘만 보기 토글 */}
        <button
          type="button"
          onClick={() => onFilterChange(!filterTodayOnly)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            filterTodayOnly
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
          }`}
          aria-pressed={filterTodayOnly}
          title="오늘 할 일이 있는 목표만 표시"
        >
          <span>🎯</span>
          <span>오늘만</span>
          {filterTodayOnly && stats.todayCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
              {stats.todayCount}
            </span>
          )}
        </button>

        {/* T12: 숨김 카운트 표시 */}
        {filterTodayOnly && stats.hiddenCount > 0 && (
          <span className="text-[11px] text-white/50">
            +{stats.hiddenCount}개 숨김
            {stats.completedCount > 0 && ` (완료 ${stats.completedCount})`}
          </span>
        )}
      </div>

      {/* 오른쪽: 뷰 모드 토글 */}
      <div className="flex items-center gap-2">
        {/* 요약 통계 */}
        <span className="text-[11px] text-white/40">
          총 {stats.totalCount}개
          {stats.completedCount > 0 && (
            <span className="ml-1 text-emerald-400">
              ✓{stats.completedCount}
            </span>
          )}
        </span>

        {/* T15: 축소/확장 모드 토글 */}
        <button
          type="button"
          onClick={() => onCompactModeChange(!compactMode)}
          className={`rounded-lg p-1.5 text-xs transition ${
            compactMode
              ? 'bg-white/10 text-white/70'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
          }`}
          aria-pressed={compactMode}
          title={compactMode ? '상세 보기로 전환' : '축소 보기로 전환'}
        >
          {compactMode ? (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * 필터 적용 함수 (WeeklyGoalPanel에서 사용)
 */
export function filterGoals(goals: WeeklyGoal[], filterTodayOnly: boolean): WeeklyGoal[] {
  if (!filterTodayOnly) return goals;
  return goals.filter(hasTaskForToday);
}
