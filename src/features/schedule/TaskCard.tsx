/**
 * @file TaskCard.tsx
 * @role 개별 작업 카드 컴포넌트 (Tailwind 기반)
 * @input task (작업 데이터), 콜백 핸들러 (onEdit, onDelete, onToggle 등)
 * @output 체크박스, 메타데이터, 인라인 편집, 메모, 타이머를 포함한 카드 UI
 * @dependencies NeonCheckbox, MemoModal, useDragDropManager, xpParticleStore
 */

import { useState, useEffect } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { formatDuration, calculateTaskXP, getLocalDate } from '@/shared/lib/utils';
import { MemoModal } from './MemoModal';
import { useDragDropManager } from './hooks/useDragDropManager';
import { NeonCheckbox } from '@/shared/components/ui/NeonCheckbox';
import { toast } from 'react-hot-toast';
import { useMemoMissionStore } from '@/shared/stores/memoMissionStore';
import { getBucketStartHour } from './utils/timeBlockBucket';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUpdateTask?: (updates: Partial<Task>) => void;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  onAwardXP?: (amount: number, context?: 'memo_mission') => Promise<void> | void;
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

/**
 * 개별 작업 카드 컴포넌트
 * 작업의 상세 정보를 표시하고 체크, 편집, 삭제, 드래그 앤 드롭 기능을 제공합니다.
 *
 * @param props.task - 표시할 작업 데이터
 * @param props.onEdit - 편집 버튼 클릭 콜백
 * @param props.onDelete - 삭제 버튼 클릭 콜백
 * @param props.onToggle - 완료 토글 콜백
 * @param props.onUpdateTask - 작업 부분 업데이트 콜백
 * @param props.onDragStart - 드래그 시작 콜백
 * @param props.onDragEnd - 드래그 종료 콜백
 * @param props.onAwardXP - XP 지급 콜백 (메모 미션 등)
 * @param props.hideMetadata - 메타데이터 숨김 여부
 * @param props.blockIsLocked - 소속 블록 잠금 상태
 * @param props.compact - 컴팩트 모드 여부
 * @returns 작업 카드 UI
 */
export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggle,
  onUpdateTask,
  onDragStart,
  onDragEnd,
  onAwardXP,
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const showMinimal = compact && hideMetadata;

  const { setDragData } = useDragDropManager();
  const { openMission } = useMemoMissionStore();

  const xp = calculateTaskXP(task);
  const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);
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
    const sourceBucketStart = typeof task.hourSlot === 'number' ? getBucketStartHour(task.hourSlot) : undefined;
    setDragData(
      {
        taskId: task.id,
        sourceBlockId: task.timeBlock,
        sourceHourSlot: task.hourSlot,
        sourceBucketStart,
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

  /** 체크박스 토글 (순수 콜백 버전 - NeonCheckbox용) */
  const handleCheckboxToggle = () => {
    if (task.completed) {
      onToggle();
      toast('완료를 취소했어요. XP가 회수됩니다.', {
        icon: '↩️',
        className: 'text-sm',
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

  const handleOpenMemoMission = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (blockIsLocked) {
      toast('이 블록은 잠금 상태입니다.', { icon: '🔒', className: 'text-sm' });
      return;
    }
    openMission(task, onUpdateTask, onAwardXP);
  };

  /**
   * 타이머 토글 핸들러 (현재 미사용, 향후 타이머 기능 활성화 시 사용 예정)
   * @param timerEvent - 마우스 클릭 이벤트
   */
  const handleTimerToggle = (timerEvent: React.MouseEvent) => {
    timerEvent.stopPropagation();
    if (!timerIconActive) {
      setTimerStartTime(Date.now());
      setElapsedSeconds(0);
    } else {
      setTimerStartTime(null);
    }
    setTimerIconActive(!timerIconActive);
  };

  // 타이머가 활성화된 경우 경과 시간을 1초마다 업데이트
  useEffect(() => {
    if (!timerIconActive || timerStartTime === null) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerIconActive, timerStartTime]);

  /**
   * 경과 시간을 MM:SS 형식으로 포맷팅
   * @param totalSeconds - 총 경과 초
   * @returns 포맷팅된 시간 문자열 (예: "05:30")
   */
  const formatElapsedTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 타이머 관련 변수 (향후 UI 통합 시 사용)
  void handleTimerToggle;
  void formatElapsedTime;
  void elapsedSeconds;

  const memoModalComponent = showMemoModal ? (
    <MemoModal
      memo={task.memo}
      onSave={(newMemo) => {
        onUpdateTask?.({ memo: newMemo });
        setShowMemoModal(false);
      }}
      onClose={() => setShowMemoModal(false)}
    />
  ) : null;

  const cardClassName = [
    'group relative rounded-xl border transition-all duration-300 ease-out',
    compact ? 'p-1.5' : 'p-2.5',
    'bg-[var(--color-bg-elevated)]/80 backdrop-blur-sm',
    'border-[var(--color-border)]',
    task.completed ? 'opacity-60 scale-[0.98] grayscale-[0.5] border-transparent shadow-none' : 'hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:-translate-y-0.5',
    isPrepared && !task.completed ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent' : '',
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
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-6 h-6" data-task-interactive="true">
              <NeonCheckbox
                checked={task.completed}
                onChange={handleCheckboxToggle}
                size={20}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold truncate transition-colors ${task.completed ? 'text-[var(--color-text-tertiary)] line-through' : 'text-[var(--color-text)]'}`}>
                {displayText}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
                {!hideMetadata && !showMinimal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-2 py-0.5 font-semibold text-[var(--color-primary)] shadow-sm">
                    🪙 <span className="tabular-nums">+{xp}</span> XP
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/70 px-2 py-0.5">
                  ⏱ <span className="tabular-nums">{expectedDurationLabel}</span>
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${RESISTANCE_COLORS[task.resistance]}`}>
                  {RESISTANCE_BADGE_LABEL[task.resistance]}
                </span>
                {!showMinimal && task.deadline && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${task.deadline < getLocalDate() ? 'border-rose-400/60 bg-rose-500/10 text-rose-200' : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/70 text-[var(--color-text-secondary)]'}`}>
                    📅 {task.deadline.slice(5).replace('-', '/')}
                  </span>
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
        {memoModalComponent}
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
              onChange={handleCheckboxToggle}
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
                    className={`rounded-full border px-2 py-0.5 font-semibold ${task.deadline && task.deadline < getLocalDate()
                      ? 'border-rose-400/60 bg-rose-500/10 text-rose-200'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 text-[var(--color-text-secondary)]'
                      }`}
                  >
                    📅 {task.deadline ? task.deadline.slice(5).replace('-', '/') : '오늘'}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20 hover:text-white"
                    data-task-interactive="true"
                    onClick={handleOpenMemoMission}
                    title="1분 메모 챌린지로 XP를 받아보세요"
                  >
                    🎯 20XP 찬스
                  </button>

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

      {memoModalComponent}
    </>
  );
}
