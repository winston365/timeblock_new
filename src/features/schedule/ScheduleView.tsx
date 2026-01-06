/**
 * @file ScheduleView.tsx
 * @role 타임블록 메인 화면 (일정/태스크 전체 보기)
 * @input useDailyData에서 로드된 일일 데이터
 * @output 타임블록 목록, 작업 모달, 집중 모드 UI
 * @dependencies useDailyData, TimeBlock, TaskModal, FocusView
 */

import { useEffect, useState } from 'react';
import { getInboxTaskById } from '@/data/repositories/inboxRepository';
import { useDailyData } from '@/shared/hooks';
import { useGameState } from '@/shared/hooks/useGameState';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { createNewTask, createTaskFromPartial, isTaskPrepared, isNewlyPrepared } from '@/shared/utils/taskFactory';
import { TIME_BLOCKS, type Task, type TimeBlockId, type WarmupPresetItem } from '@/shared/types/domain';
import { SYSTEM_STATE_DEFAULTS } from '@/shared/constants/defaults';
import TaskModal from './TaskModal';
import TimeBlock from './TimeBlock';
import { FocusView } from './components/FocusView';
import { WarmupPresetModal } from './components/WarmupPresetModal';
import { useFocusModeStore } from './stores/focusModeStore';
import { useScheduleViewStore } from './stores/scheduleViewStore';
import { getVisibleBlocks, getCurrentBlock, type VisibilityMode } from './utils/timeBlockVisibility';
import { useScheduleSync } from './hooks/useScheduleSync';

const DEFAULT_WARMUP_PRESET: WarmupPresetItem[] = [
  { text: '책상 정리', baseDuration: 5, resistance: 'low' },
  { text: '메일함 비우기', baseDuration: 5, resistance: 'low' },
  { text: '물 마시기', baseDuration: 5, resistance: 'low' },
];

/**
 * 스케줄 뷰 메인 컴포넌트
 * 하루의 타임블록을 보여주고 작업 관리 기능을 제공합니다.
 *
 * @returns 스케줄 뷰 UI (타임블록 목록, 작업 모달, 집중 모드, 점화 오버레이 포함)
 */
export default function ScheduleView() {
  const {
    dailyData,
    loading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    toggleBlockLock,
    updateBlockState,
  } = useDailyData();
  const { updateQuestProgress } = useGameState();
  const { show: showWaifu } = useWaifuCompanionStore();
  const { isFocusMode, toggleFocusMode: _toggleFocusMode, setFocusMode } = useFocusModeStore();
  void _toggleFocusMode; // 추후 포커스 모드 토글 버튼에서 사용 예정
  const { 
    showPastBlocks, 
    isWarmupModalOpen, 
    closeWarmupModal 
  } = useScheduleViewStore();
  const { loadData: loadSettingsData } = useSettingsStore();

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);
  const {
    warmupPreset,
    handleWarmupAutoGenerateToggle,
    handleSaveWarmupPreset,
    handleApplyWarmupFromModal,
  } = useScheduleSync({
    currentHour,
    dailyData,
    defaultWarmupPreset: DEFAULT_WARMUP_PRESET,
    defaultWarmupAutoGenerateEnabled: SYSTEM_STATE_DEFAULTS.warmupAutoGenerateEnabled,
    addTask,
    updateTask,
    updateBlockState,
    closeWarmupModal,
  });

  // 현재 시각 동기화 (1분 간격)
  useEffect(() => {
    const updateTime = () => setCurrentHour(new Date().getHours());
    updateTime();
    const interval = setInterval(updateTime, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSettingsData().catch(console.error);
  }, [loadSettingsData]);

  const getCurrentBlockId = (): TimeBlockId => {
    const hour = currentHour;
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block ? (block.id as TimeBlockId) : null;
  };

  const currentBlockId = getCurrentBlockId();
  const sortTasks = (list: Task[]) =>
    [...list].sort((a, b) => {
      const orderA = a.order ?? new Date(a.createdAt).getTime();
      const orderB = b.order ?? new Date(b.createdAt).getTime();
      return orderA - orderB;
    });

  const currentBlockTasks = dailyData ? sortTasks(dailyData.tasks.filter(task => task.timeBlock === currentBlockId)) : [];

  // 표시 정책: 기본적으로 현재 블록만 표시.
  // showPastBlocks가 true면 과거+현재만 표시(미래는 항상 가림)
  const visibilityMode: VisibilityMode = showPastBlocks ? 'hide-future' : 'current-only';
  const blocksToRender = getVisibleBlocks(currentHour, visibilityMode);
  const currentBlock = getCurrentBlock(currentHour);


  // 현재 블록이 없으면 집중모드 해제
  useEffect(() => {
    if (!currentBlockId && isFocusMode) {
      setFocusMode(false);
    }
  }, [currentBlockId, isFocusMode, setFocusMode]);

  const handleAddTask = (blockId: TimeBlockId) => {
    setSelectedBlockId(blockId);
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleCreateTask = async (text: string, blockId: TimeBlockId, hourSlot?: number) => {
    try {
      const block = TIME_BLOCKS.find(b => b.id === blockId);
      const targetHour = hourSlot ?? (block ? block.start : undefined);

      const newTask = createNewTask(text, {
        baseDuration: 15,
        resistance: 'low',
        timeBlock: blockId,
        hourSlot: targetHour,
      });
      await addTask(newTask);
      showWaifu(`"${text.trim()}" 추가했어! 고마워~`);
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
        if (isNewlyPrepared(editingTask, taskData)) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      } else {
        const newTask = createTaskFromPartial(taskData, {
          timeBlock: selectedBlockId,
          baseDuration: 30,
        });
        await addTask(newTask);
        if (isTaskPrepared(taskData)) {
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
      alert(error instanceof Error ? error.message : '타임블록 잠금 변경에 실패했습니다.');
    }
  };

  /* 현재 사용되지 않음 - 추후 포커스 모드 토글 버튼에서 사용 예정
  const handleToggleFocusMode = () => {
    if (!currentBlockId) {
      alert('현재 진행 중인 타임블록이 있을 때만 켤 수 있어.');
      return;
    }
    toggleFocusMode();
  };
  */

  const handleDropTask = async (taskId: string, targetBlockId: TimeBlockId) => {
    if (!dailyData) return;
    try {
      let task = dailyData.tasks.find(t => t.id === taskId);
      if (!task) {
        task = await getInboxTaskById(taskId);
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
        const newTask = createTaskFromPartial(taskData, {
          timeBlock: selectedBlockId,
          baseDuration: 15,
        });
        await addTask(newTask);
        if (isTaskPrepared(newTask)) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save multiple tasks:', error);
      alert('작업 일괄 추가에 실패했습니다.');
    }
  };

  if (loading && !dailyData) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
          데이터를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (!dailyData) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
          데이터를 불러오지 못했습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 pb-24">
      {isFocusMode && currentBlockId ? (
        <FocusView
          currentBlockId={currentBlockId}
          tasks={currentBlockTasks}
          allDailyTasks={dailyData.tasks}
          isLocked={dailyData.timeBlockStates[currentBlockId]?.isLocked ?? false}
          onEditTask={handleEditTask}
          onUpdateTask={handleUpdateTask}
          onToggleTask={handleToggleTask}
          onToggleLock={() => handleToggleLock(currentBlockId)}
          onExitFocusMode={() => setFocusMode(false)}
          onCreateTask={handleCreateTask}
        />
      ) : (
        <div className="space-y-4">
          {blocksToRender.map((block, index) => {
            const blockTasks = sortTasks(dailyData.tasks.filter(task => task.timeBlock === block.id));
            const blockState = dailyData.timeBlockStates[block.id];
            const isCurrentBlock = block.id === currentBlockId;
            const isPastBlock = currentHour >= block.end;

            return (
              <div key={block.id} style={{ zIndex: blocksToRender.length - index, position: 'relative' }}>
                <TimeBlock
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
              </div>
            );
          })}
          {/* 현재 블록이 없는 시간대 (05:00 이전 또는 23:00 이후) - 빈 상태 표시 */}
          {blocksToRender.length === 0 && !currentBlock && (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              현재 진행 중인 타임블록이 없습니다.
            </p>
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
      {isWarmupModalOpen && (
        <WarmupPresetModal
          preset={warmupPreset}
          onClose={closeWarmupModal}
          onSave={handleSaveWarmupPreset}
          onApply={handleApplyWarmupFromModal}
          onAutoGenerateToggle={handleWarmupAutoGenerateToggle}
        />
      )}
    </div>
  );
}
