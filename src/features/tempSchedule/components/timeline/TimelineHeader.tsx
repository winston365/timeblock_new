import { memo } from 'react';

export interface TimelineHeaderProps {
  readonly hourLabels: readonly number[];
  readonly hourHeight: number;
  readonly totalHours: number;
  readonly mainSnapshotWidthPercent: number;
}

export const TimelineHeader = memo(function TimelineHeader({
  hourLabels,
  hourHeight,
  totalHours,
  mainSnapshotWidthPercent,
}: TimelineHeaderProps) {
  return (
    <>
      {hourLabels.map((hour, index) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-[var(--color-border)]/40"
          style={{ top: `${index * hourHeight}px` }}
        >
          <div className="absolute left-1 top-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
            {String(hour).padStart(2, '0')}:00
          </div>
          {index < totalHours && (
            <div
              className="absolute left-8 right-0 border-t border-dashed border-[var(--color-border)]/20"
              style={{ top: `${hourHeight / 2}px` }}
            />
          )}
        </div>
      ))}

      <div
        className="absolute top-0 bottom-0 border-r border-blue-500/40"
        style={{ left: `${mainSnapshotWidthPercent}%` }}
      />
    </>
  );
});
