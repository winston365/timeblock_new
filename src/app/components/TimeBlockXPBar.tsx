/**
 * TimeBlockXPBar Component
 *
 * @role 현재 타임블록의 XP 획득량 표시 (시간대별 초기화)
 * @input gameState (timeBlockXP), settings (timeBlockXPGoal)
 * @output 타임블록별 XP 진행률 바 UI
 * 
 * @description
 * - 05~08, 08~11, 11~14, 14~17, 17~20, 20~23 시간대별로 XP 표시
 * - 23시~05시는 휴식 시간으로 비활성화
 * - 타임블록 변경 시 자동으로 XP 초기화 (gameState.timeBlockXP 기준)
 * - 기본 목표: 200 XP (Settings에서 변경 가능)
 */

import { memo, useEffect, useState } from 'react';
import { calculateTimeBlockXPProgress, type TimeBlockXPProgress } from '@/shared/lib/timeBlockXP';

interface TimeBlockXPBarProps {
  /** GameState의 timeBlockXP */
  timeBlockXP?: Record<string, number>;
  /** 타임블록당 XP 목표 (기본 200) */
  goalXP?: number;
  /** 총 가용 XP (표시용) */
  availableXP?: number;
}

function TimeBlockXPBarComponent({
  timeBlockXP,
  goalXP = 200,
  availableXP = 0,
}: TimeBlockXPBarProps) {
  const [progress, setProgress] = useState<TimeBlockXPProgress>(() =>
    calculateTimeBlockXPProgress(timeBlockXP, goalXP)
  );

  // 1분마다 상태 업데이트 (타임블록 변경 감지)
  useEffect(() => {
    const updateProgress = () => {
      setProgress(calculateTimeBlockXPProgress(timeBlockXP, goalXP));
    };

    updateProgress();

    // 1분마다 업데이트
    const interval = setInterval(updateProgress, 60 * 1000);
    return () => clearInterval(interval);
  }, [timeBlockXP, goalXP]);

  // XP가 변경될 때 즉시 업데이트
  useEffect(() => {
    setProgress(calculateTimeBlockXPProgress(timeBlockXP, goalXP));
  }, [timeBlockXP, goalXP]);

  // 비활성 시간대 (23시~05시)
  if (progress.isNightTime) {
    return (
      <div className="px-[var(--spacing-lg)] py-0.5">
        <div className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-2 py-1 text-[9px] shadow-[0_4px_10px_rgba(0,0,0,0.16)] backdrop-blur-md">
          {/* 휴식 시간 표시 */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <span className="text-lg">🌙</span>
            <span className="text-[var(--color-text-secondary)]">휴식 시간</span>
            <span className="text-[8px] text-[var(--color-text-tertiary)]">
              (05:00부터 다시 시작)
            </span>
          </div>

          {/* 총 XP 표시 */}
          <div className="whitespace-nowrap text-[9px] font-semibold text-[var(--color-text)]">
            {availableXP} XP
          </div>
        </div>
      </div>
    );
  }

  // 진행률 색상 결정
  const getProgressColor = () => {
    if (progress.progressPercent >= 100) return 'from-emerald-500 via-emerald-400 to-green-400';
    if (progress.progressPercent >= 75) return 'from-[var(--color-primary)] via-amber-500 to-orange-500';
    if (progress.progressPercent >= 50) return 'from-amber-500 via-orange-500 to-orange-600';
    return 'from-orange-500 via-rose-500 to-rose-600';
  };

  // 진행률에 따른 강조 효과
  const isGoalMet = progress.progressPercent >= 100;
  const marks = [50, 100, 150]; // 중간 목표 마크 (50, 100, 150 XP)

  return (
    <div className="px-[var(--spacing-lg)] py-0.5">
      <div className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-[9px] shadow-[0_4px_10px_rgba(0,0,0,0.16)] backdrop-blur-md transition-all duration-300 ${
        isGoalMet 
          ? 'border-emerald-500/30 bg-emerald-500/10' 
          : 'border-white/5 bg-white/5'
      }`}>
        {/* XP 프로그레스 바 */}
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          {/* 타임블록 라벨 */}
          <span className="whitespace-nowrap text-[8px] text-[var(--color-text-secondary)]">
            {progress.currentBlockLabel.split(' - ')[0]}
          </span>

          {/* 프로그레스 바 */}
          <div className="relative h-2 flex-1 overflow-visible rounded-full border border-white/10 bg-white/10">
            {/* 중간 마크 */}
            {marks.map(mark => {
              const markPercent = (mark / goalXP) * 100;
              if (markPercent > 100) return null;
              return (
                <div
                  key={mark}
                  className="absolute top-0 h-full w-[2px] bg-white/35"
                  style={{ left: `${markPercent}%` }}
                >
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[7px] text-white/70">
                    {mark}
                  </span>
                </div>
              );
            })}

            {/* 프로그레스 채우기 */}
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getProgressColor()} transition-[width] duration-500 ease-out`}
                style={{ width: `${Math.min(100, progress.progressPercent)}%` }}
              />
            </div>

            {/* 목표 달성 시 빛나는 효과 */}
            {isGoalMet && (
              <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-400/20" />
            )}
          </div>

          {/* 현재 XP / 목표 XP */}
          <span className={`whitespace-nowrap tabular-nums text-[9px] font-semibold ${
            isGoalMet ? 'text-emerald-400' : 'text-[var(--color-text)]'
          }`}>
            {progress.currentXP} / {goalXP}
          </span>
        </div>

        {/* 총 XP 표시 */}
        <div className="whitespace-nowrap text-[9px] font-semibold text-[var(--color-text)]">
          {isGoalMet && <span className="mr-1">🎉</span>}
          {availableXP} XP
        </div>
      </div>
    </div>
  );
}

export const TimeBlockXPBar = memo(TimeBlockXPBarComponent);

// 기존 XPProgressBar 이름으로도 export (하위 호환성)
export const XPProgressBar = TimeBlockXPBar;
