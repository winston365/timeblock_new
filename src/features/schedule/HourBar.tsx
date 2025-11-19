/**
 * HourBar - 1시간 단위 작업 영역
 *
 * @role 타임블록 내부의 1시간 구간을 시각화하고 작업을 관리합니다.
 */

import { useState, useEffect, useRef } from 'react';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import TaskCard from './TaskCard';
import { useDragDrop } from './hooks/useDragDrop';

interface HourBarProps {
  hour: number;
  blockId: TimeBlockId;
  tasks: Task[];
  isLocked: boolean;
  onCreateTask: (text: string, hour: number) => Promise<void>;
  onEditTask: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDropTask: (taskId: string, targetHour: number) => void;
}

export default function HourBar({
  hour,
  blockId,
  tasks,
  isLocked,
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onDropTask: _onDropTask,
}: HourBarProps) {
  const [progress, setProgress] = useState(0);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(blockId, hour);

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour === hour) {
        const focusProgress = Math.min((currentMinute / 50) * 100, 100);
        setProgress(focusProgress);
      } else if (currentHour > hour) {
        setProgress(100);
      } else {
        setProgress(0);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [hour]);

  const formatHourRange = () => {
    const startHour = hour.toString().padStart(2, '0');
    const endHour = (hour + 1).toString().padStart(2, '0');
    return `${startHour}:00-${endHour}:00`;
  };

  type HourStatus =
    | { type: 'current'; label: string }
    | { type: 'past'; label: string }
    | { type: 'upcoming'; label: string; detail?: string };

  const hourStatus: HourStatus = (() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const hourStartMinutes = hour * 60;

    if (currentHour === hour) {
      return {
        type: 'current',
        label: `현재 ${Math.min(currentMinute, 50)}분 진행 중`
      };
    }

    if (currentHour > hour) {
      return {
        type: 'past',
        label: '지난 시간'
      };
    }

    const minutesUntilStart = Math.max(hourStartMinutes - currentTotalMinutes, 0);
    return {
      type: 'upcoming',
      label: '앞선 시간',
      detail: minutesUntilStart > 0 ? `${minutesUntilStart}분 후 시작` : undefined
    };
  })();

  const statusBadgeClasses: Record<'past' | 'upcoming', string> = {
    past: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]',
    upcoming: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/40'
  };

  const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inlineInputValue.trim()) {
      e.preventDefault();
      try {
        await onCreateTask(inlineInputValue.trim(), hour);
        setInlineInputValue('');
        inlineInputRef.current?.focus();
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    } else if (e.key === 'Escape') {
      setInlineInputValue('');
    }
  };

  const handleDropWrapper = async (e: React.DragEvent) => {
    await handleDrop(e, async (taskId, updates) => {
      onUpdateTask(taskId, updates);
    });
  };

  const containerClasses = [
    'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition hover:border-[var(--color-primary)]',
    isDragOver ? 'ring-2 ring-[var(--color-primary)]/70' : '',
  ].join(' ');

  return (
    <div
      className={containerClasses}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
      data-hour={hour}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[var(--color-text-secondary)]">
        <span className="font-mono text-xs tracking-[0.2em] text-[var(--color-text-secondary)]">
          {formatHourRange()}
        </span>
        <div className="flex flex-col items-end gap-1 text-right text-xs font-medium sm:flex-row sm:items-center sm:gap-2">
          {hourStatus.type === 'current' ? (
            <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <span role="img" aria-label="clock">
                🕒
              </span>
              {hourStatus.label}
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses[hourStatus.type]}`}
            >
              {hourStatus.label}
            </span>
          )}
          {hourStatus.type === 'upcoming' && hourStatus.detail && (
            <span className="text-[11px] font-normal text-[var(--color-text-tertiary)]">{hourStatus.detail}</span>
          )}
          {!isLocked && (
            <span className="text-[11px] font-normal text-[var(--color-text-tertiary)]">
              Enter로 빠르게 작업을 추가하세요
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-black/20 text-xs">
        <div className="relative h-full overflow-hidden rounded-full bg-white/10" style={{ width: '83.33%' }}>
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-indigo-200 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: '16.67%' }} />
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onUpdateTask={(updates: Partial<Task>) => onUpdateTask(task.id, updates)}
            onDelete={() => onDeleteTask(task.id)}
            onToggle={() => onToggleTask(task.id)}
            blockIsLocked={isLocked}
          />
        ))}

        {!isLocked && (
          <div className="w-full">
            <input
              ref={inlineInputRef}
              type="text"
              value={inlineInputValue}
              onChange={(e) => setInlineInputValue(e.target.value)}
              onKeyDown={handleInlineInputKeyDown}
              placeholder="작업을 입력하고 Enter를 눌러 추가하세요 (기본 15분)"
              className="w-full rounded-lg border border-dashed border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
