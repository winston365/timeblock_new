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

import { useState, useRef, useEffect } from 'react';
import type { Task, TimeBlockState, TimeBlockId } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';
import TaskCard from './TaskCard';

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
export default function TimeBlock({
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
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

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
    if (ratio >= 1.1) return 'comfortable';      // 남은 시간 >= 계획 시간 × 1.1배
    if (ratio >= 0.9) return 'balanced';         // 남은 시간 = 계획 시간 × 0.9~1.1배
    if (ratio >= 0.75) return 'tight';           // 남은 시간 = 계획 시간 × 0.75~0.9배
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

  // SVG 원형 프로그레스 바 계산
  const radius = 32; // 원의 반지름 (28 -> 32, 72px SVG에 맞춤)
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

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

  // 인라인 입력 필드 포커스
  useEffect(() => {
    if (showInlineInput && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [showInlineInput]);

  // 인라인 입력 처리
  const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inlineInputValue.trim()) {
      e.preventDefault();

      if (onCreateTask) {
        try {
          await onCreateTask(inlineInputValue.trim(), block.id as TimeBlockId);
          setInlineInputValue('');
          // 입력 필드 유지하여 연속 입력 가능
        } catch (err) {
          console.error('Failed to create task:', err);
        }
      }
    } else if (e.key === 'Escape') {
      setShowInlineInput(false);
      setInlineInputValue('');
    }
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
          {/* 원형 시간표 (현재 시간대 블록만) */}
          {isCurrentBlock && timeRemaining && (
            <div className="time-circle-wrapper" data-tooltip={getTooltipText()}>
              {/* SVG 원형 프로그레스 바 */}
              <svg className="circular-progress" width="72" height="72">
                {/* 배경 링 */}
                <circle
                  className="progress-ring"
                  cx="36"
                  cy="36"
                  r={radius}
                />
                {/* 진행 링 */}
                <circle
                  className={`progress-ring-fill status-${timeStatus}`}
                  cx="36"
                  cy="36"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>

              {/* 중앙 시간 표시 */}
              <div
                className={`time-circle-compact status-${timeStatus}`}
                role="status"
                aria-live="polite"
                aria-label={`미완료 작업 시간 ${pendingDuration}분, 남은 시간 ${remainingMinutes}분`}
              >
                <span className="time-remaining">
                  <span className="planned-time">{formatMinutesToHM(pendingDuration)}</span>
                  <span className="time-divider">·</span>
                  <span className="remaining-time">{formatMinutesToHM(remainingMinutes)}</span>
                </span>
              </div>

              {/* 시간 구분 라벨 (계획/남은) */}
              <div className="time-type-labels">
                <span className="time-type-label planned">📋 계획</span>
                <span className="time-type-divider">|</span>
                <span className="time-type-label remaining">남은 ⏱️</span>
              </div>

              {/* 상태 배지 */}
              <div className={`time-status-badge status-${timeStatus}`}>
                <span className="status-icon">{getStatusIcon()}</span>
                <span className="status-text">{getStatusText()}</span>
              </div>
            </div>
          )}

          <div className="block-time-group">
            <span className="block-time-range-large">{block.start.toString().padStart(2, '0')}-{block.end.toString().padStart(2, '0')}</span>
            <div className="block-stats-inline">
              {state?.isLocked ? (
                <span className="stat-compact locked-bonus">✨ 40 XP 보너스 도전 중!</span>
              ) : (
                <>
                  <span className="stat-compact">📋 {tasks.length}</span>
                  <span className="stat-compact">⏱️ {completedDuration}/{totalDuration}m</span>
                  {maxXP > 0 && <span className="stat-compact">✨ ~{maxXP}XP</span>}
                  {!isPastBlock && <span className="stat-compact lock-warning">⚠️ 잠금 필요</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="block-actions">
          {/* 잠금 아이콘 */}
          <button
            className={`action-btn-sm ${!state?.isLocked && !isPastBlock ? 'lock-needed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isPastBlock) {
                onToggleLock?.();
              }
            }}
            disabled={isPastBlock}
            title={
              isPastBlock
                ? "지난 시간대는 잠금할 수 없습니다"
                : state?.isLocked
                ? "잠금 해제 (베팅한 15 XP는 돌려받지 못함)"
                : "⚠️ 잠금 필요! (비용: 15 XP / 완벽 달성 시: +40 XP)"
            }
          >
            {state?.isLocked ? '🔒' : isPastBlock ? '🔓' : '⚠️'}
          </button>
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
          <div className="task-list">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task.id)}
                onToggle={() => handleTaskToggle(task.id)}
                onUpdateTask={onUpdateTask ? (updates) => onUpdateTask(task.id, updates) : undefined}
              />
            ))}

            {/* 인라인 입력 필드 - 항상 표시 */}
            <div className="inline-task-input">
              <input
                ref={inlineInputRef}
                type="text"
                value={inlineInputValue}
                onChange={(e) => setInlineInputValue(e.target.value)}
                onKeyDown={handleInlineInputKeyDown}
                placeholder="할 일을 입력하고 Enter를 누르세요 (기본: 15분, 🟢 쉬움)"
                className="inline-input-field"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
