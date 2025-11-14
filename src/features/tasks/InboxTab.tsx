/**
 * src/features/tasks/InboxTab.tsx
 * 인박스 탭 - 블록에 배치되지 않은 작업 목록
 */

import { useState } from 'react';
import { useInboxTasks, useDailyData } from '@/shared/hooks';
import type { Task } from '@/shared/types/domain';
import TaskCard from '@/features/schedule/TaskCard';
import TaskModal from '@/features/schedule/TaskModal';
import './tasks.css';

export default function InboxTab() {
  const { inboxTasks, loading } = useInboxTasks();
  const { addTask, updateTask, deleteTask, toggleTaskCompletion } = useDailyData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
      } else {
        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: taskData.text || '',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 30,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 30,
          timeBlock: null, // 인박스는 항상 null
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
        await addTask(newTask);
      }
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('작업 저장에 실패했습니다.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('작업 삭제에 실패했습니다.');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  if (loading) {
    return <div className="tab-loading">로딩 중...</div>;
  }

  return (
    <div className="inbox-tab">
      <div className="tab-header">
        <h3>📥 인박스</h3>
        <button className="add-btn" onClick={handleAddTask}>
          ➕ 추가
        </button>
      </div>

      <div className="tab-content">
        {inboxTasks.length === 0 ? (
          <div className="empty-state">
            <p>📭 인박스가 비어있습니다</p>
            <p className="empty-hint">할 일을 추가하거나 블록에서 이동하세요</p>
          </div>
        ) : (
          <div className="task-list-vertical">
            {inboxTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => handleEditTask(task)}
                onDelete={() => handleDeleteTask(task.id)}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          initialBlockId={null}
          onSave={handleSaveTask}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
