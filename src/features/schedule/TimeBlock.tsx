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
 */
const TimeBlock = memo(function TimeBlock({
  block,
  tasks,
  state,
  isCurrentBlock,
  isPastBlock = false,
  onAddTask: _onAddTask,
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onToggleLock,
  onUpdateBlockState,
  onDropTask: _onDropTask,
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);

  // 통합 드래그 앤 드롭 훅 사용
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(
    block.id as TimeBlockId,
    undefined
  );

  // 3분 타이머 상태
  const [timerElapsed, setTimerElapsed] = useState(0);

  // 예상 최대 XP 계산
  const maxXP = tasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 블록 총 예상 시간 계산
  const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 완료된 시간 계산
  const completedDuration = tasks
    .filter(t => t.completed)
    .reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 미완료 작업의 시간 계산
  const pendingDuration = tasks
    .filter(t => !t.completed)
    .reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 현재 시간대의 남은 시간 계산
  const getTimeRemaining = () => {
    if (!isCurrentBlock) return null;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const blockEndMinutes = block.end * 60;
    const currentMinutes = currentHour * 60 + currentMinute;
    const remainingMinutes = blockEndMinutes - currentMinutes;

    if (remainingMinutes <= 0) return { hours: 0, minutes: 0, text: '0m' };

    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

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

  const getRemainingMinutes = () => {
    if (!timeRemaining) return 0;
    return timeRemaining.hours * 60 + timeRemaining.minutes;
  };

  const remainingMinutes = getRemainingMinutes();

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

  // 시간 상태 계산
  const getTimeStatus = (): 'comfortable' | 'balanced' | 'tight' | 'critical' => {
    if (pendingDuration === 0) return 'balanced';
    const ratio = remainingMinutes / pendingDuration;
    if (ratio >= 1.3) return 'comfortable';
    if (ratio >= 1.15) return 'balanced';
    if (ratio >= 0.9) return 'tight';
    return 'critical';
  };

  const timeStatus = getTimeStatus();

  // 프로그레스 바 계산
  const getProgressPercentage = (): number => {
    if (pendingDuration === 0) return 0;
    const percentage = (pendingDuration / remainingMinutes) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  };

  const progressPercentage = getProgressPercentage();

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

  const getStatusIcon = (): string => {
    const icons = {
      comfortable: '🟢',
      balanced: '🔵',
      tight: '🟠',
      critical: '🔴'
    };
    return icons[timeStatus];
  };

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
      const duration = (state.lockTimerDuration || 180000) / 1000;

      if (elapsed >= duration) {
        setTimerElapsed(duration);
        if (!state.isLocked && onToggleLock) {
          onToggleLock();
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

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [state?.lockTimerStartedAt, state?.lockTimerDuration, state?.isLocked, onToggleLock, block.id]);

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
          lockTimerDuration: 180000,
        });
      } catch (error) {
        console.error('Failed to start lock timer:', error);
      }
    }
  };

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

  const getTimerProgress = (): number => {
    if (!state?.lockTimerStartedAt) return 0;
    const duration = (state.lockTimerDuration || 180000) / 1000;
    return Math.min((timerElapsed / duration) * 100, 100);
  };

  const formatRemainingTime = (): string => {
    if (!state?.lockTimerStartedAt) return '3:00';
    const duration = (state.lockTimerDuration || 180000) / 1000;
    const remaining = Math.max(duration - timerElapsed, 0);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBlockContentClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleTaskToggle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.completed) {
      if (!state?.isLocked) {
        alert('⚠️ 블록을 먼저 잠궈야 작업을 완료할 수 있습니다!\n\n블록 잠금 버튼(⚠️)을 눌러주세요. (비용: 15 XP)');
        return;
      }
    }
    onToggleTask(taskId);
  };

  const handleDropWrapper = async (e: React.DragEvent) => {
    if (!onUpdateTask) return;
    await handleDrop(e, async (taskId, updates) => {
      onUpdateTask(taskId, updates);
    });
  };

  const statusStyles = {
    comfortable: {
      badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      fill: 'bg-emerald-500',
    },
    balanced: {
      badge: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      fill: 'bg-indigo-500',
    },
    tight: {
      badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      fill: 'bg-amber-500',
    },
    critical: {
      badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      fill: 'bg-rose-500',
    },
  };

  const statusStyle = statusStyles[timeStatus];
  const plannedWidth = remainingMinutes ? Math.min((pendingDuration / (remainingMinutes || 1)) * 100, 100) : 0;
  const completionPercentage = totalDuration > 0 ? (completedDuration / totalDuration) * 100 : 0;

  // Solid & Minimal Design Classes
  const blockClassName = [
    'relative flex min-h-[72px] flex-col overflow-hidden rounded-xl border transition-all duration-300',
    // Solid Background
    'bg-[var(--color-bg-surface)]',
    // Border & Accent
    isCurrentBlock
      ? 'border-[var(--color-primary)] border-l-4 shadow-md'
      : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]',
    // Past State
    isPastBlock ? 'opacity-60 grayscale-[0.5]' : '',
    // Drag State
    isDragOver ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg-base)]' : '',
  ].filter(Boolean).join(' ');

  const headerClassName = [
    'flex flex-col gap-4 cursor-pointer px-5 py-4 select-none lg:flex-row lg:items-start lg:justify-between transition-colors duration-200',
    // Flat Header Background
    isCurrentBlock ? 'bg-[var(--color-bg-elevated)]' : 'bg-transparent',
    isPastBlock ? 'py-3' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={blockClassName}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
    >
      <div className="relative z-10 flex flex-col">
        <div className={headerClassName} onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Time Label & Badges */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className={`text-xl font-bold tracking-tight ${isCurrentBlock ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                {block.start.toString().padStart(2, '0')}:00 - {block.end.toString().padStart(2, '0')}:00
              </span>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                {state?.isLocked ? (
                  <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-500">
                    🔒 잠김
                  </span>
                ) : (
                  <>
                    <span className="rounded-md bg-[var(--color-bg-elevated)] px-2 py-1 text-[var(--color-text-secondary)]">
                      📋 {tasks.length}
                    </span>
                    {maxXP > 0 && (
                      <span className="rounded-md bg-[var(--color-bg-elevated)] px-2 py-1 text-[var(--color-reward)]">
                        ✨ {maxXP} XP
                      </span>
                    )}
                    {!isPastBlock && !state?.lockTimerStartedAt && (
                      <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-500 animate-pulse">
                        ⚠️ 잠금 필요
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {!state?.isLocked && !isPastBlock && (
                state?.lockTimerStartedAt ? (
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] px-3 py-1.5">
                    <span className="text-xs font-mono text-[var(--color-primary)]">{formatRemainingTime()}</span>
                    <button
                      onClick={handleCancelLockTimer}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartLockTimer}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)] transition-colors"
                  >
                    ⏱️ 3분 타이머
                  </button>
                )
              )}

              {state?.isLocked && !isPastBlock && (
                <button
                  onClick={onToggleLock}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)] transition-colors"
                >
                  🔓 해제
                </button>
              )}
            </div>
          </div>

          {/* Status Panel (Current Block Only) */}
          {isCurrentBlock && timeRemaining && (
            <div className="mt-4 lg:mt-0 lg:ml-6 flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold ${statusStyle.badge.split(' ')[1]}`}>
                  {getStatusText()}
                </span>
                <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                  남은 시간: {formatMinutesToHM(remainingMinutes)}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-[var(--color-border)]"></div>
              <div className="w-24 flex flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                  <div
                    className={`h-full rounded-full ${statusStyle.fill}`}
                    style={{ width: `${plannedWidth}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-text-tertiary)] text-right">
                  계획 대비
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Completion Bar (Thin Line) */}
        <div className="h-[2px] w-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="flex flex-col gap-0 bg-[var(--color-bg-base)]/50" onClick={handleBlockContentClick}>
            {tasks.length === 0 && !isPastBlock && (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-tertiary)] border-b border-[var(--color-border)] border-dashed">
                <span className="text-2xl mb-2">📥</span>
                <p className="text-sm">작업을 이곳으로 드래그하거나 추가하세요</p>
              </div>
            )}

            {Array.from({ length: block.end - block.start }, (_, i) => block.start + i).map(hour => {
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
    </div>
  );
});

export default TimeBlock;
