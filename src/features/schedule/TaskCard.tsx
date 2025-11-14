/**
 * src/features/schedule/TaskCard.tsx
 * 작업 카드 컴포넌트
 */

import { useState } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { RESISTANCE_LABELS } from '@/shared/types/domain';
import { formatDuration, calculateTaskXP } from '@/shared/lib/utils';

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onUpdateTask?: (updates: Partial<Task>) => void;
  onDragStart?: (taskId: string) => void;
}

export default function TaskCard({ task, onEdit, onDelete, onToggle, onUpdateTask, onDragStart }: TaskCardProps) {
  const [showResistancePicker, setShowResistancePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // XP 계산
  const xp = calculateTaskXP(task);

  // 심리적부담감 변경
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

  // 소요시간 변경
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

  const durationOptions = [15, 30, 45, 60, 90, 120, 180];

  // 드래그 핸들러
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setIsDragging(true);
    if (onDragStart) {
      onDragStart(task.id);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`task-card ${task.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''}`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
            {/* 심리적부담감 - 클릭 가능 */}
            <div className="task-meta-item">
              <button
                className={`resistance-badge ${task.resistance} clickable`}
                onClick={() => setShowResistancePicker(!showResistancePicker)}
                title="클릭하여 변경"
              >
                {RESISTANCE_LABELS[task.resistance]}
              </button>

              {showResistancePicker && (
                <div className="picker-dropdown resistance-picker">
                  <button onClick={() => handleResistanceChange('low')}>🟢 쉬움</button>
                  <button onClick={() => handleResistanceChange('medium')}>🟡 보통</button>
                  <button onClick={() => handleResistanceChange('high')}>🔴 어려움</button>
                </div>
              )}
            </div>

            {/* 소요시간 - 클릭 가능 */}
            <div className="task-meta-item">
              <button
                className="duration-badge clickable"
                onClick={() => setShowDurationPicker(!showDurationPicker)}
                title="클릭하여 변경"
              >
                ⏱️ {formatDuration(task.adjustedDuration)}
              </button>

              {showDurationPicker && (
                <div className="picker-dropdown duration-picker">
                  {durationOptions.map(duration => (
                    <button key={duration} onClick={() => handleDurationChange(duration)}>
                      {duration}분
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* XP 범위 표시 */}
            <span className="xp-badge">~{xp} XP</span>
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
