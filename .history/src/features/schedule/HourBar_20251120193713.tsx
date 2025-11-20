/**
 * HourBar - 1시간 단위 작업 영역
 *
 * @role 타임블록 내부의 1시간 구간을 시각화하고 작업을 관리합니다.
 */

import { useState, useEffect, useRef } from 'react';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { useToastStore } from '@/shared/stores/toastStore';
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
  const toastRef = useRef({ preEndShown: false, restShown: false });
  const addToast = useToastStore(state => state.addToast);

  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(blockId, hour);

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour === hour) {
        const focusProgress = Math.min((currentMinute / 50) * 100, 100);
        setProgress(focusProgress);

        // Show a heads-up toast 5 minutes before work ends
        if (currentMinute >= 45 && currentMinute < 50 && !toastRef.current.preEndShown) {
          addToast('5분 남았어. 마무리 준비하자.', 'info', 5000);
          toastRef.current.preEndShown = true;
        }

        // Announce the start of the 10 minute break
        if (currentMinute >= 50 && !toastRef.current.restShown) {
          addToast('휴식 10분 시작! 10분 동안 재충전해.', 'success', 5000);
          toastRef.current.restShown = true;
        }
      } else if (currentHour > hour) {
        setProgress(100);
        toastRef.current = { preEndShown: false, restShown: false };
      } else {
        setProgress(0);
        toastRef.current = { preEndShown: false, restShown: false };
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [hour, addToast]);

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
    const workRemaining = Math.max(50 - currentMinute, 0);
    const restRemaining = Math.max(60 - Math.max(currentMinute, 50), 0);

    if (currentHour === hour) {
      return {
        type: 'current',
        label:
          workRemaining > 0
            ? `현재 시간: 남은 ${workRemaining}분 · 휴식 10분`
            : `현재 시간: 휴식 ${Math.min(restRemaining, 10)}분`
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

  const now = new Date();
  const nowHour = now.getHours();
  const isCurrentHour = nowHour === hour;
  const isPastHour = nowHour > hour;
  const currentMinute = now.getMinutes();
  const workFill = isCurrentHour ? Math.min((currentMinute / 50) * 100, 100) : currentHourPastFuture(nowHour, hour, 100, 0);
  const restFill =
    isPastHour ? 100 : nowHour < hour ? 0 : currentMinute < 50 ? 0 : Math.min(((currentMinute - 50) / 10) * 100, 100);
  const currentMarker = isCurrentHour ? Math.min((currentMinute / 60) * 100, 100) : 0;

  function currentHourPastFuture(nowHour: number, targetHour: number, futureVal: number, pastVal: number) {
    if (nowHour === targetHour) return 0;
    return nowHour > targetHour ? pastVal : futureVal;
  }

  return (
    <div
      className={containerClasses}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
      data-hour={hour}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[var(--color-text-secondary)]">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {formatHourRange()}
        </span>
        <div className="flex flex-col items-end gap-1 text-right text-xs font-medium sm:flex-row sm:items-center sm:gap-2">
          {hourStatus.type === 'current' ? (
            <span className="flex items-center gap-1 text-[var(--color-primary)] font-semibold">
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

      {!isPastHour && (
        <div
          className={`relative mb-3 flex h-[12px] overflow-hidden rounded-full bg-black/20 text-xs ${isCurrentHour ? 'ring-2 ring-[var(--color-primary)]/40' : 'opacity-80'}`}
        >
          <div className="relative h-full overflow-hidden rounded-full bg-white/10" style={{ width: '83.33%' }}>
            {isCurrentHour && (
              <>
                <div
                  className="pointer-events-none absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/70"
                  aria-label="50분 목표선"
                  title="50분 목표선"
                >
                  <span className="absolute left-1/2 top-[-4px] h-[6px] w-[6px] -translate-x-1/2 rounded-full border border-white/80 bg-black/70 shadow" />
                </div>
                <div
                  className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/90 bg-[var(--color-primary)] shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all"
                  style={{ left: `${currentMarker}%` }}
                  aria-label="현재 시각 진행 위치"
                  title="현재 시각 진행 위치"
                />
              </>
            )}
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-indigo-200 transition-all duration-300"
              style={{ width: `${workFill}%` }}
            />
          </div>
          <div className="relative h-full overflow-hidden rounded-full bg-amber-500/20" style={{ width: '16.67%' }}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-300"
              style={{ width: `${restFill}%` }}
            />
          </div>
        </div>
      )}

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

        {!isLocked && !isPastHour && (
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
