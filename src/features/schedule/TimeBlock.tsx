/**
 * TimeBlock
 *
 * @role 시간대별 작업 목록을 표시하고 관리하는 타임블록 컴포넌트. 드래그앤드롭, 인라인 작업 생성, 잠금 기능 제공
 * @input block (시간대 정보), tasks (작업 목록), state (블록 상태), 각종 핸들러 함수들
 * @output 시간대 헤더, 작업 카드 목록, 인라인 입력 필드, 진행률 바를 포함한 블록 UI
 * @external_dependencies
 *   - TaskCard: 개별 작업 표시
 *   - utils: XP 계산 함수
 */

import { useState, useEffect, memo } from 'react';
import type { Task, TimeBlockState, TimeBlockId } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';
import HourBar from './HourBar';
import { useDragDrop } from './hooks/useDragDrop';

interface TimeBlockProps {
  block: {
    id: string;
    label: string;
    start: number;
    end: number;
  };
  tasks: Task[];
  state: TimeBlockState;
  isCurrentBlock: boolean;
  isPastBlock?: boolean;
  onAddTask: () => void;
  onCreateTask?: (text: string, blockId: TimeBlockId, hourSlot?: number) => Promise<void>;
  onEditTask: (task: Task) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onToggleLock?: () => void;
  onUpdateBlockState?: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
  onDropTask?: (taskId: string, targetBlockId: TimeBlockId) => void;
}

/**
 * 타임블록 컴포넌트
 *
 * @param {TimeBlockProps} props - 컴포넌트 props
 * @returns {JSX.Element} 타임블록 UI
 * @sideEffects
 *   - 드래그앤드롭으로 작업 이동
 *   - 인라인 입력으로 작업 생성
 *   - 잠금 상태 변경 시 XP 차감/보상
 */
const TimeBlock = memo(function TimeBlock({
  block,
  tasks,
  state,
  isCurrentBlock,
  isPastBlock = false,
  onAddTask: _onAddTask, // NOTE: 현재 사용되지 않음
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onToggleLock,
  onUpdateBlockState,
  onDropTask: _onDropTask, // 사용하지 않음 (useDragDrop 훅으로 대체)
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);

  // 통합 드래그 앤 드롭 훅 사용 (블록 레벨, hourSlot 없음)
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(
    block.id as TimeBlockId,
    undefined // hourSlot 없음 (블록 레벨 드롭)
  );

  // 3분 타이머 상태
  const [timerElapsed, setTimerElapsed] = useState(0); // 경과 시간 (초)

  // 블록 총 XP 계산 (현재 미사용)
  // const totalXP = tasks
  //   .filter(t => t.completed)
  //   .reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 예상 최대 XP 계산
  const maxXP = tasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 블록 총 예상 시간 계산 (모든 작업 - 진행률 바용)
  const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 완료된 시간 계산
  const completedDuration = tasks
    .filter(t => t.completed)
    .reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 미완료 작업의 시간 계산 (시간 상태 판정용)
  const pendingDuration = tasks
    .filter(t => !t.completed)
    .reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 현재 시간대의 남은 시간 계산 (시간 + 분 단위)
  const getTimeRemaining = () => {
    if (!isCurrentBlock) return null;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 블록 종료 시간을 분 단위로 계산
    const blockEndMinutes = block.end * 60;
    const currentMinutes = currentHour * 60 + currentMinute;

    // 남은 시간 (분)
    const remainingMinutes = blockEndMinutes - currentMinutes;

    if (remainingMinutes <= 0) return { hours: 0, minutes: 0, text: '0m' };

    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    // 표시 텍스트 생성
    let text = '';
    if (hours > 0 && minutes > 0) {
      text = `${hours}h${minutes}m`;
    } else if (hours > 0) {
      text = `${hours}h`;
    } else {
      text = `${minutes}m`;
    }

    return { hours, minutes, text };
  };

  const timeRemaining = getTimeRemaining();

  // 남은 시간을 분 단위로 계산
  const getRemainingMinutes = () => {
    if (!timeRemaining) return 0;
    return timeRemaining.hours * 60 + timeRemaining.minutes;
  };

  const remainingMinutes = getRemainingMinutes();

  // 분을 시간과 분으로 변환하는 함수
  const formatMinutesToHM = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  // 시간 상태 계산 (여유도 기반 - 미완료 작업 기준)
  const getTimeStatus = (): 'comfortable' | 'balanced' | 'tight' | 'critical' => {
    if (pendingDuration === 0) return 'balanced';
    const ratio = remainingMinutes / pendingDuration;
    if (ratio >= 1.3) return 'comfortable';      // 남은 시간 >= 계획 시간 × 1.1배
    if (ratio >= 1.15) return 'balanced';         // 남은 시간 = 계획 시간 × 0.9~1.1배
    if (ratio >= 0.9) return 'tight';           // 남은 시간 = 계획 시간 × 0.75~0.9배
    return 'critical';                           // 남은 시간 < 계획 시간 × 0.75배
  };

  const timeStatus = getTimeStatus();

  // 프로그레스 바 계산 (0-100% - 미완료 작업 기준)
  const getProgressPercentage = (): number => {
    if (pendingDuration === 0) return 0;
    const percentage = (pendingDuration / remainingMinutes) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  };

  const progressPercentage = getProgressPercentage();

  // 툴팁 텍스트 생성
  const getTooltipText = (): string => {
    const utilization = Math.round(progressPercentage);
    const statusText = {
      comfortable: '여유 있음',
      balanced: '적정',
      tight: '촉박',
      critical: '위험'
    }[timeStatus];
    return `활용률 ${utilization}% • ${statusText}`;
  };

  // 상태 아이콘 가져오기
  const getStatusIcon = (): string => {
    const icons = {
      comfortable: '🟢',
      balanced: '🔵',
      tight: '🟠',
      critical: '🔴'
    };
    return icons[timeStatus];
  };

  // 상태 텍스트 가져오기
  const getStatusText = (): string => {
    const texts = {
      comfortable: '여유',
      balanced: '적정',
      tight: '촉박',
      critical: '위험'
    };
    return texts[timeStatus];
  };

  // 타이머 경과 시간 계산
  useEffect(() => {
    if (!state?.lockTimerStartedAt) {
      setTimerElapsed(0);
      return;
    }

    const updateTimer = async () => {
      const elapsed = Math.floor((Date.now() - state.lockTimerStartedAt!) / 1000);
      const duration = (state.lockTimerDuration || 180000) / 1000; // 기본 3분

      if (elapsed >= duration) {
        // 타이머 완료 - 자동 잠금
        setTimerElapsed(duration);
        if (!state.isLocked && onToggleLock) {
          // 블록 잠금
          onToggleLock();

          // 타이머 상태 초기화
          try {
            const { updateBlockState } = await import('@/data/repositories/dailyDataRepository');
            await updateBlockState(block.id, {
              lockTimerStartedAt: null,
              lockTimerDuration: undefined,
            });
          } catch (error) {
            console.error('Failed to clear timer state:', error);
          }
        }
      } else {
        setTimerElapsed(elapsed);
      }
    };

    updateTimer(); // 초기 실행
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [state?.lockTimerStartedAt, state?.lockTimerDuration, state?.isLocked, onToggleLock, block.id]);

  // 타이머 시작 핸들러
  const handleStartLockTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (tasks.length === 0) {
      alert('빈 블록은 잠글 수 없습니다. 작업을 먼저 추가해주세요.');
      return;
    }

    if (onUpdateBlockState) {
      try {
        await onUpdateBlockState(block.id, {
          lockTimerStartedAt: Date.now(),
          lockTimerDuration: 180000, // 3분
        });
      } catch (error) {
        console.error('Failed to start lock timer:', error);
      }
    }
  };

  // 타이머 취소 핸들러
  const handleCancelLockTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onUpdateBlockState) {
      try {
        await onUpdateBlockState(block.id, {
          lockTimerStartedAt: null,
          lockTimerDuration: undefined,
        });
      } catch (error) {
        console.error('Failed to cancel lock timer:', error);
      }
    }
  };

  // 타이머 진행률 계산
  const getTimerProgress = (): number => {
    if (!state?.lockTimerStartedAt) return 0;
    const duration = (state.lockTimerDuration || 180000) / 1000;
    return Math.min((timerElapsed / duration) * 100, 100);
  };

  // 남은 시간 포맷팅 (MM:SS)
  const formatRemainingTime = (): string => {
    if (!state?.lockTimerStartedAt) return '3:00';
    const duration = (state.lockTimerDuration || 180000) / 1000;
    const remaining = Math.max(duration - timerElapsed, 0);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 추가 버튼 클릭 핸들러
  // NOTE: 현재 사용되지 않음 - 필요시 주석 해제
  // const handleAddClick = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //
  //   // onCreateTask가 있으면 인라인 입력 사용, 없으면 기존 모달 방식
  //   if (onCreateTask) {
  //     setShowInlineInput(true);
  //     if (!isExpanded) {
  //       setIsExpanded(true);
  //     }
  //   } else {
  //     onAddTask();
  //   }
  // };

  // 빈 공간 클릭시 접기
  const handleBlockContentClick = (e: React.MouseEvent) => {
    // 태스크 카드나 버튼이 아닌 빈 공간 클릭시에만 토글
    if (e.target === e.currentTarget) {
      setIsExpanded(!isExpanded);
    }
  };

  // 작업 완료 토글 핸들러 (잠금 확인)
  const handleTaskToggle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // 작업을 완료하려고 할 때 (현재 미완료 상태)
    if (!task.completed) {
      // 블록이 잠기지 않았으면 경고
      if (!state?.isLocked) {
        alert('⚠️ 블록을 먼저 잠궈야 작업을 완료할 수 있습니다!\n\n블록 잠금 버튼(⚠️)을 눌러주세요. (비용: 15 XP)');
        return;
      }
    }

    // 잠금 확인 통과 또는 완료 취소인 경우
    onToggleTask(taskId);
  };

  // 드롭 핸들러 래퍼 (onUpdateTask를 handleDrop에 전달)
  const handleDropWrapper = async (e: React.DragEvent) => {
    if (!onUpdateTask) return;

    await handleDrop(e, async (taskId, updates) => {
      onUpdateTask(taskId, updates);
    });
  };

  const statusStyles: Record<
    'comfortable' | 'balanced' | 'tight' | 'critical',
    { icon: string; fill: string; badge: string }
  > = {
    comfortable: {
      icon: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200',
      fill: 'from-emerald-300 via-emerald-400 to-emerald-300',
      badge: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
    },
    balanced: {
      icon: 'border-indigo-400/60 bg-indigo-500/10 text-indigo-200',
      fill: 'from-indigo-300 via-indigo-400 to-violet-300',
      badge: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-100',
    },
    tight: {
      icon: 'border-amber-400/60 bg-amber-500/10 text-amber-100',
      fill: 'from-amber-300 via-amber-400 to-amber-500',
      badge: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
    },
    critical: {
      icon: 'border-rose-400/60 bg-rose-500/10 text-rose-100',
      fill: 'from-rose-300 via-rose-500 to-red-500',
      badge: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
    },
  };

  const statusStyle = statusStyles[timeStatus];
  const plannedWidth = remainingMinutes ? Math.min((pendingDuration / (remainingMinutes || 1)) * 100, 100) : 0;
  const completionPercentage = totalDuration > 0 ? (completedDuration / totalDuration) * 100 : 0;

  const blockClassName = [
    'relative flex min-h-[72px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-all duration-300',
    isExpanded ? 'shadow-lg' : 'hover:shadow-md',
    isCurrentBlock ? 'border-[var(--color-primary)] ring-4 ring-[rgba(99,102,241,0.12)]' : '',
    isDragOver ? 'ring-2 ring-offset-2 ring-[var(--color-primary)]/70' : '',
    isPastBlock ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const blockStyle = isPastBlock ? { filter: 'grayscale(0.35)' } : undefined;

  const blockHeaderClass = [
    'flex flex-col gap-4 cursor-pointer border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-bg-surface)] via-[var(--color-bg-elevated)] to-[var(--color-bg-elevated)] px-4 py-4 select-none lg:flex-row lg:items-start lg:justify-between',
    isPastBlock ? 'py-3' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={blockClassName}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
      style={blockStyle}
    >
      <div className={blockHeaderClass} onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* 왼쪽: 잠금 버튼 / 타이머 버튼 */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            {state?.isLocked ? (
              // 잠긴 상태
              <button
                className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-emerald-400/60 bg-emerald-500/15 text-xl text-emerald-100 shadow-lg transition hover:scale-105 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPastBlock) {
                    onToggleLock?.();
                  }
                }}
                disabled={isPastBlock}
                title={isPastBlock ? "지난 시간대는 잠금 해제할 수 없습니다" : "잠금 해제 (패널티: -40 XP)"}
              >
                🔒
              </button>
            ) : state?.lockTimerStartedAt ? (
              // 타이머 진행 중
              <div className="flex flex-wrap items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  className="rounded-2xl border-2 border-rose-400/60 bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:scale-105"
                  onClick={handleCancelLockTimer}
                  title="타이머 취소"
                >
                  ❌
                </button>
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-indigo-400/60 bg-indigo-500/15 px-4 py-3 text-center text-sm text-[var(--color-text)] shadow-[0_10px_30px_rgba(79,70,229,0.25)]">
                  <span className="text-xl">⏰</span>
                  <span className="font-mono text-lg tracking-[0.2em] text-white">{formatRemainingTime()}</span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-violet-400 transition-all duration-300"
                      style={{ width: `${getTimerProgress()}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : isPastBlock ? (
              // 지난 블록
              <button className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white/10 text-xl text-white/40" disabled title="지난 시간대는 잠금할 수 없습니다">
                🔓
              </button>
            ) : (
              // 타이머 시작 버튼
              <button
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition hover:translate-y-[-1px] hover:shadow-xl"
                onClick={handleStartLockTimer}
                title="3분 후 자동 잠금 시작 (완벽 달성 시: +40 XP)"
              >
                <span>⏰</span>
                <span>3분 뒤 잠금</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:gap-4">
            <span className="text-2xl font-bold tracking-[0.08em] text-[var(--color-text)]">{block.start.toString().padStart(2, '0')}-{block.end.toString().padStart(2, '0')}</span>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {state?.isLocked ? (
                // 잠긴 블록: 과거 블록이면서 미완료 작업이 있으면 "계획 실패"
                isPastBlock && tasks.some(t => !t.completed) ? (
                  <span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-rose-100">❌ 계획 실패</span>
                ) : (
                  <span className="rounded-full border border-amber-300/50 bg-amber-500/10 px-3 py-1 text-amber-100">✨ 40 XP 보너스 도전 중!</span>
                )
              ) : (
                <>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">📋 {tasks.length}</span>
                  {maxXP > 0 && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">✨ ~{maxXP}XP</span>}
                  {!isPastBlock && !state?.lockTimerStartedAt && <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-amber-100">⚠️ 잠금 필요</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          {/* 오른쪽: 시간 표시 (현재 시간대 블록만) */}
          {isCurrentBlock && timeRemaining && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[var(--color-text-secondary)] shadow-inner" data-tooltip={getTooltipText()}>
              <div className="flex flex-col gap-3">
                {/* 상태 아이콘 */}
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${statusStyle.icon}`}>
                  {getStatusIcon()}
                </div>

                {/* 시간 정보와 바 */}
                <div className="space-y-3">
                  {/* 계획 시간 바 */}
                  <div className="flex items-center gap-3">
                    <span className="w-14 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">📋 계획</span>
                    <div className="flex-1">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${statusStyle.fill}`}
                        style={{ width: `${plannedWidth}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-semibold text-[var(--color-text)]">{formatMinutesToHM(pendingDuration)}</span>
                  </div>

                  {/* 남은 시간 바 */}
                  <div className="flex items-center gap-3">
                    <span className="w-14 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">⏱️ 남은</span>
                    <div className="flex-1">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-violet-400`}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <span className="w-14 text-right font-semibold text-[var(--color-text)]">{formatMinutesToHM(remainingMinutes)}</span>
                  </div>
                </div>

                {/* 상태 텍스트 */}
                <div className={`mt-3 inline-flex w-full items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] ${statusStyle.badge}`}>
                  {getStatusText()}
                </div>
                <p className="mt-2 text-center text-[10px] uppercase tracking-[0.4em] text-[var(--color-text-tertiary)]">
                  {getTooltipText()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {state?.isPerfect && (
        <div className="absolute right-4 top-4 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100 shadow-inner">✨ 완벽한 계획!</div>
      )}
      {state?.isFailed && (
        <div className="absolute right-4 top-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100 shadow-inner">❌ 계획 실패</div>
      )}

      <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-indigo-400 to-fuchsia-400 transition-all duration-500"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]/40 px-4 py-4" onClick={handleBlockContentClick}>
          {/* 시간대별 HourBar 렌더링 */}
          {Array.from({ length: block.end - block.start }, (_, i) => block.start + i).map(hour => {
            // 해당 hour의 작업들 필터링
            const hourTasks = tasks.filter(task => task.hourSlot === hour);

            return (
              <HourBar
                key={hour}
                hour={hour}
                blockId={block.id as TimeBlockId}
                tasks={hourTasks}
                isLocked={state?.isLocked || false}
                onCreateTask={async (text, targetHour) => {
                  if (onCreateTask) {
                    // 작업 생성 시 targetHour를 직접 전달 (race condition 방지)
                    await onCreateTask(text, block.id as TimeBlockId, targetHour);
                  }
                }}
                onEditTask={onEditTask}
                onUpdateTask={(taskId, updates) => {
                  if (onUpdateTask) {
                    onUpdateTask(taskId, updates);
                  }
                }}
                onDeleteTask={onDeleteTask}
                onToggleTask={handleTaskToggle}
                onDropTask={(taskId, targetHour) => {
                  // hourSlot 업데이트
                  if (onUpdateTask) {
                    onUpdateTask(taskId, { hourSlot: targetHour, timeBlock: block.id as TimeBlockId });
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

export default TimeBlock;
