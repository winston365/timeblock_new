/**
 * ScheduleView
 *
 * 타임블록 메인 화면 (일정/태스크 전체 보기)
 */

import { useEffect, useRef, useState } from 'react';
import { db } from '@/data/db/dexieClient';
import { useDailyData } from '@/shared/hooks';
import { useGameState } from '@/shared/hooks/useGameState';
import { generateId } from '@/shared/lib/utils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import type { Task, TimeBlockId, WarmupPresetItem } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import TaskModal from './TaskModal';
import TimeBlock from './TimeBlock';
import { FocusView } from './components/FocusView';
import { useFocusModeStore } from './stores/focusModeStore';
import { fetchFromFirebase, syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { warmupPresetStrategy } from '@/shared/services/sync/firebase/strategies';
import IgnitionOverlay from '@/features/ignition/IgnitionOverlay';
import { useIgnitionStore } from '@/features/ignition/stores/useIgnitionStore';

const DEFAULT_WARMUP_PRESET: WarmupPresetItem[] = [
  { text: '책상 정리', baseDuration: 5, resistance: 'low' },
  { text: '메일함 비우기', baseDuration: 5, resistance: 'low' },
  { text: '물 마시기', baseDuration: 5, resistance: 'low' },
];

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
  const { settings, loadData: loadSettingsData } = useSettingsStore();

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [showPastBlocks, setShowPastBlocks] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWarmupModalOpen, setIsWarmupModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);
  const [warmupPreset, setWarmupPreset] = useState<WarmupPresetItem[]>(DEFAULT_WARMUP_PRESET);

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
  // 매 시간 50분에 자동 체크 후 다음 시간대(같은 블록이든 다음 블록이든)에 삽입 (22:50~03:50 제외)
  useEffect(() => {
    const interval = setInterval(() => {
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
  }, [dailyData, warmupPreset]);

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
  const pastBlocks = TIME_BLOCKS.filter(block => currentHour >= block.end);
  const blocksToRender = TIME_BLOCKS.filter(block => {
    const isPast = currentHour >= block.end;
    if (isPast && !showPastBlocks) return false;
    return true;
  });
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

      const newTask: Task = {
        id: generateId('task'),
        text: text.trim(),
        memo: '',
        baseDuration: 15,
        resistance: 'low',
        adjustedDuration: 15,
        order: Date.now(),
        timeBlock: blockId,
        hourSlot: targetHour,
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        preparation1: '',
        preparation2: '',
        preparation3: '',
        goalId: null,
      };
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
          order: Date.now(),
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
      alert(error instanceof Error ? error.message : '타임블록 잠금 변경에 실패했습니다.');
    }
  };

  const handleToggleFocusMode = () => {
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
        const block = TIME_BLOCKS.find(b => b.id === selectedBlockId);
        const firstHour = block ? block.start : undefined;
        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '새 작업',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 15,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 15,
          order: Date.now(),
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
      alert('작업 일괄 추가에 실패했습니다.');
    }
  };

  const insertWarmupTasks = async (blockId: TimeBlockId, hourSlot?: number, preset = warmupPreset) => {
    const targetBlock = TIME_BLOCKS.find(b => b.id === blockId);
    const targetHour = hourSlot ?? targetBlock?.start;
    if (!targetBlock || targetHour === undefined) return;

    for (const item of preset) {
      const newTask: Task = {
        id: generateId('task'),
        text: item.text,
        memo: '',
        baseDuration: item.baseDuration,
        resistance: item.resistance,
        adjustedDuration: item.baseDuration,
        order: Date.now(),
        timeBlock: blockId,
        hourSlot: targetHour,
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        preparation1: '',
        preparation2: '',
        preparation3: '',
        goalId: null,
      };
      await addTask(newTask);
    }
  };

  const handleManualWarmup = () => {
    const target = getNextWarmupTarget(currentHour);
    if (!target) return;
    insertWarmupTasks(target.blockId, target.hourSlot);
  };
  const handleSaveWarmupPreset = (preset: WarmupPresetItem[]) => {
    setWarmupPreset(preset);
    syncToFirebase(warmupPresetStrategy, preset).catch(err =>
      console.error('Failed to sync warmup preset:', err)
    );
    setIsWarmupModalOpen(false);
  };

  const handleApplyWarmupFromModal = (preset: WarmupPresetItem[]) => {
    const target = getNextWarmupTarget(currentHour);
    if (!target) return;
    insertWarmupTasks(target.blockId, target.hourSlot, preset);
    syncToFirebase(warmupPresetStrategy, preset).catch(err =>
      console.error('Failed to sync warmup preset:', err)
    );
    setIsWarmupModalOpen(false);
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
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <span>전체 {dailyData.tasks.length}개</span>
          <span>인박스 {dailyData.tasks.filter(t => t.timeBlock === null).length}개</span>
          <span>완료 {dailyData.tasks.filter(t => t.completed).length}개</span>
          <button
            type="button"
            onClick={() => setIsWarmupModalOpen(true)}
            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            🧊 워밍업 세트
          </button>
          <button
            type="button"
            onClick={handleToggleFocusMode}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${isFocusMode
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)]'
              }`}
          >
            <span className="text-lg">⏱</span>
            {isFocusMode ? '지금모드 종료' : '지금모드 보기'}
            <span className="text-[10px] text-[var(--color-text-tertiary)]">(현재 타임블록)</span>
          </button>
          {pastBlocks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPastBlocks(prev => !prev)}
              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              {showPastBlocks ? '지난 블록 숨기기' : `지난 블록 보기 (${pastBlocks.length})`}
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
          {!showPastBlocks && pastBlocks.length > 0 && (
            <div className="text-center text-xs text-[var(--color-text-tertiary)]">
              지난 블록이 숨겨져 있습니다.{' '}
              <button
                type="button"
                className="underline underline-offset-4 text-[var(--color-primary)]"
                onClick={() => setShowPastBlocks(true)}
              >
                지난 블록 보기
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
      {isWarmupModalOpen && (
        <WarmupPresetModal
          preset={warmupPreset}
          onClose={() => setIsWarmupModalOpen(false)}
          onSave={handleSaveWarmupPreset}
          onApply={handleApplyWarmupFromModal}
        />
      )}

      {/* 3-Minute Ignition Overlay */}
      <IgnitionOverlay />

      {/* Floating Ignition Trigger */}
      <button
        onClick={() => useIgnitionStore.getState().openIgnition()}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-2xl shadow-lg transition hover:scale-110 hover:shadow-orange-500/40 active:scale-95"
        title="3분 점화 (시작이 어려울 때)"
      >
        🔥
      </button>
    </div>
  );
}

interface WarmupPresetModalProps {
  preset: WarmupPresetItem[];
  onSave: (preset: WarmupPresetItem[]) => void;
  onApply: (preset: WarmupPresetItem[]) => void;
  onClose: () => void;
}

function WarmupPresetModal({ preset, onSave, onApply, onClose }: WarmupPresetModalProps) {
  const [draft, setDraft] = useState<WarmupPresetItem[]>(preset);

  const handleChange = (index: number, field: keyof WarmupPresetItem, value: string) => {
    setDraft(prev =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            [field]: field === 'baseDuration' ? Math.max(1, Number(value) || 1) : value,
          }
          : item,
      ),
    );
  };

  const handleAddRow = () => {
    setDraft(prev => [...prev, { text: '', baseDuration: 5, resistance: 'low' }]);
  };

  const handleRemoveRow = (index: number) => {
    setDraft(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => onSave(draft.filter(item => item.text.trim()));
  const handleApply = () => onApply(draft.filter(item => item.text.trim()));

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">워밍업 세트 설정</h3>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              자주 쓸 3개 내외의 짧은 작업을 정리해두고 필요할 때 바로 넣어.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {draft.map((item, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
              >
                <span className="text-xs text-[var(--color-text-tertiary)]">#{index + 1}</span>
                <input
                  type="text"
                  value={item.text}
                  onChange={e => handleChange(index, 'text', e.target.value)}
                  placeholder="예: 책상 정리"
                  className="min-w-[140px] flex-1 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)]"
                />
                <select
                  value={item.baseDuration}
                  onChange={e => handleChange(index, 'baseDuration', e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)]"
                >
                  {[5, 10, 15, 20, 25, 30].map(min => (
                    <option key={min} value={min}>
                      {min}분
                    </option>
                  ))}
                </select>
                <select
                  value={item.resistance}
                  onChange={e => handleChange(index, 'resistance', e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)]"
                >
                  <option value="low">저항 낮음</option>
                  <option value="medium">중간</option>
                  <option value="high">높음</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  className="rounded-full px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              + 행 추가
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            저장
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.25)] hover:opacity-90"
          >
            다음 블록에 적용
          </button>
        </div>
      </div>
    </div>
  );
}
