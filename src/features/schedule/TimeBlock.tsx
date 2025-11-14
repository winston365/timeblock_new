/**
 * src/features/schedule/TimeBlock.tsx
 * 개별 시간 블록 컴포넌트
 */

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
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
}

export default function TimeBlock({
  block,
  tasks,
  state,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: TimeBlockProps) {
  // 블록 총 XP 계산
  const totalXP = tasks
    .filter(t => t.completed)
    .reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 블록 총 예상 시간 계산
  const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 완료된 시간 계산
  const completedDuration = tasks
    .filter(t => t.completed)
    .reduce((sum, task) => sum + task.adjustedDuration, 0);

  return (
    <div className="time-block">
      <div className="block-header">
        <div className="block-title">
          <span className="block-time">{block.label}</span>
          <span className="block-duration">{totalDuration}분</span>
        </div>

        <div className="block-meta">
          {totalXP > 0 && <span className="block-xp">+{totalXP} XP</span>}
          <span className="block-count">{tasks.length}개</span>
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

      <div className="block-content">
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
              />
            ))
          )}
        </div>

        <button className="add-task-btn" onClick={onAddTask}>
          ➕ 할 일 추가
        </button>
      </div>
    </div>
  );
}
