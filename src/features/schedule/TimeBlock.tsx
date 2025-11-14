/**
 * src/features/schedule/TimeBlock.tsx
 * 개별 시간 블록 컴포넌트
 */

import { useState } from 'react';
import type { Task, TimeBlockState } from '@/shared/types/domain';
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
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);

  // 블록 총 XP 계산
  const totalXP = tasks
    .filter(t => t.completed)
    .reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 예상 최대 XP 계산
  const maxXP = tasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 블록 총 예상 시간 계산
  const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 완료된 시간 계산
  const completedDuration = tasks
    .filter(t => t.completed)
    .reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 현재 시간대의 남은 시간 계산 (시간 단위)
  const getTimeRemaining = () => {
    if (!isCurrentBlock) return null;
    const now = new Date();
    const currentHour = now.getHours();
    const remaining = block.end - currentHour;
    return remaining > 0 ? remaining : 0;
  };

  const timeRemaining = getTimeRemaining();

  // 빈 공간 클릭시 접기
  const handleBlockContentClick = (e: React.MouseEvent) => {
    // 태스크 카드나 버튼이 아닌 빈 공간 클릭시에만 토글
    if (e.target === e.currentTarget) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={`time-block ${isCurrentBlock ? 'current-block' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="block-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="block-title">
          {/* 원형 시간표 (현재 시간대 블록만) */}
          {isCurrentBlock && timeRemaining !== null && (
            <div className="time-circle">
              <span className="time-remaining">{timeRemaining}h</span>
            </div>
          )}

          <div className="block-time-info">
            <span className="block-time-range">{block.start.toString().padStart(2, '0')}-{block.end.toString().padStart(2, '0')}</span>
            <span className="block-duration-info">{completedDuration}/{totalDuration}분</span>
          </div>
        </div>

        <div className="block-meta">
          {/* Task 개수 배지 */}
          <span className="block-count-badge">{tasks.length}개</span>

          {/* 잠금 아이콘 */}
          <button
            className="lock-btn"
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
            className="add-task-icon-btn"
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
