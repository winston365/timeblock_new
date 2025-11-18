/**
 * TaskCard
 *
 * Tailwind 기반 task 카드 (체크, 메타데이터, 인라인 편집, 메모, 타이머 포함)
 * 디자인 개선: Progressive Disclosure & Micro-interactions
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
  low: 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10',
  medium: 'border-amber-400/60 text-amber-200 bg-amber-500/10',
  high: 'border-rose-400/60 text-rose-200 bg-rose-500/10',
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
    'group relative rounded-2xl border transition-all duration-300 ease-out',
    compact ? 'p-3' : 'p-4',
    // 기본 스타일: 유리 질감
    'bg-[var(--color-bg-elevated)]/80 backdrop-blur-sm',
    'border-[var(--color-border)]',
    // 완료 상태: 뒤로 밀려나고 흐려짐
    task.completed ? 'opacity-60 scale-[0.98] grayscale-[0.5] border-transparent shadow-none' : 'hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:-translate-y-0.5',
    // 준비됨 상태: 은은한 오라
    isPrepared && !task.completed ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent' : '',
    // 드래그 중: 집어올린 느낌
    isDragging ? 'scale-105 rotate-2 shadow-2xl border-[var(--color-primary)] z-50 cursor-grabbing' : 'cursor-grab',
  ].join(' ');

  const checkboxClasses = [
    'flex h-6 w-6 items-center justify-center rounded-lg border transition-all duration-200',
    task.completed
      ? 'border-emerald-500 bg-emerald-500 text-white scale-110'
      : 'border-[var(--color-border)] bg-white/5 text-transparent hover:border-[var(--color-primary)] hover:scale-105',
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
              ✓
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate transition-colors ${task.completed ? 'text-[var(--color-text-tertiary)] line-through' : 'text-[var(--color-text)]'}`}>
                {task.text}
              </p>
              {task.memo && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{task.memo}</p>}
            </div>

            {/* Hover 시에만 보이는 컨트롤 */}
            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <button
                type="button"
                className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                aria-label="편집"
              >
                ✎
              </button>
              <button
                type="button"
                className="p-1.5 text-[var(--color-text-secondary)] hover:text-rose-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                aria-label="삭제"
              >
                ✕
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
            ✓
          </button>

          <div className="flex-1 space-y-2">
            {/* 상단: 텍스트 및 핵심 정보 */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
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
                    className="w-full bg-transparent text-sm font-medium text-[var(--color-text)] outline-none border-b border-[var(--color-primary)]"
                  />
                ) : (
                  <button
                    type="button"
                    data-task-interactive="true"
                    className={`text-left text-sm font-medium leading-snug transition-colors ${task.completed ? 'text-[var(--color-text-tertiary)] line-through' : 'text-[var(--color-text)]'}`}
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

                {/* 핵심 메타데이터 (항상 표시) */}
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span className="flex items-center gap-1">
                    ⏱️ {formatDuration(task.adjustedDuration)}
                  </span>
                  {isPrepared && (
                    <span className="text-emerald-400/80 flex items-center gap-0.5">
                      ✨ 준비됨
                    </span>
                  )}
                </div>
              </div>

              {/* 우측 상단 액션 (Hover 시 등장) */}
              <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  type="button"
                  className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-white/5 hover:text-rose-400 transition-colors"
                  data-task-interactive="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* 하단: 상세 컨트롤 (Progressive Disclosure - Hover 시 등장) */}
            {/* 단, 타이머가 활성화되어 있거나 모바일 환경 등을 고려해 일부는 항상 표시할 수도 있지만, 요청대로 '점진적 공개' 적용 */}
            <div className={`flex flex-wrap items-center gap-2 pt-1 transition-all duration-300 ${timerIconActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden group-hover:h-auto group-hover:opacity-100'}`}>

              {/* 난이도 뱃지 */}
              {!hideMetadata && (
                <div className="relative" data-task-interactive="true">
                  <button
                    type="button"
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${RESISTANCE_COLORS[task.resistance]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResistancePicker(!showResistancePicker);
                    }}
                  >
                    {RESISTANCE_LABELS[task.resistance]}
                  </button>
                  {showResistancePicker && (
                    <div className="absolute left-0 top-full mt-1 z-20 flex min-w-[120px] flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1.5 text-xs shadow-xl backdrop-blur-md">
                      <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-emerald-200" onClick={() => handleResistanceChange('low')}>
                        💧 쉬움 (x1.0)
                      </button>
                      <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-amber-200" onClick={() => handleResistanceChange('medium')}>
                        🌊 보통 (x1.3)
                      </button>
                      <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-rose-200" onClick={() => handleResistanceChange('high')}>
                        🌪️ 어려움 (x1.6)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 시간 변경 */}
              <div className="relative" data-task-interactive="true">
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDurationPicker(!showDurationPicker);
                  }}
                >
                  시간 변경
                </button>
                {showDurationPicker && (
                  <div className="absolute left-0 top-full mt-1 z-20 grid grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 text-xs shadow-xl backdrop-blur-md w-[180px]">
                    {durationOptions.map((duration) => (
                      <button
                        key={duration}
                        className={`rounded-lg px-2 py-1.5 transition ${task.baseDuration === duration ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-white/5 text-[var(--color-text-secondary)]'}`}
                        onClick={() => handleDurationChange(duration)}
                      >
                        {duration}m
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 메모 버튼 */}
              <button
                type="button"
                className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${task.memo ? 'border-sky-500/30 text-sky-300' : 'border-white/10 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]'}`}
                data-task-interactive="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMemoModal(true);
                }}
              >
                {task.memo ? '📝 메모 있음' : '+ 메모'}
              </button>

              {/* 타이머 버튼 */}
              <button
                type="button"
                className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${timerIconActive
                    ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/10 text-[var(--color-text-tertiary)] hover:text-indigo-300'
                  }`}
                data-task-interactive="true"
                onClick={handleTimerToggle}
              >
                {timerIconActive ? '⏹ 중지' : '▶ 타이머'}
              </button>

              {/* XP 표시 */}
              {!hideMetadata && (
                <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
                  +{xp} XP
                </span>
              )}
            </div>

            {/* 타이머 활성 상태 표시 (항상 보임) */}
            {timerIconActive && (
              <div className="mt-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2" data-task-interactive="true">
                <div className="flex items-center justify-between text-xs text-indigo-200 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    집중 중...
                  </span>
                  <span className="font-mono font-medium">{formatElapsedTime(elapsedTime)}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-black/20">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.min((elapsedTime / (task.adjustedDuration * 60)) * 100, 100)}%` }}
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
