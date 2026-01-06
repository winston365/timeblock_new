import { memo, useRef, useState } from 'react';
import { Archive, ArrowUpRight, Trash2 } from 'lucide-react';

import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { minutesToTimeStr } from '@/shared/lib/utils';

import { ArchivedBadge, FavoriteBadge, RecurringBadge } from '../StatusBadges';

export interface WeeklyTaskBlockProps {
  readonly task: TempScheduleTask;
  readonly hourHeight: number;
  readonly startHour: number;
  readonly onDragStart: (task: TempScheduleTask, e: React.DragEvent) => void;
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

export const WeeklyTaskBlock = memo(function WeeklyTaskBlock({
  task,
  hourHeight,
  startHour,
  onDragStart,
  onTaskEdit,
  onDoubleClick,
  onDelete,
  onPromote,
  onArchive,
}: WeeklyTaskBlockProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const startMinutes = task.startTime;
  const endMinutes = task.endTime;
  const top = Math.max(0, ((startMinutes - startHour * 60) / 60) * hourHeight);
  const height = Math.max(12, ((endMinutes - startMinutes) / 60) * hourHeight);
  const duration = endMinutes - startMinutes;
  const isArchived = task.isArchived;
  const isRecurring = task.recurrence.type !== 'none';

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreviewPosition({ x: rect.right + 8, y: rect.top });
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    setShowPreview(false);
  };

  /** 싱글 클릭: 전체 편집 모달 */
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskEdit(task);
  };

  /** A3: 더블 클릭: 빠른 인라인 편집 */
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDoubleClick(task, { x: e.clientX, y: e.clientY });
  };

  /** B2: 퀵 액션 버튼 클릭 - 드래그 방지 */
  const handlePromoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPromote(task, { x: e.clientX, y: e.clientY });
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onArchive(task);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(task);
  };

  return (
    <>
      <div
        ref={blockRef}
        draggable
        onDragStart={e => onDragStart(task, e)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={`absolute left-0.5 right-0.5 rounded text-[8px] px-1 py-0.5 overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 hover:scale-[1.02] hover:z-10 transition-all group ${
          isArchived ? 'opacity-50' : ''
        }`}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          backgroundColor: task.color + '30',
          borderLeft: `2px solid ${task.color}`,
        }}
      >
        <span style={{ color: task.color }} className="font-semibold flex items-center gap-0.5">
          {task.favorite && <FavoriteBadge compact />}
          {isRecurring && <RecurringBadge compact />}
          {isArchived && <ArchivedBadge compact />}
          <span className="truncate">{task.name}</span>
        </span>

        {/* B2: 호버 시 퀵 액션 버튼들 */}
        <div
          className="absolute top-0 right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {!isArchived && (
            <button
              type="button"
              className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
              onClick={handlePromoteClick}
              onMouseDown={e => e.stopPropagation()}
              title="실제 일정으로 프로모션"
              aria-label="실제 일정으로 프로모션"
            >
              <ArrowUpRight size={10} />
            </button>
          )}
          {!isArchived && (
            <button
              type="button"
              className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
              onClick={handleArchiveClick}
              onMouseDown={e => e.stopPropagation()}
              title="보관함으로 이동"
              aria-label="보관함으로 이동"
            >
              <Archive size={10} />
            </button>
          )}
          <button
            type="button"
            className="p-0.5 rounded bg-white/20 hover:bg-red-400/80 text-white transition-colors"
            onClick={handleDeleteClick}
            onMouseDown={e => e.stopPropagation()}
            title="삭제"
            aria-label="삭제"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* 호버 확대 미리보기 */}
      {showPreview && (
        <div
          className="fixed z-[200] min-w-[180px] max-w-[250px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ left: `${previewPosition.x}px`, top: `${previewPosition.y}px` }}
        >
          {/* 헤더 */}
          <div
            className="px-3 py-2 border-b border-[var(--color-border)]"
            style={{ backgroundColor: task.color + '20' }}
          >
            <div className="flex items-center gap-2">
              {task.favorite && <FavoriteBadge />}
              {isRecurring && <RecurringBadge />}
              {isArchived && <ArchivedBadge />}
              <span className="font-bold text-sm" style={{ color: task.color }}>
                {task.name}
              </span>
            </div>
          </div>

          {/* 내용 */}
          <div className="p-3 space-y-2">
            {/* 시간 */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-tertiary)]">⏰</span>
              <span className="font-mono text-[var(--color-text)]">
                {minutesToTimeStr(startMinutes)} - {minutesToTimeStr(endMinutes)}
              </span>
              <span className="text-[var(--color-text-secondary)]">({duration}분)</span>
            </div>

            {/* 반복 */}
            {task.recurrence.type !== 'none' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-text-tertiary)]">🔄</span>
                <span className="text-[var(--color-text-secondary)]">
                  {task.recurrence.type === 'daily' && '매일'}
                  {task.recurrence.type === 'weekly' &&
                    `매주 ${task.recurrence.weeklyDays?.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}`}
                  {task.recurrence.type === 'monthly' && '매월'}
                  {task.recurrence.type === 'custom' && `${task.recurrence.intervalDays}일마다`}
                </span>
              </div>
            )}

            {/* 메모 */}
            {task.memo && (
              <div className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] rounded p-2 line-clamp-2">
                {task.memo}
              </div>
            )}
          </div>

          {/* 안내 */}
          <div className="px-3 py-1.5 bg-[var(--color-bg-tertiary)] text-[9px] text-[var(--color-text-tertiary)] text-center">
            클릭하여 편집 • 드래그하여 이동
          </div>
        </div>
      )}
    </>
  );
});
