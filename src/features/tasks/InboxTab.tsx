/**
 * InboxTab
 *
 * @role 시간 블록에 배치되지 않은 작업들을 관리하는 인박스 탭 컴포넌트
 * @input 없음
 * @output 인박스 작업 목록, 추가/편집/삭제 버튼, 드래그앤드롭 영역을 포함한 UI
 * @external_dependencies
 *   - useDailyData: 일일 데이터 및 작업 관리 훅
 *   - TaskCard: 개별 작업 카드 컴포넌트
 *   - TaskModal: 작업 추가/편집 모달 컴포넌트
 *   - tasks.css: 스타일시트
 */

import { useState } from 'react';
import { useDailyData } from '@/shared/hooks';
import { useGameState } from '@/shared/hooks/useGameState';
import type { Task } from '@/shared/types/domain';
import TaskCard from '@/features/schedule/TaskCard';
import TaskModal from '@/features/schedule/TaskModal';
import './tasks.css';

/**
 * 인박스 탭 컴포넌트
 *
 * @returns {JSX.Element} 인박스 탭 UI
 * @sideEffects
 *   - 작업 추가/수정/삭제 시 Firebase 동기화
 *   - 드래그앤드롭으로 작업을 인박스로 이동 가능
 */
export default function InboxTab() {
  const { dailyData, loading, addTask, updateTask, deleteTask, toggleTaskCompletion } = useDailyData();
  const { updateQuestProgress } = useGameState();
  const inboxTasks = dailyData?.tasks.filter(task => !task.timeBlock) ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

        // 수정 후에도 준비된 작업인지 확인 (이전에 준비되지 않았다면 퀘스트 진행)
        const wasPrepared = !!(editingTask.preparation1 && editingTask.preparation2 && editingTask.preparation3);
        const isNowPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);

        if (!wasPrepared && isNowPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
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
          preparation1: taskData.preparation1 || '',
          preparation2: taskData.preparation2 || '',
          preparation3: taskData.preparation3 || '',
        };
        await addTask(newTask);

        // 준비된 작업이면 퀘스트 진행
        const isPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);
        if (isPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
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

  // 드래그 앤 드롭 핸들러 (시간대 블록 → 인박스)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    try {
      // 작업을 인박스로 이동 (timeBlock을 null로 설정)
      await updateTask(taskId, { timeBlock: null });
    } catch (error) {
      console.error('Failed to move task to inbox:', error);
      alert('작업 이동에 실패했습니다.');
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

      <div
        className={`tab-content ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
                onUpdateTask={async (updates) => {
                  await updateTask(task.id, updates);
                }}
                hideMetadata={true}
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
