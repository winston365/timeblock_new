import { memo } from 'react';

import { minutesToTimeStr } from '@/shared/lib/utils';

export interface WeeklyTimeRailProps {
  readonly widthPx: number;
  readonly startHour: number;
  readonly endHour: number;
  readonly hourHeight: number;
  readonly currentTimeMinutes: number;
}

export const WeeklyTimeRail = memo(function WeeklyTimeRail({
  widthPx,
  startHour,
  endHour,
  hourHeight,
  currentTimeMinutes,
}: WeeklyTimeRailProps) {
  return (
    <div
      className="flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-surface)]"
      style={{ width: `${widthPx}px` }}
    >
      {/* 헤더 공간 */}
      <div className="h-[52px] border-b border-[var(--color-border)] flex items-end justify-center pb-1">
        <span className="text-[8px] text-[var(--color-text-tertiary)]">시간</span>
      </div>

      {/* 시간 라벨들 */}
      <div
        className="relative"
        style={{
          height: `${(endHour - startHour) * hourHeight}px`,
        }}
      >
        {Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i).map(hour => (
          <div
            key={hour}
            className="absolute left-0 right-0 flex items-center justify-end pr-2 text-[10px] text-[var(--color-text-tertiary)] font-mono"
            style={{ top: `${(hour - startHour) * hourHeight - 6}px` }}
          >
            <span className={hour === Math.floor(currentTimeMinutes / 60) ? 'text-red-400 font-bold' : ''}>
              {hour.toString().padStart(2, '0')}:00
            </span>
          </div>
        ))}

        {/* 현재 시간 표시 (시간 레일 내) */}
        {currentTimeMinutes >= startHour * 60 && currentTimeMinutes <= endHour * 60 && (
          <div
            className="absolute left-0 right-0 flex items-center justify-end pr-1 z-20"
            style={{ top: `${((currentTimeMinutes - startHour * 60) / 60) * hourHeight - 8}px` }}
          >
            <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1 rounded">
              {minutesToTimeStr(currentTimeMinutes)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
