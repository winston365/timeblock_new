/**
 * InboxTab
 *
 * @role 시간 블록에 배치되지 않은 작업들을 관리하는 인박스 탭 컴포넌트
 * @input 없음
 * @output 인박스 작업 목록, 추가/편집/삭제 버튼, 드래그앤드롭 영역을 포함한 UI
 * @external_dependencies
 *   - useDailyData: 일일 데이터 및 작업 관리 훅
 *   - TaskCard: 개별 작업 카드 컴포넌트 (Tailwind)
 *   - TaskModal: 작업 추가/편집 모달 컴포넌트
 */

import { useState, useEffect } from 'react';
import { useGameState } from '@/shared/hooks/useGameState';
import { useDailyData } from '@/shared/hooks/useDailyData';
import {
  loadInboxTasks,
  addInboxTask,
  updateInboxTask,
  deleteInboxTask,
} from '@/data/repositories/inboxRepository';
import type { Task } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';
import TaskCard from '@/features/schedule/TaskCard';
import TaskModal from '@/features/schedule/TaskModal';
import { useDragDropManager } from '@/features/schedule/hooks/useDragDropManager';

/**
 * 인박스 탭 컴포넌트
 *
 * @returns {JSX.Element} 인박스 탭 UI
 * @sideEffects
 *   - 작업 추가/수정/삭제 시 Firebase 동기화
 *   - 드래그앤드롭으로 작업을 인박스로 이동 가능
 */
export default function InboxTab() {
  const { updateQuestProgress } = useGameState();
  const { toggleTaskCompletion } = useDailyData();
  const { getDragData } = useDragDropManager();
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 전역 인박스 작업 로드 (미완료만)
  const refreshInboxTasks = async () => {
    try {
      setLoading(true);
      const tasks = await loadInboxTasks();
      // 미완료 작업만 필터링
      const uncompletedTasks = tasks.filter(task => !task.completed);
      setInboxTasks(uncompletedTasks);
    } catch (error) {
      console.error('Failed to load inbox tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshInboxTasks();
  }, []);

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
        await updateInboxTask(editingTask.id, taskData);

        // 수정 후에도 준비된 작업인지 확인 (이전에 준비되지 않았다면 퀘스트 진행)
        const wasPrepared = !!(editingTask.preparation1 && editingTask.preparation2 && editingTask.preparation3);
        const isNowPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);

        if (!wasPrepared && isNowPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      } else {
        const newTask: Task = {
          id: generateId('task'),
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
        await addInboxTask(newTask);

        // 준비된 작업이면 퀘스트 진행
        const isPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);
        if (isPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }

      await refreshInboxTasks(); // 목록 새로고침
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('작업 저장에 실패했습니다.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteInboxTask(taskId);
      await refreshInboxTasks(); // 목록 새로고침
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('작업 삭제에 실패했습니다.');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
      await refreshInboxTasks(); // 목록 새로고침
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

    // Phase 2 통합 드래그 시스템 사용 (JSON 파싱)
    const dragData = getDragData(e);
    if (!dragData) {
      console.warn('No drag data found in drop event');
      return;
    }

    try {
      // 작업을 인박스로 이동 (timeBlock: null, hourSlot: undefined)
      // updateTask가 자동으로 timeBlock → inbox 이동 처리 + refresh
      const { updateTask } = await import('@/data/repositories/dailyDataRepository');
      await updateTask(dragData.taskId, {
        timeBlock: null,
        hourSlot: undefined
      });

      // ✅ 인박스 새로고침 (인박스 뷰 업데이트용)
      await refreshInboxTasks();
    } catch (error) {
      console.error('Failed to move task to inbox:', error);
      alert('작업을 인박스로 이동하는데 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-6 text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  const tabContentClass = [
    'flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 transition-all',
    isDragOver
      ? 'bg-[var(--color-primary)]/5 ring-2 ring-inset ring-[var(--color-primary)]/50'
      : '',
  ].join(' ');

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-base)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[var(--color-text)]">📥 인박스</h3>
          <span className="rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
            {inboxTasks.length}
          </span>
        </div>
        <button
          className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-md active:scale-95"
          onClick={handleAddTask}
        >
          <span>+</span>
          <span>추가</span>
        </button>
      </div>

      {/* 리스트 영역 */}
      <div
        className={tabContentClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {inboxTasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-2xl">
              📭
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">인박스가 비어있습니다</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                할 일을 추가하거나<br />시간표에서 드래그하여 보관하세요
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {inboxTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => handleEditTask(task)}
                onDelete={() => handleDeleteTask(task.id)}
                onToggle={() => handleToggleTask(task.id)}
                onUpdateTask={async (updates) => {
                  await updateInboxTask(task.id, updates);
                  await refreshInboxTasks();
                }}
                onDragEnd={async () => {
                  setTimeout(() => refreshInboxTasks(), 500);
                }}
                hideMetadata
                compact
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
