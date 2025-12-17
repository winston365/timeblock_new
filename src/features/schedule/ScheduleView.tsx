/**
 * @file ScheduleView.tsx
 * @role 타임블록 메인 화면 (일정/태스크 전체 보기)
 * @input useDailyData에서 로드된 일일 데이터
 * @output 타임블록 목록, 작업 모달, 집중 모드 UI
 * @dependencies useDailyData, TimeBlock, TaskModal, FocusView
 */

import { useEffect, useRef, useState } from 'react';
import { getSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { useDailyData } from '@/shared/hooks';
import { useGameState } from '@/shared/hooks/useGameState';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { createNewTask, createTaskFromPartial, isTaskPrepared, isNewlyPrepared } from '@/shared/utils/taskFactory';
import type { Task, TimeBlockId, WarmupPresetItem } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { SYSTEM_STATE_DEFAULTS } from '@/shared/constants/defaults';
import TaskModal from './TaskModal';
import TimeBlock from './TimeBlock';
import { FocusView } from './components/FocusView';
import { WarmupPresetModal } from './components/WarmupPresetModal';
import { useFocusModeStore } from './stores/focusModeStore';
import { useScheduleViewStore } from './stores/scheduleViewStore';
import { fetchFromFirebase, syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { warmupPresetStrategy } from '@/shared/services/sync/firebase/strategies';
import { getVisibleBlocks, getCurrentBlock, type VisibilityMode } from './utils/timeBlockVisibility';

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
    setHourSlotTag,
  } = useDailyData();
  const { updateQuestProgress } = useGameState();
  const { show: showWaifu } = useWaifuCompanionStore();
  const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusModeStore();
  const { 
    showPastBlocks, 
    isWarmupModalOpen, 
    closeWarmupModal 
  } = useScheduleViewStore();
  const { settings, loadData: loadSettingsData } = useSettingsStore();

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);
  const [warmupPreset, setWarmupPreset] = useState<WarmupPresetItem[]>(DEFAULT_WARMUP_PRESET);
  /** 워밍업 자동생성 활성화 여부 (Dexie systemState에서 로드) */
  const [warmupAutoGenerateEnabled, setWarmupAutoGenerateEnabled] = useState<boolean>(
    SYSTEM_STATE_DEFAULTS.warmupAutoGenerateEnabled
  );

  const autoInsertedRef = useRef<Set<string>>(new Set());
  const lastAutoCheckRef = useRef<string | null>(null);

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

  // 워밍업 프리셋 로드 (Firebase)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const remotePreset = await fetchFromFirebase(warmupPresetStrategy);
      if (mounted && remotePreset && Array.isArray(remotePreset) && remotePreset.length > 0) {
        setWarmupPreset(remotePreset);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 워밍업 자동생성 플래그 로드 (Dexie systemState)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storedValue = await getSystemState<boolean>(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED);
        if (mounted && storedValue !== undefined) {
          setWarmupAutoGenerateEnabled(storedValue);
        }
      } catch (error) {
        console.error('Failed to load warmup auto-generate setting:', error);
        // 실패 시 기본값 유지
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 매 시간 50분에 자동 체크 후 다음 시간대(같은 블록이든 다음 블록이든)에 삽입 (22:50~03:50 제외)
  useEffect(() => {
    const interval = setInterval(() => {
      // 워밍업 자동생성이 비활성화되어 있으면 early-return
      if (!warmupAutoGenerateEnabled) return;
      if (!dailyData) return;
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      if (minute !== 50) return;
      if ([22, 23, 0, 1, 2, 3].includes(hour)) return;

      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;
      if (lastAutoCheckRef.current === key) return;
      lastAutoCheckRef.current = key;

      const currentBlock = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
      if (!currentBlock) return;

      const currentBlockTasks = dailyData.tasks.filter(t => t.timeBlock === currentBlock.id);
      const completedCount = currentBlockTasks.filter(t => t.completed).length;
      if (completedCount > 0) return;

      // 대상 시간대: 현재 시간 +1 시간이 동일 블록 안에 있으면 그대로, 아니면 다음 블록 시작 시간
      const targetHour = hour + 1;
      let targetBlock = TIME_BLOCKS.find(b => targetHour >= b.start && targetHour < b.end);
      let targetHourInBlock = targetHour;

      if (!targetBlock) {
        const nextIndex = TIME_BLOCKS.findIndex(b => b.id === currentBlock.id) + 1;
        if (nextIndex >= TIME_BLOCKS.length) return;
        targetBlock = TIME_BLOCKS[nextIndex];
        targetHourInBlock = targetBlock.start;
      }

      const targetKey = `${targetBlock.id}-${targetHourInBlock}`;
      if (autoInsertedRef.current.has(targetKey)) return;

      const targetTasks = dailyData.tasks.filter(
        t => t.timeBlock === targetBlock!.id && t.hourSlot === targetHourInBlock
      );
      if (targetTasks.length > 2) return;

      insertWarmupTasks(targetBlock.id as TimeBlockId, targetHourInBlock);
      autoInsertedRef.current.add(targetKey);
    }, 30 * 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyData, warmupPreset, warmupAutoGenerateEnabled]);

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

  const hourSlotTags = dailyData?.hourSlotTags || {};
  const tagTemplates = settings?.timeSlotTags || [];
  const recentTagIds = Array.from(
    new Set(
      Object.values(hourSlotTags || {})
        .filter((id): id is string => Boolean(id))
        .reverse()
    )
  ).slice(0, 3);

  // 현재 블록이 없으면 집중모드 해제
  useEffect(() => {
    if (!currentBlockId && isFocusMode) {
      setFocusMode(false);
    }
  }, [currentBlockId, isFocusMode, setFocusMode]);

  // 지난 타임블록의 미완료 작업을 인박스로 이동 + 상태 처리
  useEffect(() => {
    const movePastIncompleteTasks = async () => {
      if (!dailyData) return;
      const currentTime = new Date();
      const currentHourValue = currentTime.getHours();
      const pastBlocksList = TIME_BLOCKS.filter(block => currentHourValue >= block.end);

      const tasksToMove: Task[] = [];
      for (const block of pastBlocksList) {
        const incompleteTasks = dailyData.tasks.filter(task => task.timeBlock === block.id && !task.completed);
        const blockState = dailyData.timeBlockStates[block.id];

        if (blockState?.isLocked && incompleteTasks.length > 0 && !blockState.isFailed) {
          try {
            const { updateBlockState: repoUpdateBlockState } =
              await import('@/data/repositories/dailyDataRepository');
            await repoUpdateBlockState(block.id, { isFailed: true });
          } catch (error) {
            console.error(`Failed to set isFailed for block ${block.id}:`, error);
          }
        }
        tasksToMove.push(...incompleteTasks);
      }

      for (const task of tasksToMove) {
        try {
          await updateTask(task.id, { timeBlock: null }, { skipBehaviorTracking: true, ignoreLock: true });
        } catch (error) {
          console.error(`Failed to move task ${task.id} to inbox:`, error);
        }
      }
    };
    movePastIncompleteTasks();
  }, [currentHour, dailyData, updateTask]);

  // 타임블록 상태 초기화
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

  const handleSelectHourTag = async (hour: number, tagId: string | null) => {
    try {
      await setHourSlotTag(hour, tagId);
    } catch (error) {
      console.error('Failed to update hour tag:', error);
    }
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleToggleFocusMode = () => {
    if (!currentBlockId) {
      alert('현재 진행 중인 타임블록이 있을 때만 켤 수 있어.');
      return;
    }
    toggleFocusMode();
  };

  const handleDropTask = async (taskId: string, targetBlockId: TimeBlockId) => {
    if (!dailyData) return;
    try {
      let task = dailyData.tasks.find(t => t.id === taskId);
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

  const insertWarmupTasks = async (blockId: TimeBlockId, hourSlot?: number, preset = warmupPreset) => {
    const targetBlock = TIME_BLOCKS.find(b => b.id === blockId);
    const targetHour = hourSlot ?? targetBlock?.start;
    if (!targetBlock || targetHour === undefined) return;

    for (const warmupItem of preset) {
      const newTask = createNewTask(warmupItem.text, {
        baseDuration: warmupItem.baseDuration,
        resistance: warmupItem.resistance,
        timeBlock: blockId,
        hourSlot: targetHour,
      });
      await addTask(newTask);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleManualWarmup = () => {
    const target = getNextWarmupTarget(currentHour);
    if (!target) return;
    insertWarmupTasks(target.blockId, target.hourSlot);
  };
  const handleSaveWarmupPreset = (preset: WarmupPresetItem[]) => {
    setWarmupPreset(preset);
    syncToFirebase(warmupPresetStrategy, preset).catch(err =>
      console.error('Failed to sync warmup preset:', err)
    );
    closeWarmupModal();
  };

  const handleApplyWarmupFromModal = (preset: WarmupPresetItem[]) => {
    const target = getNextWarmupTarget(currentHour);
    if (!target) return;
    insertWarmupTasks(target.blockId, target.hourSlot, preset);
    syncToFirebase(warmupPresetStrategy, preset).catch(err =>
      console.error('Failed to sync warmup preset:', err)
    );
    closeWarmupModal();
  };

  const getNextWarmupTarget = (hour: number): { blockId: TimeBlockId; hourSlot: number } | null => {
    const targetHour = hour + 1;
    const blockForTargetHour = TIME_BLOCKS.find(b => targetHour >= b.start && targetHour < b.end);
    if (blockForTargetHour) {
      return { blockId: blockForTargetHour.id as TimeBlockId, hourSlot: targetHour };
    }

    const nextBlock = TIME_BLOCKS.find(b => b.start > hour);
    if (nextBlock) {
      return { blockId: nextBlock.id as TimeBlockId, hourSlot: nextBlock.start };
    }
    return null;
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
                  hourSlotTags={hourSlotTags}
                  tagTemplates={tagTemplates}
                  recentTagIds={recentTagIds}
                  onSelectHourTag={handleSelectHourTag}
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
          onAutoGenerateToggle={setWarmupAutoGenerateEnabled}
        />
      )}
    </div>
  );
}
