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
  onCreateTask?: (text: string, blockId: TimeBlockId) => Promise<void>;
  onEditTask: (task: Task) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onToggleLock?: () => void;
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
  onDropTask,
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);
  const [isDragOver, setIsDragOver] = useState(false);

  // 5분 타이머 상태
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
      const duration = (state.lockTimerDuration || 300000) / 1000; // 기본 5분

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

    try {
      const { updateBlockState } = await import('@/data/repositories/dailyDataRepository');
      await updateBlockState(block.id, {
        lockTimerStartedAt: Date.now(),
        lockTimerDuration: 300000, // 5분
      });
    } catch (error) {
      console.error('Failed to start lock timer:', error);
    }
  };

  // 타이머 취소 핸들러
  const handleCancelLockTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const { updateBlockState } = await import('@/data/repositories/dailyDataRepository');
      await updateBlockState(block.id, {
        lockTimerStartedAt: null,
        lockTimerDuration: undefined,
      });
    } catch (error) {
      console.error('Failed to cancel lock timer:', error);
    }
  };

  // 타이머 진행률 계산
  const getTimerProgress = (): number => {
    if (!state?.lockTimerStartedAt) return 0;
    const duration = (state.lockTimerDuration || 300000) / 1000;
    return Math.min((timerElapsed / duration) * 100, 100);
  };

  // 남은 시간 포맷팅 (MM:SS)
  const formatRemainingTime = (): string => {
    if (!state?.lockTimerStartedAt) return '5:00';
    const duration = (state.lockTimerDuration || 300000) / 1000;
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

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onDropTask) {
      onDropTask(taskId, block.id as TimeBlockId);
    }
  };

  return (
    <div
      className={`time-block ${isCurrentBlock ? 'current-block' : ''} ${isPastBlock ? 'past-block' : ''} ${isExpanded ? 'expanded' : 'collapsed'} ${isDragOver ? 'drag-over' : ''}`}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="block-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="block-primary-info">
          {/* 왼쪽: 잠금 버튼 / 타이머 버튼 */}
          <div className="block-lock-section">
            {state?.isLocked ? (
              // 잠긴 상태
              <button
                className="lock-icon-btn locked"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPastBlock) {
                    onToggleLock?.();
                  }
                }}
                disabled={isPastBlock}
                title={isPastBlock ? "지난 시간대는 잠금 해제할 수 없습니다" : "잠금 해제 (베팅한 15 XP는 돌려받지 못함)"}
              >
                🔒
              </button>
            ) : state?.lockTimerStartedAt ? (
              // 타이머 진행 중
              <div className="lock-timer-active">
                <button
                  className="lock-timer-cancel"
                  onClick={handleCancelLockTimer}
                  title="타이머 취소"
                >
                  ❌
                </button>
                <div className="lock-timer-display">
                  <span className="timer-icon">⏰</span>
                  <span className="timer-text">{formatRemainingTime()}</span>
                  <div className="timer-progress-bar">
                    <div
                      className="timer-progress-fill"
                      style={{ width: `${getTimerProgress()}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : isPastBlock ? (
              // 지난 블록
              <button className="lock-icon-btn past" disabled title="지난 시간대는 잠금할 수 없습니다">
                🔓
              </button>
            ) : (
              // 타이머 시작 버튼
              <button
                className="lock-timer-start-btn"
                onClick={handleStartLockTimer}
                title="5분 후 자동 잠금 시작 (비용: 15 XP / 완벽 달성 시: +40 XP)"
              >
                <span className="timer-start-icon">⏰</span>
                <span className="timer-start-text">5분 뒤 잠금</span>
              </button>
            )}
          </div>

          <div className="block-time-group">
            <span className="block-time-range-large">{block.start.toString().padStart(2, '0')}-{block.end.toString().padStart(2, '0')}</span>
            <div className="block-stats-inline">
              {state?.isLocked ? (
                // 잠긴 블록: 과거 블록이면서 미완료 작업이 있으면 "계획 실패"
                isPastBlock && tasks.some(t => !t.completed) ? (
                  <span className="stat-compact failed-plan">❌ 계획 실패</span>
                ) : (
                  <span className="stat-compact locked-bonus">✨ 40 XP 보너스 도전 중!</span>
                )
              ) : (
                <>
                  <span className="stat-compact">📋 {tasks.length}</span>
                  {maxXP > 0 && <span className="stat-compact">✨ ~{maxXP}XP</span>}
                  {!isPastBlock && !state?.lockTimerStartedAt && <span className="stat-compact lock-warning">⚠️ 잠금 필요</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="block-actions">
          {/* 오른쪽: 시간 표시 (현재 시간대 블록만) */}
          {isCurrentBlock && timeRemaining && (
            <div className="time-bar-wrapper" data-tooltip={getTooltipText()}>
              <div className="time-bar-container">
                {/* 상태 아이콘 */}
                <div className={`status-icon-large status-${timeStatus}`}>
                  {getStatusIcon()}
                </div>

                {/* 시간 정보와 바 */}
                <div className="time-info-bars">
                  {/* 계획 시간 바 */}
                  <div className="time-bar-row">
                    <span className="time-label">📋 계획</span>
                    <div className="time-bar-track">
                      <div
                        className={`time-bar-fill planned status-${timeStatus}`}
                        style={{ width: `${Math.min((pendingDuration / (remainingMinutes || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="time-value">{formatMinutesToHM(pendingDuration)}</span>
                  </div>

                  {/* 남은 시간 바 */}
                  <div className="time-bar-row">
                    <span className="time-label">⏱️ 남은</span>
                    <div className="time-bar-track">
                      <div
                        className={`time-bar-fill remaining status-${timeStatus}`}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <span className="time-value">{formatMinutesToHM(remainingMinutes)}</span>
                  </div>
                </div>

                {/* 상태 텍스트 */}
                <div className={`status-text-badge status-${timeStatus}`}>
                  {getStatusText()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {state?.isPerfect && (
        <div className="block-badge perfect">✨ 완벽한 계획!</div>
      )}
      {state?.isFailed && (
        <div className="block-badge failed">❌ 계획 실패</div>
      )}

      <div className="block-progress">
        <div
          className="block-progress-bar"
          style={{
            width: totalDuration > 0 ? `${(completedDuration / totalDuration) * 100}%` : '0%',
          }}
        />
      </div>

      {isExpanded && (
        <div className="block-content" onClick={handleBlockContentClick}>
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
                    // 작업 생성 (blockId로)
                    await onCreateTask(text, block.id as TimeBlockId);

                    // 생성된 작업의 hourSlot 업데이트
                    // Note: onCreateTask에서 이미 hourSlot을 block.start로 설정하지만,
                    // 특정 hour에 추가하려면 여기서 업데이트 필요
                    if (targetHour !== block.start && onUpdateTask) {
                      // 방금 생성된 작업 찾기 (가장 최근 작업)
                      const latestTask = tasks
                        .filter(t => t.timeBlock === block.id)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                      if (latestTask) {
                        onUpdateTask(latestTask.id, { hourSlot: targetHour });
                      }
                    }
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
