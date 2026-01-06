import type { StoreApi } from 'zustand';
import type { Task } from '@/shared/types/domain';
import type { DailyDataStore, UpdateTaskOptions } from './types';

import {
  addTask as addTaskToRepo,
  updateTask as updateTaskInRepo,
  deleteTask as deleteTaskFromRepo,
} from '@/data/repositories';
import { getInboxTaskById } from '@/data/repositories/inboxRepository';
import { scheduleEmojiSuggestion } from '@/shared/services/ai/emojiSuggester';
import { eventBus } from '@/shared/lib/eventBus';
import { trackTaskTimeBlockChange } from '@/shared/services/behavior/procrastinationMonitor';
import { toStandardError } from '@/shared/lib/standardError';
import {
  addTaskToArray,
  assertDailyDataExists,
  createOptimisticTaskUpdate,
  createRollbackState,
  removeTaskFromArray,
  sanitizeTaskUpdates,
  updateTaskInArray,
} from '@/shared/lib/storeUtils';

type StoreSet = StoreApi<DailyDataStore>['setState'];
type StoreGet = StoreApi<DailyDataStore>['getState'];

export const createTaskOperations = (
  set: StoreSet,
  get: StoreGet
): Pick<DailyDataStore, 'addTask' | 'updateTask' | 'deleteTask'> => ({
  /** Task 추가 */
  addTask: async (task: Task) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const optimisticTasks = addTaskToArray(dailyData.tasks, task);
    set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

    try {
      await addTaskToRepo(task, currentDate);
      scheduleEmojiSuggestion(task.id, task.text);

      if (task.timeBlock !== null) {
        eventBus.emit(
          'task:created',
          {
            taskId: task.id,
            text: task.text,
            timeBlock: task.timeBlock,
            goalId: task.goalId,
          },
          { source: 'dailyDataStore.addTask' }
        );
      }
    } catch (err) {
      const standardError = toStandardError({
        code: 'DAILY_TASK_ADD_FAILED',
        error: err,
        context: { taskId: task.id, currentDate },
      });
      console.error('[DailyDataStore] Failed to add task, rolling back:', standardError);
      set(createRollbackState(dailyData, dailyData.tasks, standardError));
      throw standardError;
    }
  },

  /** Task 업데이트 (Global Inbox ↔ TimeBlock 이동 지원) */
  updateTask: async (taskId: string, updates: Partial<Task>, options?: UpdateTaskOptions) => {
    const { currentDate, dailyData, loadData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const { skipBehaviorTracking = false, skipEmoji = false, ignoreLock = false } = options || {};
    const sanitizedUpdates = sanitizeTaskUpdates(updates);

    const originalTasks = dailyData.tasks;
    let originalTask = dailyData.tasks.find((t) => t.id === taskId);
    let inboxTask: Task | null = null;
    let isInboxToBlockMove = false;
    let isBlockToInboxMove = false;

    if (!originalTask) {
      try {
        inboxTask = (await getInboxTaskById(taskId)) ?? null;
        originalTask = inboxTask || undefined;
      } catch (error) {
        console.error('[DailyDataStore] Failed to check globalInbox:', error);
      }
    }

    if (originalTask?.timeBlock && !ignoreLock) {
      const blockState = dailyData.timeBlockStates[originalTask.timeBlock];
      if (blockState?.isLocked) {
        const wantsToChangeBlock =
          Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'timeBlock') &&
          sanitizedUpdates.timeBlock !== undefined &&
          sanitizedUpdates.timeBlock !== originalTask.timeBlock;

        if (wantsToChangeBlock) {
          throw new Error('잠금된 블록의 작업은 이동하거나 인박스로 보낼 수 없습니다. 잠금을 해제해주세요.');
        }
      }
    }

    if (inboxTask && sanitizedUpdates.timeBlock !== null && sanitizedUpdates.timeBlock !== undefined) {
      isInboxToBlockMove = true;
    } else if (originalTask && sanitizedUpdates.timeBlock === null && originalTask.timeBlock !== null) {
      isBlockToInboxMove = true;
    }

    if (isInboxToBlockMove && inboxTask) {
      const movedTask: Task = {
        ...inboxTask,
        ...sanitizedUpdates,
      };
      const optimisticTasks = addTaskToArray(dailyData.tasks, movedTask);
      set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

      eventBus.emit('inbox:taskRemoved', { taskId }, { source: 'dailyDataStore.updateTask' });
    } else if (isBlockToInboxMove) {
      const optimisticTasks = removeTaskFromArray(dailyData.tasks, taskId);
      set(createOptimisticTaskUpdate(dailyData, optimisticTasks));
    } else if (!isInboxToBlockMove && !isBlockToInboxMove) {
      const optimisticTasks = updateTaskInArray(dailyData.tasks, taskId, sanitizedUpdates);
      set(createOptimisticTaskUpdate(dailyData, optimisticTasks));
    }

    const shouldTrackBehavior =
      !skipBehaviorTracking && Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'timeBlock');
    const previousBlock = originalTask?.timeBlock ?? null;
    const nextBlock = shouldTrackBehavior ? (sanitizedUpdates.timeBlock ?? null) : null;

    try {
      await updateTaskInRepo(taskId, sanitizedUpdates, currentDate);

      if (!skipEmoji && !('emoji' in sanitizedUpdates)) {
        const finalText = sanitizedUpdates.text ?? originalTask?.text;
        const hasEmoji = (sanitizedUpdates.emoji ?? originalTask?.emoji) !== undefined;
        if (finalText && !hasEmoji) {
          scheduleEmojiSuggestion(taskId, finalText);
        }
      }

      if (isInboxToBlockMove || isBlockToInboxMove) {
        loadData(currentDate, true).catch((err) => {
          console.warn('[DailyDataStore] Background revalidate failed:', err);
        });
      }

      eventBus.emit(
        'task:updated',
        {
          taskId,
          updates: sanitizedUpdates,
          previousTimeBlock: originalTask?.timeBlock ?? null,
          newTimeBlock: sanitizedUpdates.timeBlock ?? originalTask?.timeBlock ?? null,
        },
        { source: 'dailyDataStore.updateTask' }
      );

      if (shouldTrackBehavior) {
        await trackTaskTimeBlockChange({
          taskId,
          previousBlock,
          nextBlock,
          currentDate,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isTaskNotFound = errorMessage.includes('Task not found') || errorMessage.includes('not found');

      if (isTaskNotFound) {
        console.warn('[DailyDataStore] Task not found during update, skipping rollback:', taskId);
        loadData(currentDate, true).catch((refreshErr) => {
          console.warn('[DailyDataStore] Background refresh after task-not-found failed:', refreshErr);
        });
        return;
      }

      console.error('[DailyDataStore] Failed to update task, rolling back:', err);
      set(createRollbackState(dailyData, originalTasks, err as Error));
      throw err;
    }
  },

  /** Task 삭제 */
  deleteTask: async (taskId: string) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const originalTasks = dailyData.tasks;
    const deletedTask = dailyData.tasks.find((t) => t.id === taskId);

    if (deletedTask?.timeBlock) {
      const blockState = dailyData.timeBlockStates[deletedTask.timeBlock];
      if (blockState?.isLocked) {
        throw new Error('잠금된 블록의 작업은 삭제할 수 없습니다. 잠금을 해제해주세요.');
      }
    }

    const optimisticTasks = removeTaskFromArray(dailyData.tasks, taskId);
    set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

    try {
      await deleteTaskFromRepo(taskId, currentDate);

      if (deletedTask?.timeBlock !== null) {
        eventBus.emit(
          'task:deleted',
          {
            taskId,
            goalId: deletedTask?.goalId ?? null,
          },
          { source: 'dailyDataStore.deleteTask' }
        );
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to delete task, rolling back:', err);
      set(createRollbackState(dailyData, originalTasks, err as Error));
      throw err;
    }
  },
});
