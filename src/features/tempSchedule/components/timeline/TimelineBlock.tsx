import { memo } from 'react';
import { Archive, ArrowUpRight, Trash2 } from 'lucide-react';

import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { minutesToTimeStr } from '@/shared/lib/utils';

import type { BlockPosition } from '../../utils/timelinePositioning';
import { ArchivedBadge, FavoriteBadge, RecurringBadge } from '../StatusBadges';

export interface TimelineBlockProps {
  readonly position: BlockPosition;
  readonly onEdit: (task: TempScheduleTask) => void;
  /** A3: 더블클릭 시 인라인 편집 팝오버 표시 */
  readonly onDoubleClick: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  readonly onDragStart: (task: TempScheduleTask, mode: 'move' | 'resize-top' | 'resize-bottom', e: React.MouseEvent) => void;
  readonly onContextMenu: (task: TempScheduleTask, e: React.MouseEvent) => void;
  readonly onDelete: (task: TempScheduleTask) => void;
  readonly onPromote: (task: TempScheduleTask) => void;
  readonly onArchive: (task: TempScheduleTask) => void;
}

export const TimelineBlock = memo(function TimelineBlock({
  position,
  onEdit: _onEdit,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onDelete,
  onPromote,
  onArchive,
}: TimelineBlockProps) {
  const { task, column, totalColumns, top, height } = position;
  const widthPercent = 100 / totalColumns;
  const leftPercent = column * widthPercent;

  const isRecurring = task.recurrence.type !== 'none';
  const isFavorite = task.favorite;
  const isArchived = task.isArchived;
  const isCompact = height < 50;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDoubleClick(task, { x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className={`absolute rounded-lg shadow-sm cursor-move transition-shadow hover:shadow-md group border ${
        isArchived ? 'border-white/30 opacity-60' : 'border-white/10'
      }`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        backgroundColor: task.color,
        zIndex: 10,
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(task, e);
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.stopPropagation();
          onDragStart(task, 'move', e);
        }
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart(task, 'resize-top', e);
        }}
      />

      <div className="px-2 py-1 overflow-hidden h-full flex flex-col text-white">
        <div className="flex items-center gap-1 min-w-0">
          {isFavorite && <FavoriteBadge compact />}
          {isRecurring && <RecurringBadge compact />}
          {isArchived && <ArchivedBadge compact />}
          <div className="text-xs font-bold truncate drop-shadow-md">{task.name}</div>
        </div>
        {!isCompact && (
          <div className="text-[10px] opacity-90 font-medium">
            {minutesToTimeStr(task.startTime)} - {minutesToTimeStr(task.endTime)}
          </div>
        )}
      </div>

      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isArchived && (
          <button
            type="button"
            className="p-1 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onPromote(task);
            }}
            title="실제 일정으로 프로모션"
            aria-label="실제 일정으로 프로모션"
          >
            <ArrowUpRight size={12} />
          </button>
        )}
        {!isArchived && (
          <button
            type="button"
            className="p-1 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onArchive(task);
            }}
            title="보관함으로 이동"
            aria-label="보관함으로 이동"
          >
            <Archive size={12} />
          </button>
        )}
        <button
          type="button"
          className="p-1 rounded bg-white/20 hover:bg-red-400/80 text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
          title="삭제"
          aria-label="삭제"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart(task, 'resize-bottom', e);
        }}
      />
    </div>
  );
});
