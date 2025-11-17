/**
 * HourBar - 1시간 단위 시간대 바
 *
 * @role 타임블록 내부의 1시간 단위 시간대 관리 (50분 몰입 + 10분 휴식)
 * @input hour, tasks, onAddTask, onEditTask, onUpdateTask, onDeleteTask, onToggleTask, onDropTask
 * @output 시간대 프로그레스 바 + 작업 리스트 + 할일 추가
 */

import { useState, useEffect } from 'react';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import TaskCard from './TaskCard';

interface HourBarProps {
  hour: number; // 시간 (예: 5, 6, 7)
  blockId: TimeBlockId; // 속한 타임블록 ID (향후 사용 예정)
  tasks: Task[]; // 해당 시간대의 작업들
  isLocked: boolean; // 블록 잠금 여부
  onAddTask: (hour: number) => void;
  onEditTask: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDropTask: (taskId: string, targetHour: number) => void;
}

/**
 * 1시간 단위 시간대 바 컴포넌트
 */
export default function HourBar({
  hour,
  blockId: _blockId, // 향후 사용 예정
  tasks,
  isLocked,
  onAddTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onDropTask,
}: HourBarProps) {
  const [progress, setProgress] = useState(0); // 0-100% (50분 기준)
  const [isDragOver, setIsDragOver] = useState(false);

  // 실시간 프로그레스 계산 (50분 몰입 시간 기준)
  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // 현재 시간대가 이 hour와 일치하는지 확인
      if (currentHour === hour) {
        // 50분 기준 (0-50분)
        const focusProgress = Math.min((currentMinute / 50) * 100, 100);
        setProgress(focusProgress);
      } else if (currentHour > hour) {
        // 지난 시간대는 100%
        setProgress(100);
      } else {
        // 미래 시간대는 0%
        setProgress(0);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000); // 1초마다 업데이트

    return () => clearInterval(interval);
  }, [hour]);

  // 시간 포맷팅 (예: "05:00-06:00")
  const formatHourRange = () => {
    const startHour = hour.toString().padStart(2, '0');
    const endHour = (hour + 1).toString().padStart(2, '0');
    return `${startHour}:00-${endHour}:00`;
  };

  // 현재 진행 시간 표시 (예: "25/50분")
  const getProgressText = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentHour === hour) {
      const elapsed = Math.min(currentMinute, 50);
      return `${elapsed}/50분`;
    } else if (currentHour > hour) {
      return '완료';
    } else {
      return '대기중';
    }
  };

  // 드래그 오버 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onDropTask(taskId, hour);
    }
  };

  return (
    <div
      className={`hour-bar ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-hour={hour}
    >
      {/* 시간대 헤더 + 프로그레스 바 */}
      <div className="hour-bar-header">
        <div className="hour-time-label">{formatHourRange()}</div>
        <div className="hour-progress-text">{getProgressText()}</div>
      </div>

      {/* 프로그레스 바 (50분 몰입 + 10분 휴식) */}
      <div className="hour-progress-bar">
        {/* 몰입 시간 (0-50분) */}
        <div className="hour-progress-focus" style={{ width: '83.33%' }}>
          <div
            className="hour-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* 휴식 시간 (50-60분) */}
        <div className="hour-progress-rest" style={{ width: '16.67%' }} />
      </div>

      {/* 작업 리스트 */}
      <div className="hour-tasks">
        {tasks.length === 0 ? (
          <div className="hour-empty-message">작업 없음</div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task)}
              onUpdateTask={(updates: Partial<Task>) => onUpdateTask(task.id, updates)}
              onDelete={() => onDeleteTask(task.id)}
              onToggle={() => onToggleTask(task.id)}
              blockIsLocked={isLocked}
            />
          ))
        )}
      </div>

      {/* 할일 추가 버튼 */}
      {!isLocked && (
        <button
          className="hour-add-task-btn"
          onClick={() => onAddTask(hour)}
        >
          + 할일 추가
        </button>
      )}
    </div>
  );
}
