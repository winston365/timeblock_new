import { memo } from 'react';

import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { formatDate, snapToPixel } from '@/features/tempSchedule/utils/weeklyScheduleUtils';

import { WeeklyTaskBlock } from './WeeklyTaskBlock';

const WEEK_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export interface WeeklyDayColumnProps {
  readonly date: string;
  readonly dayIndex: number;
  readonly tasks: TempScheduleTask[];
  readonly onDayClick: (date: string) => void;
  readonly hourHeight: number;
  readonly startHour: number;
  readonly endHour: number;
  readonly onDragStart: (task: TempScheduleTask, e: React.DragEvent) => void;
  readonly onDragOver: (e: React.DragEvent) => void;
  readonly onDrop: (date: string, e: React.DragEvent) => void;
  readonly isDragOver: boolean;
  readonly onTaskEdit: (task: TempScheduleTask) => void;
  /** A3: 더블클릭 시 인라인 편집 팝오버 표시 */
  readonly onDoubleClick: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  /** B2: 퀵 액션 - 삭제 */
  readonly onDelete: (task: TempScheduleTask) => void;
  /** B2: 퀵 액션 - 프로모션 */
  readonly onPromote: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  /** B2: 퀵 액션 - 보관 */
  readonly onArchive: (task: TempScheduleTask) => void;
}

export const WeeklyDayColumn = memo(function WeeklyDayColumn({
  date,
  dayIndex,
  tasks,
  onDayClick,
  hourHeight,
  startHour,
  endHour,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  onTaskEdit,
  onDoubleClick,
  onDelete,
  onPromote,
  onArchive,
}: WeeklyDayColumnProps) {
  const { day, month, isToday, isWeekend } = formatDate(date);

  return (
    <div
      className={`
        flex-1 border-r border-[var(--color-border)]/30 last:border-r-0 min-w-0 cursor-pointer transition-colors relative
        ${isWeekend ? 'bg-[var(--color-bg-tertiary)]/30' : ''}
        ${isToday ? 'bg-[var(--color-primary)]/5' : ''}
        ${isDragOver ? 'bg-[var(--color-primary)]/20 ring-2 ring-inset ring-[var(--color-primary)]/50' : 'hover:bg-[var(--color-bg-secondary)]/50'}
      `}
      onClick={() => onDayClick(date)}
      onDragOver={onDragOver}
      onDrop={e => onDrop(date, e)}
    >
      {/* 오늘 컬럼 전체 테두리 */}
      {isToday && <div className="absolute inset-0 border-2 border-[var(--color-primary)]/50 pointer-events-none z-[5]" />}

      {/* 요일 헤더 - 고정 높이로 레이아웃 안정화 */}
      <div
        className={`
        sticky top-0 z-10 border-b border-[var(--color-border)] px-1 py-2 text-center h-[52px] box-border
        ${isToday ? 'bg-[var(--color-primary)]/20 border-b-2 border-b-[var(--color-primary)]' : 'bg-[var(--color-bg-surface)]'}
      `}
      >
        <div
          className={`text-[10px] font-medium ${isWeekend ? 'text-red-400' : 'text-[var(--color-text-tertiary)]'}`}
        >
          {WEEK_DAY_LABELS[dayIndex]}
        </div>
        <div
          className={`text-sm font-bold ${
            isToday
              ? 'text-white bg-[var(--color-primary)] rounded-full w-6 h-6 flex items-center justify-center mx-auto'
              : isWeekend
                ? 'text-red-400'
                : 'text-[var(--color-text)]'
          }`}
        >
          {day}
        </div>
        <div className="text-[8px] text-[var(--color-text-tertiary)] opacity-80 h-3 flex items-center justify-center">
          {dayIndex === 0 || day === 1 ? `${month}월` : '\u00A0'}
        </div>
      </div>

      {/* 스케줄 블록들 */}
      <div
        className="relative"
        style={{
          height: `${(endHour - startHour) * hourHeight}px`,
        }}
      >
        {/* 시간별 구분선 - snapToPixel로 서브픽셀 정렬 */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {Array.from({ length: endHour - startHour }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-[var(--color-border)]/20"
              style={{ top: `${snapToPixel(i * hourHeight)}px` }}
            />
          ))}
        </div>

        {tasks.map(task => (
          <WeeklyTaskBlock
            key={task.id}
            task={task}
            hourHeight={hourHeight}
            startHour={startHour}
            onDragStart={onDragStart}
            onTaskEdit={onTaskEdit}
            onDoubleClick={onDoubleClick}
            onDelete={onDelete}
            onPromote={onPromote}
            onArchive={onArchive}
          />
        ))}
      </div>
    </div>
  );
});
