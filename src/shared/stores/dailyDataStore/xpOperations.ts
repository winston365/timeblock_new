import type { StoreApi } from 'zustand';
import type { Task, TimeBlockState } from '@/shared/types/domain';
import type { DailyDataStore } from './types';

import { toggleTaskCompletion as toggleTaskInRepo, updateBlockState as updateBlockStateInRepo, saveDailyData } from '@/data/repositories';
import { getInboxTaskById } from '@/data/repositories/inboxRepository';
import { calculateTaskXP } from '@/shared/lib/utils';
import {
  assertDailyDataExists,
  createBlockRollbackState,
  createFullRollbackState,
  createOptimisticBlockUpdate,
  createOptimisticTaskUpdate,
  createUpdatedDailyData,
  updateTaskInArray,
} from '@/shared/lib/storeUtils';
import { eventBus } from '@/shared/lib/eventBus';
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';
import type { TaskCompletionResult } from '@/shared/services/gameplay/taskCompletion/types';

type StoreSet = StoreApi<DailyDataStore>['setState'];
type StoreGet = StoreApi<DailyDataStore>['getState'];

export const createXpOperations = (
  set: StoreSet,
  get: StoreGet
): Pick<DailyDataStore, 'toggleTaskCompletion' | 'toggleBlockLock' | 'toggleDontDoItem'> => ({
  /** Task 완료 토글 (완료 파이프라인 + XP/이벤트 처리) */
  toggleTaskCompletion: async (taskId: string) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const originalTasks = dailyData.tasks;
    const originalBlockStates = dailyData.timeBlockStates;

    try {
      const taskInDaily = dailyData.tasks.find((t) => t.id === taskId);
      let wasCompleted = false;
      let optimisticTasks = dailyData.tasks;
      let blockState: TimeBlockState | undefined;
      let blockTasks: Task[] | undefined;

      if (taskInDaily) {
        wasCompleted = taskInDaily.completed;
        optimisticTasks = updateTaskInArray(dailyData.tasks, taskId, {
          completed: !taskInDaily.completed,
          completedAt: !taskInDaily.completed ? new Date().toISOString() : null,
        });
        set(createOptimisticTaskUpdate(dailyData, optimisticTasks));
      } else {
        const inboxTask = await getInboxTaskById(taskId);
        if (!inboxTask) {
          throw new Error(`Task not found: ${taskId}`);
        }
        wasCompleted = inboxTask.completed;
      }

      const updatedTask = await toggleTaskInRepo(taskId, currentDate);

      let result: TaskCompletionResult | null = null;
      if (!wasCompleted && updatedTask.completed) {
        if (taskInDaily && updatedTask.timeBlock) {
          blockState = dailyData.timeBlockStates[updatedTask.timeBlock];
          blockTasks = optimisticTasks.filter((t) => t.timeBlock === updatedTask.timeBlock);
        }

        result = await taskCompletionService.handleTaskCompletion({
          task: updatedTask,
          wasCompleted,
          date: currentDate,
          blockState,
          blockTasks,
        });

        eventBus.emit(
          'gameState:refreshRequest',
          { reason: 'task_completion' },
          { source: 'dailyDataStore.toggleTaskCompletion' }
        );

        if (taskInDaily && result.isPerfectBlock && updatedTask.timeBlock && blockState) {
          set({
            dailyData: createUpdatedDailyData(dailyData, {
              tasks: optimisticTasks,
              timeBlockStates: {
                ...dailyData.timeBlockStates,
                [updatedTask.timeBlock]: {
                  ...blockState,
                  isPerfect: true,
                },
              },
            }),
          });
        }

        if (updatedTask.adjustedDuration >= 10) {
          eventBus.emit(
            'realityCheck:request',
            {
              taskId: updatedTask.id,
              taskTitle: updatedTask.text,
              estimatedDuration: updatedTask.adjustedDuration,
            },
            { source: 'dailyDataStore.toggleTaskCompletion' }
          );
        }

        eventBus.emit(
          'task:completed',
          {
            taskId: updatedTask.id,
            xpEarned: result?.xpGained || 0,
            isPerfectBlock: result?.isPerfectBlock || false,
            blockId: updatedTask.timeBlock || undefined,
            goalId: updatedTask.goalId || undefined,
            adjustedDuration: updatedTask.adjustedDuration,
          },
          { source: 'dailyDataStore.toggleTaskCompletion' }
        );
      }

      if (wasCompleted && !updatedTask.completed) {
        const xpToDeduct = calculateTaskXP(updatedTask);

        const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
        await useGameStateStore.getState().addXP(-xpToDeduct, updatedTask.timeBlock || undefined, true);

        eventBus.emit(
          'gameState:refreshRequest',
          { reason: 'task_uncomplete' },
          { source: 'dailyDataStore.toggleTaskCompletion' }
        );

        eventBus.emit(
          'task:uncompleted',
          {
            taskId: updatedTask.id,
            xpDeducted: xpToDeduct,
            blockId: updatedTask.timeBlock || undefined,
          },
          { source: 'dailyDataStore.toggleTaskCompletion' }
        );
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle task completion, rolling back:', err);
      set(createFullRollbackState(dailyData, originalTasks, originalBlockStates, err as Error));
      throw err;
    }
  },

  /** 블록 잠금 토글 (XP 이벤트 포함) */
  toggleBlockLock: async (blockId: string) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const originalBlockStates = dailyData.timeBlockStates;

    try {
      let blockState = dailyData.timeBlockStates[blockId];
      const blockTasks = dailyData.tasks.filter((t) => t.timeBlock === blockId);

      if (!blockState) {
        console.warn(`[DailyDataStore] Block state not found for ${blockId}, initializing default.`);
        blockState = { isLocked: false, isPerfect: false, isFailed: false };
      }

      if (blockState.isLocked) {
        const confirmUnlock = confirm(
          '⚠️ 블록 잠금을 해제하시겠습니까?\n\n' +
            '- 40 XP를 소모합니다.\n\n' +
            '정말로 해제하시겠습니까?'
        );

        if (!confirmUnlock) return;

        set(createOptimisticBlockUpdate(dailyData, blockId, { isLocked: false }));

        eventBus.emit(
          'block:unlocked',
          {
            blockId,
            xpCost: 40,
          },
          { source: 'dailyDataStore.toggleBlockLock' }
        );
        await updateBlockStateInRepo(blockId, { isLocked: false }, currentDate);
      } else {
        if (blockTasks.length === 0) {
          throw new Error('작업이 없는 블록은 잠금할 수 없습니다.');
        }

        set(createOptimisticBlockUpdate(dailyData, blockId, { isLocked: true }));

        await updateBlockStateInRepo(blockId, { isLocked: true }, currentDate);

        eventBus.emit(
          'block:locked',
          {
            blockId,
            taskCount: blockTasks.length,
          },
          { source: 'dailyDataStore.toggleBlockLock' }
        );
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle block lock, rolling back:', err);
      set(createBlockRollbackState(dailyData, originalBlockStates, err as Error));
      throw err;
    }
  },

  /** 하지않기 체크리스트 항목 토글 (XP 보상 1회) */
  toggleDontDoItem: async (blockId: string, itemId: string, xpReward: number) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const prevStatus = dailyData.timeBlockDontDoStatus || {};
    const blockStatus = prevStatus[blockId] || {};
    const wasChecked = blockStatus[itemId] || false;

    try {
      if (wasChecked) {
        return;
      }

      const nextStatus = {
        ...prevStatus,
        [blockId]: {
          ...blockStatus,
          [itemId]: true,
        },
      };

      const optimistic = createUpdatedDailyData(dailyData, { timeBlockDontDoStatus: nextStatus });
      set({ dailyData: optimistic });

      await saveDailyData(
        currentDate,
        dailyData.tasks,
        dailyData.timeBlockStates,
        dailyData.hourSlotTags,
        nextStatus
      );

      eventBus.emit(
        'xp:earned',
        {
          amount: xpReward,
          source: 'dont_do_check',
          blockId,
        },
        { source: 'dailyDataStore.toggleDontDoItem' }
      );
    } catch (err) {
      console.error("[DailyDataStore] Failed to toggle don't-do item, rolling back:", err);
      set({ dailyData });
      throw err;
    }
  },
});
