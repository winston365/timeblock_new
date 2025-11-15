/**
 * src/features/schedule/TimeBlock.tsx
 * 개별 시간 블록 컴포넌트
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

export default function TimeBlock({
  block,
  tasks,
  state,
  isCurrentBlock,
  isPastBlock = false,
  onAddTask,
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

  // 블록 총 예상 시간 계산
  const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 완료된 시간 계산
  const completedDuration = tasks
    .filter(t => t.completed)
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
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // onCreateTask가 있으면 인라인 입력 사용, 없으면 기존 모달 방식
    if (onCreateTask) {
      setShowInlineInput(true);
      if (!isExpanded) {
        setIsExpanded(true);
      }
    } else {
      onAddTask();
    }
  };

  // 빈 공간 클릭시 접기
  const handleBlockContentClick = (e: React.MouseEvent) => {
    // 태스크 카드나 버튼이 아닌 빈 공간 클릭시에만 토글
    if (e.target === e.currentTarget) {
      setIsExpanded(!isExpanded);
    }
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
            <div className="time-circle-compact">
              <span className="time-remaining">{timeRemaining.text}</span>
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
                onToggle={() => onToggleTask(task.id)}
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
                placeholder="할 일을 입력하고 Enter를 누르세요 (기본: 30분, 🟢 쉬움)"
                className="inline-input-field"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
