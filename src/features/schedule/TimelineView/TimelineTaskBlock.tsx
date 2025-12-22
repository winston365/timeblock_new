/**
 * @file TimelineTaskBlock.tsx
 * @role 타임라인에 표시되는 개별 작업 블록
 * @input task, top, height, completed 상태, 클릭/드래그 핸들러
 * @output 색상과 크기가 적용된 작업 블록 UI (클릭, 드래그 가능)
 */

import { memo } from 'react';
import type { Task } from '@/shared/types/domain';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';
import { formatBucketRangeLabel, getBucketStartHour } from '../utils/timeBlockBucket';

interface TimelineTaskBlockProps {
  task: Task;
  top: number;
  height: number;
  onTaskClick?: (task: Task) => void;
  onDragStart?: (task: Task, e: React.DragEvent) => void;
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

// 저항도별 색상 (다크모드 최적화 - 글래스모피즘)
const RESISTANCE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  low: {
    bg: 'bg-emerald-500/20 backdrop-blur-sm',
    border: 'border-emerald-400/50',
    text: 'text-emerald-200',
    glow: 'shadow-emerald-500/20',
  },
  medium: {
    bg: 'bg-amber-500/20 backdrop-blur-sm',
    border: 'border-amber-400/50',
    text: 'text-amber-200',
    glow: 'shadow-amber-500/20',
  },
  high: {
    bg: 'bg-rose-500/20 backdrop-blur-sm',
    border: 'border-rose-400/50',
    text: 'text-rose-200',
    glow: 'shadow-rose-500/20',
  },
};

// 완료된 작업 스타일 (다크모드 최적화)
const COMPLETED_STYLE = {
  bg: 'bg-gray-500/15 backdrop-blur-sm',
  border: 'border-gray-500/30',
  text: 'text-gray-400',
  glow: '',
};

/**
 * 타임라인 작업 블록 컴포넌트
 */
function TimelineTaskBlockComponent({ 
  task, 
  top, 
  height, 
  onTaskClick, 
  onDragStart,
  onContextMenu,
}: TimelineTaskBlockProps) {
  const colors = task.completed
    ? COMPLETED_STYLE
    : RESISTANCE_COLORS[task.resistance] || RESISTANCE_COLORS.medium;

  const duration = task.adjustedDuration || task.baseDuration || TASK_DEFAULTS.baseDuration;
  const bucketLabel = typeof task.hourSlot === 'number'
    ? formatBucketRangeLabel(getBucketStartHour(task.hourSlot))
    : '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskClick?.(task);
  };

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart?.(task, e);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(task, e);
  };

  return (
    <div
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      onContextMenu={handleContextMenu}
      className={`absolute left-1 right-1 rounded-lg border ${colors.bg} ${colors.border} overflow-hidden cursor-pointer select-none
        transition-all duration-200 ease-out shadow-md ${colors.glow}
        hover:shadow-xl hover:z-10 hover:scale-[1.02] hover:-translate-y-0.5 hover:brightness-110
        active:scale-[0.98] active:shadow-md`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        minHeight: '20px',
      }}
      title={`${task.text} (${duration}분) - ${bucketLabel}`}
    >
      <div className={`h-full px-2 py-1 ${colors.text}`}>
        <div className="flex items-start gap-1.5">
          {task.completed && <span className="text-xs">✓</span>}
          {task.emoji && <span className="text-xs">{task.emoji}</span>}
          <span
            className={`text-[11px] font-medium leading-tight line-clamp-2 ${task.completed ? 'line-through opacity-50' : ''}`}
          >
            {task.text}
          </span>
        </div>
        {height >= 35 && (
          <div className="mt-1 text-[10px] opacity-60 flex items-center gap-1.5">
            <span className="bg-white/10 px-1 rounded">{duration}분</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const TimelineTaskBlock = memo(TimelineTaskBlockComponent);
export default TimelineTaskBlock;
