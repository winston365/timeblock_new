/**
 * TaskCard
 *
 * Tailwind 기반 task 카드 (체크, 메타데이터, 인라인 편집, 메모, 타이머 포함)
 * 디자인 개선: Progressive Disclosure & Micro-interactions
 */

import { useState, useEffect, useRef } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { formatDuration, calculateTaskXP } from '@/shared/lib/utils';
import { MemoModal } from './MemoModal';
import { useDragDropManager } from './hooks/useDragDropManager';
import { NeonCheckbox } from '@/shared/components/ui/NeonCheckbox';
import { toast } from 'react-hot-toast';
import { useXPParticleStore } from '@/features/gamification/stores/xpParticleStore';
import { useGoalStore } from '@/shared/stores/goalStore';
import { FocusTimer } from './components/FocusTimer';

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
  const [showMemoMissionModal, setShowMemoMissionModal] = useState(false);
  const [initialMemoLength, setInitialMemoLength] = useState(0);
  const [memoMissionStartTime, setMemoMissionStartTime] = useState<number | null>(null);
  const [memoMissionElapsed, setMemoMissionElapsed] = useState(0);
  const [memoMissionText, setMemoMissionText] = useState(task.memo || '');
  const missionTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(task.text);
  const [timerIconActive, setTimerIconActive] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const showMinimal = compact && hideMetadata;

  const { setDragData } = useDragDropManager();
  const { goals } = useGoalStore();
  const linkedGoal = task.goalId ? goals.find(g => g.id === task.goalId) : null;

  useEffect(() => {
    if (showMemoMissionModal) return;
    setMemoMissionText(task.memo || '');
  }, [task.memo, showMemoMissionModal]);

  useEffect(() => {
    if (!showMemoMissionModal || memoMissionStartTime === null) return;

    const interval = setInterval(() => {
      setMemoMissionElapsed(Math.floor((Date.now() - memoMissionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [showMemoMissionModal, memoMissionStartTime]);

  useEffect(() => {
    if (!showMemoMissionModal) return;
    requestAnimationFrame(() => missionTextAreaRef.current?.focus());
  }, [showMemoMissionModal]);

  const xp = calculateTaskXP(task);
  const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);
  const preparationCount = [task.preparation1, task.preparation2, task.preparation3].filter(Boolean).length;
  const displayText = task.emoji ? `${task.emoji} ${task.text}` : task.text;
  const expectedDurationLabel = formatDuration(task.baseDuration);
  const durationOptions = [5, 10, 15, 30, 45, 60];
  const hasOpenPicker = showDurationPicker || showResistancePicker;
  const memoMissionCharCount = memoMissionText.length;
  const memoMissionAddedCount = Math.max(0, memoMissionCharCount - initialMemoLength);
  const memoMissionTimeMet = memoMissionElapsed >= 60;
  const memoMissionTextMet = memoMissionAddedCount >= 30;
  const memoMissionReward = memoMissionAddedCount >= 200 ? 40 : 20;
  const memoMissionEligible = memoMissionTimeMet && memoMissionTextMet;
  const memoMissionProgress = Math.min((memoMissionElapsed / 60) * 100, 100);

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

    // XP Particle Effect Trigger
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    useXPParticleStore.getState().spawnParticle(rect.left + rect.width / 2, rect.top + rect.height / 2, xp);

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
    setShowMemoMissionModal(true);
    setMemoMissionStartTime(Date.now());
    setMemoMissionElapsed(0);
    const currentMemo = task.memo || '';
    setMemoMissionText(currentMemo);
    setInitialMemoLength(currentMemo.length);
  };

  const handleCloseMemoMission = () => {
    setShowMemoMissionModal(false);
    setMemoMissionStartTime(null);
    setMemoMissionElapsed(0);
  };

  const handleCompleteMemoMission = async () => {
    if (!memoMissionEligible) return;
    const reward = memoMissionReward;

    try {
      await onUpdateTask?.({ memo: memoMissionText });
    } catch (error) {
      console.error('[TaskCard] 메모 저장에 실패했습니다:', error);
    }

    try {
      if (onAwardXP) {
        await onAwardXP(reward, 'memo_mission');
      } else {
        const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
        await useGameStateStore.getState().addXP(reward, task.timeBlock || undefined);
      }
      toast.success(`+${reward} XP 획득!`, { icon: '🎉' });
    } catch (error) {
      console.error('[TaskCard] XP 지급 실패:', error);
      toast.error('XP 지급에 실패했어요. 다시 시도해주세요.');
    } finally {
      handleCloseMemoMission();
    }
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

  const memoMissionModal = showMemoMissionModal ? (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md"
      onClick={handleCloseMemoMission}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-0 md:grid-cols-[320px_1fr]">
          <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-indigo-900/60 via-indigo-800/40 to-slate-900/40 p-6 text-white">
            <FocusTimer
              progress={memoMissionProgress}
              size={220}
              strokeWidth={12}
              isRunning
              color={memoMissionEligible ? '#22c55e' : '#a855f7'}
            >
              <div className="text-center">
                <p className="text-xs text-white/70">경과 시간</p>
                <p className="text-4xl font-bold leading-tight">{formatElapsedTime(memoMissionElapsed)}</p>
                <p className="text-sm text-white/60">목표 01:00</p>
              </div>
            </FocusTimer>

            <div className="w-full space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{memoMissionTimeMet ? '✅' : '⏱️'}</span>
                  <span>1분 경과</span>
                </div>
                <span className={memoMissionTimeMet ? 'text-emerald-200 font-semibold' : 'text-white/70'}>
                  {formatElapsedTime(memoMissionElapsed)} / 01:00
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{memoMissionTextMet ? '✅' : '✍️'}</span>
                  <span>추가 30자 이상</span>
                </div>
                <span className={memoMissionTextMet ? 'text-emerald-200 font-semibold' : 'text-white/70'}>
                  +{memoMissionAddedCount}자
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>🏅</span>
                  <span>예상 보상</span>
                </div>
                <span className={memoMissionReward === 40 ? 'text-amber-200 font-semibold' : 'text-indigo-100 font-semibold'}>
                  +{memoMissionReward} XP
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">20XP Chance</p>
                <h3 className="text-xl font-bold text-[var(--color-text)]">1분 메모 챌린지</h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">1분 이상, 추가 30자 이상 → 20XP / 추가 200자 이상 → 40XP</p>
              </div>
              <button
                type="button"
                className="rounded-full bg-[var(--color-bg-tertiary)] px-3 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                onClick={handleCloseMemoMission}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <textarea
              ref={missionTextAreaRef}
              className="h-48 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm leading-relaxed text-[var(--color-text)] shadow-inner transition-all focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              value={memoMissionText}
              onChange={(e) => setMemoMissionText(e.target.value)}
              placeholder="오늘의 느낌, 깨달음, 작은 회고를 1분 동안 적어보세요."
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-tertiary)]">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-1 font-semibold text-[var(--color-text)]">
                  +{memoMissionAddedCount}자 (총 {memoMissionCharCount}자)
                </span>
                <span className={memoMissionTextMet ? 'text-emerald-400' : 'text-[var(--color-text-tertiary)]'}>
                  {memoMissionTextMet ? '글자 조건 달성!' : '추가 30자 이상 작성하면 조건 충족'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 font-semibold ${memoMissionEligible
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                    }`}
                >
                  {memoMissionEligible ? '조건 충족' : '조건 미충족'}
                </span>
                <span
                  className={`rounded-full px-2 py-1 font-semibold ${memoMissionReward === 40
                    ? 'bg-amber-500/20 text-amber-200'
                    : 'bg-indigo-500/10 text-indigo-100'
                    }`}
                >
                  예상 보상 +{memoMissionReward} XP
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
                onClick={handleCloseMemoMission}
              >
                취소
              </button>
              <button
                type="button"
                className={`rounded-xl px-5 py-2 text-sm font-bold shadow-md transition ${memoMissionEligible
                  ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                  }`}
                disabled={!memoMissionEligible}
                onClick={handleCompleteMemoMission}
              >
                완료 (+{memoMissionReward} XP)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
                onChange={handleToggleClick}
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
                {!showMinimal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/70 px-2 py-0.5 text-[var(--color-text-secondary)]">
                    Prep <span className="tabular-nums">{preparationCount}</span>/3
                  </span>
                )}
                {linkedGoal && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors"
                    style={{
                      borderColor: linkedGoal.color ? `${linkedGoal.color}40` : 'var(--color-primary)',
                      backgroundColor: linkedGoal.color ? `${linkedGoal.color}10` : 'var(--color-primary-10)',
                      color: linkedGoal.color || 'var(--color-primary)',
                    }}
                  >
                    {linkedGoal.icon && <span>{linkedGoal.icon}</span>}
                    <span>{linkedGoal.title}</span>
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
        {memoMissionModal}
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
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20 hover:text-white"
                    data-task-interactive="true"
                    onClick={handleOpenMemoMission}
                    title="1분 메모 챌린지로 XP를 받아보세요"
                  >
                    🎯 20XP 찬스
                  </button>
                  {linkedGoal && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors"
                      style={{
                        borderColor: linkedGoal.color ? `${linkedGoal.color}40` : 'var(--color-primary)',
                        backgroundColor: linkedGoal.color ? `${linkedGoal.color}10` : 'var(--color-primary-10)',
                        color: linkedGoal.color || 'var(--color-primary)',
                      }}
                    >
                      {linkedGoal.icon && <span>{linkedGoal.icon}</span>}
                      <span>{linkedGoal.title}</span>
                    </span>
                  )}

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
      {memoMissionModal}
    </>
  );
}
