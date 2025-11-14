/**
 * src/features/schedule/TimeBlock.tsx
 * 개별 시간 블록 컴포넌트
 */

import { useState } from 'react';
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
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
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
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
  onToggleLock,
  onDropTask,
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);
  const [isDragOver, setIsDragOver] = useState(false);

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
      className={`time-block ${isCurrentBlock ? 'current-block' : ''} ${isExpanded ? 'expanded' : 'collapsed'} ${isDragOver ? 'drag-over' : ''}`}
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
            <span className="block-time-range">{block.start.toString().padStart(2, '0')}-{block.end.toString().padStart(2, '0')}</span>
            <div className="block-stats-inline">
              <span className="stat-compact">📋 {tasks.length}</span>
              <span className="stat-compact">⏱️ {completedDuration}/{totalDuration}m</span>
              {maxXP > 0 && <span className="stat-compact">✨ ~{maxXP}XP</span>}
            </div>
          </div>
        </div>

        <div className="block-actions">
          {/* 잠금 아이콘 */}
          <button
            className="action-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock?.();
            }}
            title={state?.isLocked ? "잠금 해제" : "잠금"}
          >
            {state?.isLocked ? '🔒' : '🔓'}
          </button>

          {/* 할일 추가 버튼 */}
          <button
            className="action-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
            title="할 일 추가"
          >
            ➕
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
            {tasks.length === 0 ? (
              <div className="empty-message">할 일이 없습니다</div>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task.id)}
                  onToggle={() => onToggleTask(task.id)}
                  onUpdateTask={(updates) => onEditTask({ ...task, ...updates })}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
