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
import { NeonCheckbox } from '@/shared/components/ui/NeonCheckbox';
import { toast } from 'react-hot-toast';

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

const RESISTANCE_EMOJI: Record<Resistance, string> = {
  low: '🟢',
  medium: '🟠',
  high: '🔴'
};

const RESISTANCE_BADGE_LABEL: Record<Resistance, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High'
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
  const preparationCount = [task.preparation1, task.preparation2, task.preparation3].filter(Boolean).length;
  const displayText = task.emoji ? `${task.emoji} ${task.text}` : task.text;
  const expectedDurationLabel = formatDuration(task.baseDuration);
  const durationOptions = [5, 10, 15, 30, 45, 60];
  const hasOpenPicker = showDurationPicker || showResistancePicker;

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
      toast('완료를 취소했어요. XP가 회수됩니다.', {
        icon: '↩️',
        className: 'text-sm',
      });
      return;
    }
    if (task.timeBlock && blockIsLocked === false) {
      toast('블록을 먼저 잠궈야 작업을 완료할 수 있습니다! (잠금 버튼 🔒 클릭)', {
        icon: '🔒',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
        id: 'lock-warning',
      });
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
    'group relative rounded-xl border transition-all duration-300 ease-out',
    compact ? 'p-2' : 'p-2.5',
    // 기본 스타일: 유리 질감
    'bg-[var(--color-bg-elevated)]/80 backdrop-blur-sm',
    'border-[var(--color-border)]',
    // 완료 상태: 뒤로 밀려나고 흐려짐
    task.completed ? 'opacity-60 scale-[0.98] grayscale-[0.5] border-transparent shadow-none' : 'hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:-translate-y-0.5',
    // 준비됨 상태: 은은한 오라
    isPrepared && !task.completed ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent' : '',
    // 드래그 중: 집어올린 느낌
    isDragging ? 'scale-105 rotate-2 shadow-2xl border-[var(--color-primary)] z-[10000] cursor-grabbing' : 'cursor-grab',
    hasOpenPicker ? 'z-[10000]' : '',
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
            <div className="flex items-center justify-center w-8 h-8" data-task-interactive="true">
              <NeonCheckbox
                checked={task.completed}
                onChange={handleToggleClick}
                size={24}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate transition-colors ${task.completed ? 'text-[var(--color-text-tertiary)] line-through' : 'text-[var(--color-text)]'}`}>
                {displayText}
              </p>
              {task.memo && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{task.memo}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] relative">
                {!hideMetadata && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-2 py-0.5 font-semibold text-[var(--color-primary)] shadow-sm">
                    🪙 +{xp} XP
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDurationPicker(prev => !prev);
                    setShowResistancePicker(false);
                  }}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 px-2 py-0.5 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors"
                  data-task-interactive="true"
                >
                  ⌛ {expectedDurationLabel}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowResistancePicker(prev => !prev);
                    setShowDurationPicker(false);
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${RESISTANCE_COLORS[task.resistance]}`}
                  data-task-interactive="true"
                >
                  {RESISTANCE_EMOJI[task.resistance]} {RESISTANCE_BADGE_LABEL[task.resistance]}
                </button>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 px-2 py-0.5 text-[var(--color-text-secondary)]">
                  Prep {preparationCount}/3
                </span>

                {showDurationPicker && (
                  <div className="absolute left-0 top-full z-[9999] mt-2 grid grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 text-xs shadow-xl backdrop-blur-md w-[180px]">
                    {durationOptions.map((duration) => (
                      <button
                        key={duration}
                        className={`rounded-lg px-2 py-1.5 transition ${task.baseDuration === duration ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-white/5 text-[var(--color-text-secondary)]'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDurationChange(duration);
                        }}
                      >
                        {duration}m
                      </button>
                    ))}
                  </div>
                )}
                {showResistancePicker && (
                  <div className="absolute left-0 top-full z-[9999] mt-2 flex min-w-[120px] flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1.5 text-xs shadow-xl backdrop-blur-md">
                    <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-emerald-200" onClick={(e) => { e.stopPropagation(); handleResistanceChange('low'); }}>
                      💧 쉬움 (x1.0)
                    </button>
                    <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-amber-200" onClick={(e) => { e.stopPropagation(); handleResistanceChange('medium'); }}>
                      🌊 보통 (x1.3)
                    </button>
                    <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-rose-200" onClick={(e) => { e.stopPropagation(); handleResistanceChange('high'); }}>
                      🌪️ 어려움 (x1.6)
                    </button>
                  </div>
                )}
              </div>
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
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center w-8 h-8 pt-1" data-task-interactive="true">
            <NeonCheckbox
              checked={task.completed}
              onChange={handleToggleClick}
              size={24}
            />
          </div>

          <div className="flex-1 space-y-2">
            {/* 상단: 텍스트 및 핵심 정보 */}
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
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
                    {displayText}
                  </button>
                )}

                {/* 핵심 메타데이터 (항상 표시) */}
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[var(--color-text-secondary)] relative">
                  {!hideMetadata && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-2 py-0.5 font-semibold text-[var(--color-primary)] shadow-sm">
                      🪙 +{xp} XP
                    </span>
                  )}
                  <button
                    type="button"
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 px-2 py-0.5 font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors"
                    data-task-interactive="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDurationPicker(prev => !prev);
                      setShowResistancePicker(false);
                    }}
                  >
                    ⌛ {expectedDurationLabel}
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${RESISTANCE_COLORS[task.resistance]}`}
                    data-task-interactive="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResistancePicker(prev => !prev);
                      setShowDurationPicker(false);
                    }}
                  >
                    {RESISTANCE_EMOJI[task.resistance]} {RESISTANCE_BADGE_LABEL[task.resistance]}
                  </button>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-semibold ${preparationCount === 3
                      ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 text-[var(--color-text-secondary)]'
                      }`}
                  >
                    Prep {preparationCount}/3
                  </span>

                  {showDurationPicker && (
                    <div className="absolute left-0 top-full z-[9999] mt-2 grid grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 text-xs shadow-xl backdrop-blur-md w-[180px]">
                      {durationOptions.map((duration) => (
                        <button
                          key={duration}
                          className={`rounded-lg px-2 py-1.5 transition ${task.baseDuration === duration ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-white/5 text-[var(--color-text-secondary)]'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDurationChange(duration);
                          }}
                        >
                          {duration}m
                        </button>
                      ))}
                    </div>
                  )}
                  {showResistancePicker && (
                    <div className="absolute left-0 top-full z-[9999] mt-2 flex min-w-[120px] flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1.5 text-xs shadow-xl backdrop-blur-md">
                      <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-emerald-200" onClick={(e) => { e.stopPropagation(); handleResistanceChange('low'); }}>
                        💧 쉬움 (x1.0)
                      </button>
                      <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-amber-200" onClick={(e) => { e.stopPropagation(); handleResistanceChange('medium'); }}>
                        🌊 보통 (x1.3)
                      </button>
                      <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-rose-200" onClick={(e) => { e.stopPropagation(); handleResistanceChange('high'); }}>
                        🌪️ 어려움 (x1.6)
                      </button>
                    </div>
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
