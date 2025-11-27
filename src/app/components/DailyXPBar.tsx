import { memo } from 'react';
import { TIME_BLOCKS } from '@/shared/types/domain';

interface DailyXPBarProps {
  /** 타임블록별 XP 누적값 */
  timeBlockXP?: Record<string, number>;
  /** 타임블록당 목표 XP (기본 200) */
  goalPerBlock?: number;
}

function DailyXPBarComponent({
  timeBlockXP,
  goalPerBlock = 200,
}: DailyXPBarProps) {
  const blockCount = TIME_BLOCKS.length || 6;
  const safeGoalPerBlock = Math.max(0, goalPerBlock);
  const totalGoal = safeGoalPerBlock * blockCount;
  const totalXP = Object.values(timeBlockXP ?? {}).reduce(
    (sum, xp) => sum + Math.max(0, xp || 0),
    0
  );
  const percent = totalGoal > 0 ? Math.min(100, (totalXP / totalGoal) * 100) : 0;
  const isGoalMet = percent >= 100;

  const marks = totalGoal > 0
    ? Array.from({ length: blockCount }, (_, idx) => ({
        percent: ((idx + 1) / blockCount) * 100,
        value: safeGoalPerBlock * (idx + 1),
      }))
    : [];

  return (
    <div className="px-[var(--spacing-lg)] py-0.5">
      <div
        className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-[9px] shadow-[0_4px_10px_rgba(0,0,0,0.16)] backdrop-blur-md transition-all duration-300 ${
          isGoalMet
            ? 'border-amber-400/40 bg-amber-500/15'
            : 'border-white/5 bg-white/5'
        }`}
      >
        <div
          className={`flex items-center justify-center rounded-lg px-1.5 py-0.5 text-[var(--color-text)] text-[9px] ${
            isGoalMet ? 'bg-amber-500/25' : 'bg-[var(--color-primary)]/15'
          }`}
        >
          <span className="mr-1 text-[7px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
            Daily
          </span>
          <span
            className={`text-xs font-extrabold ${
              isGoalMet ? 'text-amber-300' : 'text-[var(--color-primary)]'
            }`}
          >
            XP
          </span>
        </div>

        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <span className="whitespace-nowrap text-[8px] text-[var(--color-text-secondary)]">
            하루 목표 (블록 x{blockCount})
          </span>

          <div className="relative h-2 flex-1 overflow-visible rounded-full border border-white/10 bg-white/10">
            {marks.map(mark => (
              <div
                key={mark.value}
                className="absolute top-0 h-full w-[2px] bg-white/35"
                style={{ left: `${mark.percent}%` }}
              >
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[7px] text-white/70">
                  {mark.value}
                </span>
              </div>
            ))}

            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-[var(--color-primary)] to-amber-400 transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>

            {isGoalMet && (
              <div className="absolute inset-0 animate-pulse rounded-full bg-amber-300/20" />
            )}
          </div>

          <span
            className={`whitespace-nowrap tabular-nums text-[9px] font-semibold ${
              isGoalMet ? 'text-amber-200' : 'text-[var(--color-text)]'
            }`}
          >
            {totalXP} / {totalGoal}
          </span>
        </div>

        <div className="whitespace-nowrap text-[8px] text-[var(--color-text-secondary)]">
          목표 {safeGoalPerBlock} XP x {blockCount}
        </div>
      </div>
    </div>
  );
}

export const DailyXPBar = memo(DailyXPBarComponent);
