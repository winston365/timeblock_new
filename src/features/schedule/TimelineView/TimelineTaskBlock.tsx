/**
 * @file TimelineTaskBlock.tsx
 * @role 타임라인에 표시되는 개별 작업 블록
 * @input task, top, height, completed 상태, 클릭/드래그 핸들러
 * @output 색상과 크기가 적용된 작업 블록 UI (클릭, 드래그 가능)
 */

import { memo } from 'react';
import type { Task } from '@/shared/types/domain';

interface TimelineTaskBlockProps {
  task: Task;
  top: number;
  height: number;
  goalColor?: string | null;
  onTaskClick?: (task: Task) => void;
  onDragStart?: (task: Task, e: React.DragEvent) => void;
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

// 저항도별 색상 (파스텔 톤)
const RESISTANCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  low: {
    bg: 'bg-emerald-200/80',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
  },
  medium: {
    bg: 'bg-amber-200/80',
    border: 'border-amber-300',
    text: 'text-amber-900',
  },
  high: {
    bg: 'bg-rose-200/80',
    border: 'border-rose-300',
    text: 'text-rose-900',
  },
};

// 완료된 작업 스타일
const COMPLETED_STYLE = {
  bg: 'bg-gray-200/60',
  border: 'border-gray-300',
  text: 'text-gray-500',
};

/**
 * 타임라인 작업 블록 컴포넌트
 */
function TimelineTaskBlockComponent({ 
  task, 
  top, 
  height, 
  goalColor,
  onTaskClick, 
  onDragStart,
  onContextMenu,
}: TimelineTaskBlockProps) {
  const colors = task.completed
    ? COMPLETED_STYLE
    : RESISTANCE_COLORS[task.resistance] || RESISTANCE_COLORS.medium;

  const duration = task.adjustedDuration || task.baseDuration || 15;
  const hourSlotLabel = task.hourSlot !== undefined
    ? `${String(task.hourSlot).padStart(2, '0')}:00`
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
      className={`absolute left-1 right-1 rounded-md border ${colors.bg} ${colors.border} overflow-hidden cursor-pointer select-none
        transition-all duration-200 ease-out
        hover:shadow-lg hover:z-10 hover:scale-[1.02] hover:-translate-y-0.5
        active:scale-[0.98] active:shadow-md`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        minHeight: '20px',
      }}
      title={`${task.text} (${duration}분) - ${hourSlotLabel}`}
    >
      {/* 목표 연결 스트라이프 */}
      {goalColor && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
          style={{ backgroundColor: goalColor }}
        />
      )}
      
      <div className={`h-full px-1.5 py-0.5 ${colors.text} ${goalColor ? 'pl-2.5' : ''}`}>
        <div className="flex items-start gap-1">
          {task.emoji && <span className="text-xs">{task.emoji}</span>}
          <span
            className={`text-[10px] font-medium leading-tight line-clamp-2 ${task.completed ? 'line-through opacity-60' : ''}`}
          >
            {task.text}
          </span>
        </div>
        {height >= 30 && (
          <div className="mt-0.5 text-[9px] opacity-70 flex items-center gap-1">
            <span>{duration}분</span>
            {task.goalId && <span>🎯</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export const TimelineTaskBlock = memo(TimelineTaskBlockComponent);
export default TimelineTaskBlock;
