import { useCallback, useEffect, useMemo, useState } from 'react';

import { useInboxHotkeys } from '@/features/tasks/hooks/useInboxHotkeys';
import { updateTask as updateTaskWithDate } from '@/data/repositories/dailyDataRepository';
import { useDailyData } from '@/shared/hooks/useDailyData';
import { useGameState } from '@/shared/hooks/useGameState';
import { TASK_DEFAULTS, SYSTEM_STATE_DEFAULTS } from '@/shared/constants/defaults';
import { eventBus } from '@/shared/lib/eventBus';
import { notify } from '@/shared/lib/notify';
import { getLocalDate } from '@/shared/lib/utils';
import { findSuggestedSlot, type SlotFindMode } from '@/shared/services/schedule/slotFinder';
import { useInboxStore } from '@/shared/stores/inboxStore';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import {
  createInboxTask,
  createTaskFromPartial,
  isNewlyPrepared,
  isTaskPrepared,
} from '@/shared/utils/taskFactory';

export type InboxTabActiveTab =
  | 'all'
  | 'recent'
  | 'pinned'
  | 'deferred'
  | 'high'
  | 'medium'
  | 'low';

export interface InboxStats {
  readonly total: number;
  readonly pinned: number;
  readonly deferred: number;
  readonly actionable: number;
  readonly todayISO: string;
}

export interface UseInboxControllerReturn {
  // Store
  readonly inboxTasks: readonly Task[];
  readonly loading: boolean;
  readonly loadData: () => Promise<void>;
  readonly updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;

  // Filters
  readonly activeTab: InboxTabActiveTab;
  readonly setActiveTab: (tab: InboxTabActiveTab) => void;
  readonly counts: Readonly<Record<InboxTabActiveTab, number>>;
  readonly filteredTasks: readonly Task[];

  // Inline input
  readonly inlineInputValue: string;
  readonly setInlineInputValue: (value: string) => void;
  readonly handleInlineInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => Promise<void>;
  readonly handleInlineInputFocus: () => void;
  readonly handleInlineInputBlur: () => void;

  // Modal
  readonly isModalOpen: boolean;
  readonly editingTask: Task | null;
  readonly handleAddTask: () => void;
  readonly handleEditTask: (task: Task) => void;
  readonly handleCloseModal: () => void;
  readonly handleSaveTask: (taskData: Partial<Task>) => Promise<void>;
  readonly handleSaveMultipleTasks: (tasks: ReadonlyArray<Partial<Task>>) => Promise<void>;

  // Task actions
  readonly handleDeleteTask: (taskId: string) => Promise<void>;
  readonly handleToggleTask: (taskId: string) => Promise<void>;
  readonly handleTaskDragEnd: () => void;

  // Quick actions
  readonly handleQuickPlace: (taskId: string, mode: SlotFindMode) => Promise<void>;
  readonly handleTogglePin: (task: Task) => Promise<void>;
  readonly handleToggleDefer: (task: Task) => Promise<void>;

  // Triage + HUD
  readonly triageEnabled: boolean;
  readonly handleToggleTriage: () => void;
  readonly focusedTaskId: string | null;
  readonly hudCollapsed: boolean;
  readonly setHudCollapsed: (collapsed: boolean) => void;
  readonly dailyGoalCount: number;
  readonly setDailyGoalCount: (count: number) => void;
  readonly todayProcessedCount: number;
  readonly progressPercent: number;
  readonly isGoalAchieved: boolean;
  readonly stats: InboxStats;

  // Drag/drop integration
  readonly moveTaskToInbox: (taskId: string) => Promise<void>;
}

export const useInboxController = (): UseInboxControllerReturn => {
  const { updateQuestProgress } = useGameState();
  const { updateTask: updateDailyTask, dailyData } = useDailyData();
  const todayTasks = useMemo(() => dailyData?.tasks ?? [], [dailyData?.tasks]);
  const timeBlockStates = dailyData?.timeBlockStates;

  const {
    inboxTasks,
    loading,
    loadData,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
  } = useInboxStore();

  const [triageEnabled, setTriageEnabled] = useState(false);
  const [triageFocusedTaskId, setTriageFocusedTaskId] = useState<string | null>(null);

  const handleToggleTriage = useCallback(() => {
    const nextEnabled = !triageEnabled;

    if (nextEnabled) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }

    setTriageEnabled(nextEnabled);
  }, [triageEnabled]);

  const [hudCollapsed, setHudCollapsed] = useState<boolean>(SYSTEM_STATE_DEFAULTS.inboxHudCollapsed);
  const [dailyGoalCount, setDailyGoalCount] = useState<number>(
    SYSTEM_STATE_DEFAULTS.inboxTriageDailyGoalCount,
  );
  const [todayProcessedCount] = useState<number>(SYSTEM_STATE_DEFAULTS.inboxTodayProcessedCount);

  const placeTaskToSlot = useCallback(
    async (taskId: string, date: string, blockId: TimeBlockId, hourSlot: number) => {
      const today = getLocalDate();

      if (date === today) {
        await updateDailyTask(taskId, {
          timeBlock: blockId,
          hourSlot,
        });
        return;
      }

      await updateTaskWithDate(
        taskId,
        {
          timeBlock: blockId,
          hourSlot,
        },
        date,
      );

      await loadData();
    },
    [loadData, updateDailyTask],
  );

  const setLastUsedSlot = useCallback(
    async (_slot: { mode: SlotFindMode; date: string; blockId: string; hourSlot: number }) => {
      // Placeholder: 마지막 슬롯 저장 기능은 향후 구현
    },
    [],
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<InboxTabActiveTab>('all');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const stats: InboxStats = useMemo(() => {
    const todayISO = getLocalDate();
    const pinned = inboxTasks.filter((t) => t.isPinned).length;
    const deferred = inboxTasks.filter(
      (t) => (t.deferredUntil ?? null) !== null && (t.deferredUntil ?? '') > todayISO,
    ).length;
    const actionable = inboxTasks.length - deferred;

    return {
      total: inboxTasks.length,
      pinned,
      deferred,
      actionable,
      todayISO,
    };
  }, [inboxTasks]);

  const { focusedTaskId } = useInboxHotkeys({
    triageEnabled,
    triageFocusedTaskId,
    setTriageFocusedTaskId,
    placeTaskToSlot,
    setLastUsedSlot,
    onEditTask: (taskId) => {
      const task = inboxTasks.find((t) => t.id === taskId);
      if (!task) return;

      setEditingTask(task);
      setIsModalOpen(true);
    },
    onDeleteTask: async (taskId) => {
      const task = inboxTasks.find((t) => t.id === taskId);
      if (!task) return;

      await deleteTask(taskId);

      notify.undo(`"${task.text}" 삭제됨`, {
        label: '되돌리기',
        onAction: async () => {
          await addTask(task);
          notify.success('복원되었습니다');
        },
      });
    },
    disabled: isModalOpen || (!triageEnabled && isInputFocused),
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const off = eventBus.on('inbox:dailyGoalAchieved', ({ goalCount }) => {
      notify.goalAchieved(`오늘 목표 ${goalCount}개 달성!`);
    });

    return () => {
      off();
    };
  }, []);

  const handleQuickPlace = useCallback(
    async (taskId: string, mode: SlotFindMode) => {
      const task = inboxTasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        const today = getLocalDate();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = getLocalDate(tomorrow);

        const suggestion = findSuggestedSlot({
          now: new Date(),
          mode,
          today: {
            tasks: todayTasks,
            timeBlockStates,
            dateISO: today,
          },
          tomorrow: {
            tasks: [],
            dateISO: tomorrowISO,
          },
          options: {
            skipLockedBlocks: true,
            avoidHourSlotCollisions: true,
          },
        });

        if (!suggestion) {
          notify.error('배치 가능한 슬롯이 없습니다');
          return;
        }

        await placeTaskToSlot(taskId, suggestion.dateISO, suggestion.blockId as TimeBlockId, suggestion.hourSlot);

        await setLastUsedSlot({
          mode,
          date: suggestion.dateISO,
          blockId: suggestion.blockId as string,
          hourSlot: suggestion.hourSlot,
        });

        notify.placement(suggestion.label);
      } catch (error) {
        console.error('Quick place failed:', error);
        notify.error('배치에 실패했습니다');
      }
    },
    [inboxTasks, placeTaskToSlot, setLastUsedSlot, timeBlockStates, todayTasks],
  );

  const handleInlineInputKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inlineInputValue.trim()) {
        e.preventDefault();
        const trimmedText = inlineInputValue.trim();

        try {
          const newTask = createInboxTask(trimmedText, {
            baseDuration: TASK_DEFAULTS.baseDuration,
            resistance: TASK_DEFAULTS.resistance,
          });

          await addTask(newTask);
          setInlineInputValue('');
          notify.success('작업이 추가되었습니다');

          if (triageEnabled) {
            setTriageFocusedTaskId(newTask.id);
            (e.currentTarget as HTMLInputElement).blur();
          }
        } catch (error) {
          console.error('Failed to add inline task:', error);
          notify.error('작업 추가에 실패했습니다');
        }

        return;
      }

      if (e.key === 'Escape') {
        setInlineInputValue('');
        (e.target as HTMLInputElement).blur();
      }
    },
    [addTask, inlineInputValue, triageEnabled],
  );

  const handleAddTask = useCallback(() => {
    setEditingTask(null);
    setIsModalOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTask(null);
  }, []);

  const handleSaveTask = useCallback(
    async (taskData: Partial<Task>) => {
      try {
        if (editingTask) {
          await updateTask(editingTask.id, taskData);

          if (isNewlyPrepared(editingTask, taskData)) {
            await updateQuestProgress('prepare_tasks', 1);
          }
        } else {
          const newTask = createTaskFromPartial(taskData, {
            timeBlock: null,
            baseDuration: TASK_DEFAULTS.baseDuration,
          });

          await addTask(newTask);

          if (isTaskPrepared(taskData)) {
            await updateQuestProgress('prepare_tasks', 1);
          }
        }

        setIsModalOpen(false);
        setEditingTask(null);
      } catch (error) {
        console.error('Failed to save task:', error);
        notify.error('작업 저장에 실패했습니다');
      }
    },
    [addTask, editingTask, updateQuestProgress, updateTask],
  );

  const handleSaveMultipleTasks = useCallback(
    async (tasks: ReadonlyArray<Partial<Task>>) => {
      try {
        for (const taskData of tasks) {
          const newTask = createTaskFromPartial(taskData, {
            timeBlock: null,
            baseDuration: TASK_DEFAULTS.baseDuration,
          });

          await addTask(newTask);

          if (isTaskPrepared(newTask)) {
            await updateQuestProgress('prepare_tasks', 1);
          }
        }

        setIsModalOpen(false);
        setEditingTask(null);
      } catch (error) {
        console.error('Failed to save multiple tasks:', error);
        notify.error('작업 일괄 추가에 실패했습니다');
      }
    },
    [addTask, updateQuestProgress],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        const task = inboxTasks.find((t) => t.id === taskId);
        await deleteTask(taskId);

        if (task) {
          notify.undo(`"${task.text}" 삭제됨`, {
            label: '되돌리기',
            onAction: async () => {
              await addTask(task);
              notify.success('복원되었습니다');
            },
          });
        }
      } catch (error) {
        console.error('Failed to delete task:', error);
        notify.error('작업 삭제에 실패했습니다');
      }
    },
    [addTask, deleteTask, inboxTasks],
  );

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      try {
        await toggleTaskCompletion(taskId);
      } catch (error) {
        console.error('Failed to toggle task:', error);
        notify.error('작업 상태 변경에 실패했습니다');
      }
    },
    [toggleTaskCompletion],
  );

  const handleTaskDragEnd = useCallback(() => {
    setTimeout(() => loadData(), 300);
  }, [loadData]);

  const handleTogglePin = useCallback(
    async (task: Task) => {
      try {
        await updateTask(task.id, { isPinned: !task.isPinned });
        notify.info(task.isPinned ? '고정 해제됨' : '📌 고정됨');
      } catch (error) {
        console.error('Failed to toggle pin:', error);
        notify.error('고정 변경에 실패했습니다');
      }
    },
    [updateTask],
  );

  const handleToggleDefer = useCallback(
    async (task: Task) => {
      const isDeferred =
        (task.deferredUntil ?? null) !== null && (task.deferredUntil ?? '') > stats.todayISO;

      try {
        if (isDeferred) {
          await updateTask(task.id, { deferredUntil: null });
          notify.info('보류 해제됨');
          return;
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await updateTask(task.id, { deferredUntil: getLocalDate(tomorrow) });
        notify.info('⏸️ 내일까지 보류');
      } catch (error) {
        console.error('Failed to toggle defer:', error);
        notify.error('보류 변경에 실패했습니다');
      }
    },
    [stats.todayISO, updateTask],
  );

  const counts: Readonly<Record<InboxTabActiveTab, number>> = useMemo(
    () => ({
      all: inboxTasks.length,
      recent: Math.min(inboxTasks.length, 3),
      pinned: stats.pinned,
      deferred: stats.deferred,
      high: inboxTasks.filter((inboxTask) => inboxTask.resistance === 'high').length,
      medium: inboxTasks.filter((inboxTask) => inboxTask.resistance === 'medium').length,
      low: inboxTasks.filter((inboxTask) => inboxTask.resistance === 'low').length,
    }),
    [inboxTasks, stats.deferred, stats.pinned],
  );

  const filteredTasks: readonly Task[] = useMemo(() => {
    switch (activeTab) {
      case 'recent':
        return [...inboxTasks]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3);
      case 'pinned':
        return inboxTasks.filter((t) => t.isPinned);
      case 'deferred':
        return inboxTasks.filter(
          (t) => (t.deferredUntil ?? null) !== null && (t.deferredUntil ?? '') > stats.todayISO,
        );
      case 'high':
        return inboxTasks.filter((inboxTask) => inboxTask.resistance === 'high');
      case 'medium':
        return inboxTasks.filter((inboxTask) => inboxTask.resistance === 'medium');
      case 'low':
        return inboxTasks.filter((inboxTask) => inboxTask.resistance === 'low');
      case 'all':
      default:
        return [...inboxTasks].sort((a, b) => {
          const aPinned = a.isPinned === true;
          const bPinned = b.isPinned === true;
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;

          const aDeferred =
            (a.deferredUntil ?? null) !== null && (a.deferredUntil ?? '') > stats.todayISO;
          const bDeferred =
            (b.deferredUntil ?? null) !== null && (b.deferredUntil ?? '') > stats.todayISO;
          if (aDeferred && !bDeferred) return 1;
          if (!aDeferred && bDeferred) return -1;

          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
  }, [activeTab, inboxTasks, stats.todayISO]);

  const progressPercent =
    dailyGoalCount > 0 ? Math.min(100, Math.round((todayProcessedCount / dailyGoalCount) * 100)) : 0;
  const isGoalAchieved = todayProcessedCount >= dailyGoalCount;

  const moveTaskToInbox = useCallback(
    async (taskId: string) => {
      await updateDailyTask(taskId, {
        timeBlock: null,
        hourSlot: undefined,
      });

      await loadData();
    },
    [loadData, updateDailyTask],
  );

  return {
    inboxTasks,
    loading,
    loadData,
    updateTask,

    activeTab,
    setActiveTab,
    counts,
    filteredTasks,

    inlineInputValue,
    setInlineInputValue,
    handleInlineInputKeyDown,
    handleInlineInputFocus: () => setIsInputFocused(true),
    handleInlineInputBlur: () => setIsInputFocused(false),

    isModalOpen,
    editingTask,
    handleAddTask,
    handleEditTask,
    handleCloseModal,
    handleSaveTask,
    handleSaveMultipleTasks,

    handleDeleteTask,
    handleToggleTask,
    handleTaskDragEnd,

    handleQuickPlace,
    handleTogglePin,
    handleToggleDefer,

    triageEnabled,
    handleToggleTriage,
    focusedTaskId,
    hudCollapsed,
    setHudCollapsed,
    dailyGoalCount,
    setDailyGoalCount,
    todayProcessedCount,
    progressPercent,
    isGoalAchieved,
    stats,

    moveTaskToInbox,
  };
};
