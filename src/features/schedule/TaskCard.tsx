/**
 * src/features/schedule/TaskCard.tsx
 * 작업 카드 컴포넌트
 */

import type { Task } from '@/shared/types/domain';
import { RESISTANCE_LABELS } from '@/shared/types/domain';
import { formatDuration } from '@/shared/lib/utils';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

export default function TaskCard({ task, onEdit, onDelete, onToggle }: TaskCardProps) {
  return (
    <div className={`task-card ${task.completed ? 'completed' : ''}`}>
      <div className="task-main">
        <button
          className="task-checkbox"
          onClick={onToggle}
          aria-label={task.completed ? '완료 취소' : '완료'}
        >
          {task.completed ? '✅' : '⬜'}
        </button>

        <div className="task-details">
          <div className="task-text">{task.text}</div>

          <div className="task-meta">
            <span className={`resistance-badge ${task.resistance}`}>
              {RESISTANCE_LABELS[task.resistance]}
            </span>
            <span className="duration-badge">
              ⏱️ {formatDuration(task.adjustedDuration)}
            </span>
          </div>

          {task.memo && (
            <div className="task-memo">📝 {task.memo}</div>
          )}
        </div>

        <div className="task-actions">
          <button
            className="task-action-btn edit-btn"
            onClick={onEdit}
            title="수정"
          >
            ✏️
          </button>
          <button
            className="task-action-btn delete-btn"
            onClick={onDelete}
            title="삭제"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
