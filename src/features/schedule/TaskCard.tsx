/**
 * TaskCard
 *
 * Tailwind 기반 task 카드 (체크, 메타데이터, 인라인 편집, 메모, 타이머 포함)
 */

import { useState, useEffect } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { RESISTANCE_LABELS } from '@/shared/types/domain';
import { formatDuration, calculateTaskXP } from '@/shared/lib/utils';
import { MemoModal } from './MemoModal';
import { useDragDropManager } from './hooks/useDragDropManager';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUpdateTask?: (updates: Partial<Task>) => void;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  hideMetadata?: boolean;
  blockIsLocked?: boolean;
  compact?: boolean;
}

const RESISTANCE_COLORS: Record<Resistance, string> = {
  low: 'border-emerald-400/50 text-emerald-200',
  medium: 'border-amber-400/60 text-amber-200',
  high: 'border-rose-400/60 text-rose-200',
};

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggle,
  onUpdateTask,
  onDragStart,
  onDragEnd,
  hideMetadata = false,
  blockIsLocked,
  compact = false,
}: TaskCardProps) {
  const [showResistancePicker, setShowResistancePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(task.text);
  const [timerIconActive, setTimerIconActive] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { setDragData } = useDragDropManager();
  const xp = calculateTaskXP(task);
  const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);
  const durationOptions = [5, 10, 15, 30, 45, 60];

  const handleResistanceChange = (resistance: Resistance) => {
    if (onUpdateTask) {
      const multiplier = resistance === 'low' ? 1.0 : resistance === 'medium' ? 1.3 : 1.6;
      onUpdateTask({
        resistance,
        adjustedDuration: Math.round(task.baseDuration * multiplier),
      });
    }
    setShowResistancePicker(false);
  };

  const handleDurationChange = (baseDuration: number) => {
    if (onUpdateTask) {
      const multiplier = task.resistance === 'low' ? 1.0 : task.resistance === 'medium' ? 1.3 : 1.6;
      onUpdateTask({
        baseDuration,
        adjustedDuration: Math.round(baseDuration * multiplier),
      });
    }
    setShowDurationPicker(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    setDragData(
      {
        taskId: task.id,
        sourceBlockId: task.timeBlock,
        sourceHourSlot: task.hourSlot,
        taskData: task,
      },
      e
    );

    setIsDragging(true);
    onDragStart?.(task.id);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.completed) {
      onToggle();
      return;
    }
    if (task.timeBlock && blockIsLocked === false) {
      alert('🔒 블록을 먼저 잠궈야 작업을 완료할 수 있어요!\n\n잠금 버튼(🔒)을 눌러주세요. (비용: 15 XP)');
      return;
    }
    onToggle();
  };

  const handleTextSave = () => {
    const trimmedText = editedText.trim();
    if (trimmedText && trimmedText !== task.text && onUpdateTask) {
      onUpdateTask({ text: trimmedText });
    }
    setIsEditingText(false);
  };

  const handleTimerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!timerIconActive) {
      setTimerStartTime(Date.now());
      setElapsedTime(0);
    } else {
      setTimerStartTime(null);
    }
    setTimerIconActive(!timerIconActive);
  };

  useEffect(() => {
    if (!timerIconActive || timerStartTime === null) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerIconActive, timerStartTime]);

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cardClassName = [
    'group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 text-left transition-all duration-200',
    compact ? 'p-3' : 'p-4',
    task.completed ? 'opacity-70' : 'hover:border-[var(--color-primary)] hover:shadow-lg',
    isPrepared ? 'border-emerald-400/60 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent' : '',
    isDragging ? 'scale-[1.01] border-[var(--color-primary)] shadow-xl' : '',
  ].join(' ');

  const checkboxClasses = [
    'flex h-7 w-7 items-center justify-center rounded-xl border border-[var(--color-border)] text-base transition',
    task.completed ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]',
  ].join(' ');

  if (compact) {
    return (
      <>
        <div
          className={cardClassName}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-task-interactive="true"]')) {
              return;
            }
            onEdit();
          }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={checkboxClasses}
              onClick={handleToggleClick}
              aria-label={task.completed ? '완료 취소' : '완료'}
              data-task-interactive="true"
            >
              {task.completed ? '✓' : ''}
            </button>

            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate">{task.text}</p>
              {task.memo && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{task.memo}</p>}
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>{task.adjustedDuration}m</span>
              {xp > 0 && <span>✨{xp}</span>}
              <button
                type="button"
                className="rounded-full border border-white/10 px-2 py-1 text-[var(--color-text)] transition hover:border-[var(--color-primary)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                aria-label="작업 편집"
              >
                ✎
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-2 py-1 text-[var(--color-text)] transition hover:border-rose-400/50 hover:text-rose-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                aria-label="작업 삭제"
              >
                🗑
              </button>
            </div>
          </div>
        </div>

        {showMemoModal && <MemoModal memo={task.memo} onSave={(newMemo) => onUpdateTask?.({ memo: newMemo })} onClose={() => setShowMemoModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div
        className={cardClassName}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-task-interactive="true"]')) {
            return;
          }
          onEdit();
        }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            className={checkboxClasses}
            onClick={handleToggleClick}
            aria-label={task.completed ? '완료 취소' : '완료'}
            data-task-interactive="true"
          >
            {task.completed ? '✅' : '⬜'}
          </button>

          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                {isPrepared && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                    🌟 완벽 준비
                  </span>
                )}
                {isEditingText ? (
                  <input
                    type="text"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    onBlur={handleTextSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleTextSave();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditedText(task.text);
                        setIsEditingText(false);
                      }
                    }}
                    data-task-interactive="true"
                    autoFocus
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-1 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  />
                ) : (
                  <button
                    type="button"
                    data-task-interactive="true"
                    className={`cursor-text text-left leading-snug ${task.completed ? 'text-[var(--color-text-secondary)] line-through' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingText(true);
                      setEditedText(task.text);
                    }}
                    title="클릭해서 편집"
                  >
                    {task.text}
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                예상 {formatDuration(task.adjustedDuration)} · 기본 {formatDuration(task.baseDuration)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
              {!hideMetadata && (
                <div className="relative" data-task-interactive="true">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 transition ${RESISTANCE_COLORS[task.resistance]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResistancePicker(!showResistancePicker);
                    }}
                  >
                    {RESISTANCE_LABELS[task.resistance]}
                  </button>
                  {showResistancePicker && (
                    <div className="absolute right-0 top-9 z-20 flex min-w-[140px] flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 text-xs shadow-2xl">
                      <button className="rounded-xl px-3 py-2 text-left hover:bg-white/5" onClick={() => handleResistanceChange('low')}>
                        💧 쉬움 (x1.0)
                      </button>
                      <button className="rounded-xl px-3 py-2 text-left hover:bg-white/5" onClick={() => handleResistanceChange('medium')}>
                        🌊 보통 (x1.3)
                      </button>
                      <button className="rounded-xl px-3 py-2 text-left hover:bg-white/5" onClick={() => handleResistanceChange('high')}>
                        🌪️ 어려움 (x1.6)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="relative" data-task-interactive="true">
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDurationPicker(!showDurationPicker);
                  }}
                >
                  ⏱️ {formatDuration(task.baseDuration)}
                </button>
                {showDurationPicker && (
                  <div className="absolute right-0 top-9 z-20 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-xs shadow-2xl">
                    {durationOptions.map((duration) => (
                      <button
                        key={duration}
                        className={`rounded-xl px-3 py-2 transition ${task.baseDuration === duration ? 'bg-[var(--color-primary)]/20 text-white' : 'hover:bg-white/5'}`}
                        onClick={() => handleDurationChange(duration)}
                      >
                        {duration < 60 ? `${duration}분` : duration === 60 ? '1시간' : `${duration}분`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!hideMetadata && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[var(--color-text-secondary)]">
                  ✨ ~{xp} XP
                </span>
              )}

              {task.memo && (
                <button
                  type="button"
                  className="rounded-full border border-sky-400/40 px-3 py-1 text-sky-100 transition hover:bg-sky-500/20"
                  data-task-interactive="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMemoModal(true);
                  }}
                >
                  📝 메모
                </button>
              )}

              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  timerIconActive
                    ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                    : 'border-white/10 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]'
                }`}
                data-task-interactive="true"
                onClick={handleTimerToggle}
              >
                {timerIconActive ? `⏱️ ${formatElapsedTime(elapsedTime)}` : '⏱️ 타이머'}
              </button>

              <button
                type="button"
                className="ml-auto rounded-full border border-rose-400/60 px-2 py-1 text-rose-200 transition hover:bg-rose-500/20"
                data-task-interactive="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                🗑️
              </button>
            </div>

            {timerIconActive && (
              <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/15 p-3 text-xs text-indigo-100" data-task-interactive="true">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>집중 타이머 진행 중</span>
                  <span className="font-mono">{formatElapsedTime(elapsedTime)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-violet-400 transition-all duration-300"
                    style={{ width: `${Math.min((elapsedTime / 1800) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showMemoModal && (
        <MemoModal
          memo={task.memo}
          onSave={(newMemo) => {
            onUpdateTask?.({ memo: newMemo });
            setShowMemoModal(false);
          }}
          onClose={() => setShowMemoModal(false)}
        />
      )}
    </>
  );
}
