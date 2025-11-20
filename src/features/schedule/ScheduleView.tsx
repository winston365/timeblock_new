/**
 * ScheduleView
 *
 * @role 하루 타임블럭 메인 화면 (지금모드/전체보기 토글)
 */

import { useState, useEffect } from 'react';
import { useDailyData } from '@/shared/hooks';
import { useGameState } from '@/shared/hooks/useGameState';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useFocusModeStore } from './stores/focusModeStore';
import { generateId } from '@/shared/lib/utils';
import { db } from '@/data/db/dexieClient';
import TimeBlock from './TimeBlock';
import TaskModal from './TaskModal';
import { FocusView } from './components/FocusView';

export default function ScheduleView() {
  const { dailyData, loading, addTask, updateTask, deleteTask, toggleTaskCompletion, toggleBlockLock, updateBlockState } = useDailyData();
  const { updateQuestProgress } = useGameState();
  const { show: showWaifu } = useWaifuCompanionStore();
  const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusModeStore();
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [showPastBlocks, setShowPastBlocks] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);

  // 현재 시간 동기화 (1분 간격)
  useEffect(() => {
    const updateTime = () => setCurrentHour(new Date().getHours());
    updateTime();
    const interval = setInterval(updateTime, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getCurrentBlockId = (): TimeBlockId => {
    const hour = currentHour;
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block ? (block.id as TimeBlockId) : null;
  };
  const currentBlockId = getCurrentBlockId();
  const currentBlockTasks = dailyData?.tasks.filter(task => task.timeBlock === currentBlockId) ?? [];
  const pastBlocks = TIME_BLOCKS.filter(block => currentHour >= block.end);
  const blocksToRender = TIME_BLOCKS.filter(block => {
    const isPast = currentHour >= block.end;
    if (isPast && !showPastBlocks) return false;
    return true;
  });

  // 현재 타임블럭이 없으면 지금모드 자동 해제
  useEffect(() => {
    if (!currentBlockId && isFocusMode) {
      setFocusMode(false);
    }
  }, [currentBlockId, isFocusMode, setFocusMode]);

  // 지난 타임블럭 미완료 작업 인박스로 이동 + 실패 처리
  useEffect(() => {
    const movePastIncompleteTasks = async () => {
      if (!dailyData) return;
      const currentTime = new Date();
      const currentHourValue = currentTime.getHours();
      const pastBlocks = TIME_BLOCKS.filter(block => currentHourValue >= block.end);

      const tasksToMove: Task[] = [];
      for (const block of pastBlocks) {
        const incompleteTasks = dailyData.tasks.filter(task => task.timeBlock === block.id && !task.completed);
        const blockState = dailyData.timeBlockStates[block.id];

        if (blockState?.isLocked && incompleteTasks.length > 0 && !blockState.isFailed) {
          try {
            const { updateBlockState } = await import('@/data/repositories/dailyDataRepository');
            await updateBlockState(block.id, { isFailed: true });
          } catch (error) {
            console.error(`Failed to set isFailed for block ${block.id}:`, error);
          }
        }
        tasksToMove.push(...incompleteTasks);
      }

      for (const task of tasksToMove) {
        try {
          await updateTask(task.id, { timeBlock: null }, { skipBehaviorTracking: true });
        } catch (error) {
          console.error(`Failed to move task ${task.id} to inbox:`, error);
        }
      }
    };
    movePastIncompleteTasks();
  }, [currentHour, dailyData, updateTask]);

  // 누락된 타임블럭 상태 초기화
  useEffect(() => {
    if (!dailyData) return;
    const missingBlocks = TIME_BLOCKS.filter(block => !dailyData.timeBlockStates[block.id]);
    if (missingBlocks.length === 0) return;

    (async () => {
      for (const block of missingBlocks) {
        try {
          await updateBlockState(block.id, {
            isLocked: false,
            isPerfect: false,
            isFailed: false,
          });
        } catch (error) {
          console.error('Failed to initialize block state:', error);
        }
      }
    })();
  }, [dailyData, updateBlockState]);

  const handleAddTask = (blockId: TimeBlockId) => {
    setSelectedBlockId(blockId);
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleCreateTask = async (text: string, blockId: TimeBlockId, hourSlot?: number) => {
    try {
      const block = TIME_BLOCKS.find(b => b.id === blockId);
      const targetHour = hourSlot ?? (block ? block.start : undefined);

      const newTask: Task = {
        id: generateId('task'),
        text: text.trim(),
        memo: '',
        baseDuration: 15,
        resistance: 'low',
        adjustedDuration: 15,
        timeBlock: blockId,
        hourSlot: targetHour,
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await addTask(newTask);
      showWaifu(`"${text.trim()}" 추가됐어! 고마워.`);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setSelectedBlockId(task.timeBlock);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setSelectedBlockId(null);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
        const wasPrepared = !!(editingTask.preparation1 && editingTask.preparation2 && editingTask.preparation3);
        const isNowPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);
        if (!wasPrepared && isNowPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      } else {
        const block = TIME_BLOCKS.find(b => b.id === selectedBlockId);
        const firstHour = block ? block.start : undefined;

        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 30,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 30,
          timeBlock: selectedBlockId,
          hourSlot: firstHour,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          preparation1: taskData.preparation1 || '',
          preparation2: taskData.preparation2 || '',
          preparation3: taskData.preparation3 || '',
          goalId: taskData.goalId || null,
        };
        await addTask(newTask);
        const isPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);
        if (isPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('작업 저장에 실패했습니다.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const task = dailyData?.tasks.find(t => t.id === taskId);
      const taskName = task?.text || '작업';
      await deleteTask(taskId);
      showWaifu(`"${taskName}" 삭제 완료!`);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert(error instanceof Error ? error.message : '작업 삭제에 실패했습니다.');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      alert('작업 상태 변경에 실패했습니다.');
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
      alert(error instanceof Error ? error.message : '작업 수정에 실패했습니다.');
    }
  };

  const handleToggleLock = async (blockId: string) => {
    if (!dailyData) return;
    try {
      await toggleBlockLock(blockId);
    } catch (error) {
      console.error('Failed to toggle lock:', error);
      alert(error instanceof Error ? error.message : '타임블럭 잠금 변경에 실패했습니다.');
    }
  };

  const handleToggleFocusMode = () => {
    if (!currentBlockId) {
      alert('지금모드는 현재 타임블럭이 있을 때만 켤 수 있어요.');
      return;
    }
    toggleFocusMode();
  };

  const handleDropTask = async (taskId: string, targetBlockId: TimeBlockId) => {
    if (!dailyData) return;
    try {
      let task = dailyData.tasks.find((t) => t.id === taskId);
      if (!task) {
        task = await db.globalInbox.get(taskId);
      }
      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }
      if (task.timeBlock === targetBlockId) {
        return;
      }
      const block = TIME_BLOCKS.find(b => b.id === targetBlockId);
      if (!block) {
        console.error('Target block not found:', targetBlockId);
        return;
      }
      await updateTask(taskId, { timeBlock: targetBlockId, hourSlot: block.start });
    } catch (error) {
      console.error('Failed to move task:', error);
      alert('작업 이동에 실패했습니다.');
    }
  };

  const handleSaveMultipleTasks = async (tasks: Partial<Task>[]) => {
    if (!selectedBlockId) return;
    try {
      for (const taskData of tasks) {
        const block = TIME_BLOCKS.find(b => b.id === selectedBlockId);
        const firstHour = block ? block.start : undefined;
        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '새 작업',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 15,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 15,
          timeBlock: selectedBlockId,
          hourSlot: firstHour,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          preparation1: taskData.preparation1 || '',
          preparation2: taskData.preparation2 || '',
          preparation3: taskData.preparation3 || '',
          goalId: taskData.goalId || null,
        };
        await addTask(newTask);
        const isPrepared = !!(newTask.preparation1 && newTask.preparation2 && newTask.preparation3);
        if (isPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save multiple tasks:', error);
      alert('작업 묶음 추가에 실패했습니다.');
    }
  };

  if (loading && !dailyData) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
          데이터를 로딩 중입니다...
        </div>
      </div>
    );
  }

  if (!dailyData) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
          데이터를 불러오지 못했습니다
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 pb-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">오늘 타임블럭</h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">현재 타임블럭 기준으로 지금모드를 켜서 집중 뷰를 볼 수 있어요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <span>전체 {dailyData.tasks.length}개</span>
          <span>인박스 {dailyData.tasks.filter(t => t.timeBlock === null).length}개</span>
          <span>완료 {dailyData.tasks.filter(t => t.completed).length}개</span>
          <button
            type="button"
            onClick={handleToggleFocusMode}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${isFocusMode
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)]'
              }`}
          >
            <span className="text-lg">⚡</span>
            {isFocusMode ? '지금모드 종료' : '지금모드 보기'}
            <span className="text-[10px] text-[var(--color-text-tertiary)]">(현재 타임블럭)</span>
          </button>
          {pastBlocks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPastBlocks(prev => !prev)}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              {showPastBlocks ? '지난 블럭 숨기기' : `지난 블럭 보기 (${pastBlocks.length})`}
            </button>
          )}
        </div>
      </div>

      {isFocusMode && currentBlockId ? (
        <FocusView
          currentBlockId={currentBlockId}
          tasks={currentBlockTasks}
          onEditTask={handleEditTask}
          onToggleTask={handleToggleTask}
          onToggleLock={() => handleToggleLock(currentBlockId)}
        />
      ) : (
        <div className="space-y-4">
          {blocksToRender.map(block => {
            const blockTasks = dailyData.tasks.filter(task => task.timeBlock === block.id);
            const blockState = dailyData.timeBlockStates[block.id];
            const isCurrentBlock = block.id === currentBlockId;
            const isPastBlock = currentHour >= block.end;

            return (
              <TimeBlock
                key={block.id}
                block={block}
                tasks={blockTasks}
                state={blockState}
                isCurrentBlock={isCurrentBlock}
                isPastBlock={isPastBlock}
                onAddTask={() => handleAddTask(block.id as TimeBlockId)}
                onCreateTask={handleCreateTask}
                onEditTask={handleEditTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onToggleTask={handleToggleTask}
                onToggleLock={() => handleToggleLock(block.id)}
                onUpdateBlockState={updateBlockState}
                onDropTask={handleDropTask}
              />
            );
          })}
          {!showPastBlocks && pastBlocks.length > 0 && (
            <div className="text-center text-xs text-[var(--color-text-tertiary)]">
              지난 블럭은 숨김 처리됨 ·{' '}
              <button
                type="button"
                className="underline underline-offset-4 text-[var(--color-primary)]"
                onClick={() => setShowPastBlocks(true)}
              >
                지난 블럭 보기
              </button>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          initialBlockId={selectedBlockId}
          onSave={handleSaveTask}
          onSaveMultiple={handleSaveMultipleTasks}
          onClose={handleCloseModal}
          source="schedule"
        />
      )}
    </div>
  );
}
