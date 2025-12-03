/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DailyData Zustand Store
 *
 * @role 일일 데이터(작업, 블록 상태)의 전역 상태 관리 및 동기화 중복 방지
 * @responsibilities
 *   - 날짜별 일일 데이터 로드/저장 (중복 로드 방지)
 *   - Task CRUD 및 완료 토글 (Optimistic Update 패턴)
 *   - TimeBlock 상태 관리 (잠금/퍼펙트 블록)
 *   - 시간대 속성 태그 및 하지않기 체크리스트 관리
 *   - Task 완료 시 XP/퀘스트/와이푸 호감도 파이프라인 연동
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - repositories: 작업, 블록, XP, 퀘스트, 와이푸 데이터 레포지토리
 *   - utils: 날짜 및 XP 계산 유틸리티
 *   - eventBus: Store 간 통신 (순환 의존성 해소)
 *   - taskCompletionService: 작업 완료 파이프라인
 */

import { create } from 'zustand';
import type { DailyData, Task, TimeBlockState } from '../types/domain';
import {
  loadDailyData,
  saveDailyData,
  addTask as addTaskToRepo,
  updateTask as updateTaskInRepo,
  deleteTask as deleteTaskFromRepo,
  toggleTaskCompletion as toggleTaskInRepo,
  updateBlockState as updateBlockStateInRepo,
} from '@/data/repositories';
import { useGoalStore } from '@/shared/stores/goalStore';
import { getLocalDate, calculateTaskXP } from '../lib/utils';
import {
  sanitizeTaskUpdates,
  createOptimisticTaskUpdate,
  createOptimisticBlockUpdate,
  createRollbackState,
  createBlockRollbackState,
  createFullRollbackState,
  createUpdatedDailyData,
  addTaskToArray,
  updateTaskInArray,
  removeTaskFromArray,
  assertDailyDataExists,
} from '../lib/storeUtils';
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';
import { trackTaskTimeBlockChange } from '@/shared/services/behavior/procrastinationMonitor';
import { db } from '@/data/db/dexieClient';
import { scheduleEmojiSuggestion } from '@/shared/services/ai/emojiSuggester';
import { eventBus } from '@/shared/lib/eventBus';

interface DailyDataStore {
  // 상태
  dailyData: DailyData | null;
  currentDate: string;
  loading: boolean;
  error: Error | null;

  // 액션
  loadData: (date?: string, force?: boolean) => Promise<void>;
  saveData: (tasks: Task[], timeBlockStates: DailyData['timeBlockStates']) => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>, options?: UpdateTaskOptions) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string) => Promise<void>;
  updateBlockState: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
  toggleBlockLock: (blockId: string) => Promise<void>;
  setHourSlotTag: (hour: number, tagId: string | null) => Promise<void>;

  // 하지않기 체크리스트 관리
  toggleDontDoItem: (blockId: string, itemId: string, xpReward: number) => Promise<void>;

  refresh: () => Promise<void>;
  reset: () => void;
}

interface UpdateTaskOptions {
  skipBehaviorTracking?: boolean;
  skipEmoji?: boolean;
  ignoreLock?: boolean;
}

/**
 * 일일 데이터 Zustand 스토어
 *
 * @returns {DailyDataStore} 일일 데이터 상태 및 관리 함수
 * @sideEffects
 *   - localStorage/Firebase에 일일 데이터 저장
 *   - 작업 완료 시 XP, 퀘스트, 와이푸 호감도 업데이트
 *   - 블록 잠금 시 XP 차감
 *   - 중복 로드 방지를 위한 내부 플래그 관리
 *
 * @example
 * ```tsx
 * const { dailyData, addTask, toggleTaskCompletion } = useDailyDataStore();
 * await addTask({ id: '1', title: '작업', completed: false });
 * await toggleTaskCompletion('1');
 * ```
 */
export const useDailyDataStore = create<DailyDataStore>((set, get) => ({
  // 초기 상태
  dailyData: null,
  currentDate: getLocalDate(),
  loading: false,
  error: null,

  // ============================================================================
  // 데이터 로드 & 저장
  // ============================================================================

  /**
   * 일일 데이터 로드 (중복 로드 방지)
   */
  loadData: async (date?: string, force?: boolean) => {
    const targetDate = date || getLocalDate();
    const { currentDate, dailyData, loading } = get();

    // force가 아닐 때만 중복 체크
    if (!force) {
      // 이미 같은 날짜 데이터가 로드되어 있으면 스킵
      if (currentDate === targetDate && dailyData && !loading) {
        return;
      }

      // 이미 로딩 중이면 스킵
      if (loading) {
        return;
      }
    }

    try {
      set({ loading: true, error: null, currentDate: targetDate });
      const data = await loadDailyData(targetDate);
      set({ dailyData: data, loading: false });
    } catch (err) {
      console.error('[DailyDataStore] ❌ Failed to load daily data:', err);
      set({ error: err as Error, loading: false });
    }
  },

  /**
   * 일일 데이터 저장
   */
  saveData: async (tasks: Task[], timeBlockStates: DailyData['timeBlockStates']) => {
    const { currentDate, dailyData } = get();

    try {
      await saveDailyData(currentDate, tasks, timeBlockStates, dailyData?.hourSlotTags);
      set({
        dailyData: {
          tasks,
          goals: dailyData?.goals || [],
          timeBlockStates,
          hourSlotTags: dailyData?.hourSlotTags || {},
          updatedAt: Date.now(),
        },
      });
    } catch (err) {
      console.error('[DailyDataStore] Failed to save daily data:', err);
      set({ error: err as Error });
    }
  },

  // ============================================================================
  // Task CRUD (Optimistic Update 패턴)
  // ============================================================================

  /**
   * Task 추가
   */
  addTask: async (task: Task) => {
    const { currentDate, dailyData, loadData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');
    const today = getLocalDate();

    // ✅ Optimistic Update
    const optimisticTasks = addTaskToArray(dailyData.tasks, task);
    set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

    try {
      // ✅ Repository 호출
      await addTaskToRepo(task, currentDate);
      // 🪄 이모지 추천 (비동기)
      scheduleEmojiSuggestion(task.id, task.text);

      // 🗓️ Event Bus: task:created 이벤트 발행 (Google Calendar 동기화용)
      if (task.timeBlock !== null) {
        eventBus.emit('task:created', {
          taskId: task.id,
          text: task.text,
          timeBlock: task.timeBlock,
          goalId: task.goalId,
        }, {
          source: 'dailyDataStore.addTask',
        });
      }

      // ✅ 목표 연결 시 진행률 재계산
      if (task.goalId && task.timeBlock !== null && currentDate === today) {
        await useGoalStore.getState().recalculateProgress(task.goalId, today);
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to add task, rolling back:', err);
      // ❌ Rollback
      set(createRollbackState(dailyData, dailyData.tasks, err as Error));
      throw err;
    }
  },

  /**
   * Task 업데이트 (Global Inbox ↔ TimeBlock 이동 지원)
   */
  updateTask: async (taskId: string, updates: Partial<Task>, options?: UpdateTaskOptions) => {
    const { currentDate, dailyData, loadData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');
    const { skipBehaviorTracking = false, skipEmoji = false, ignoreLock = false } = options || {};
    const today = getLocalDate();

    // 🔧 Firebase undefined 처리 & hourSlot 자동 계산
    const sanitizedUpdates = sanitizeTaskUpdates(updates);

    // 원본 백업
    const originalTasks = dailyData.tasks;
    let originalTask = dailyData.tasks.find(t => t.id === taskId);
    let inboxTask = null;
    let isInboxToBlockMove = false;
    let isBlockToInboxMove = false;

    // ✅ globalInbox 확인
    if (!originalTask) {
      try {
        inboxTask = await db.globalInbox.get(taskId);
        originalTask = inboxTask || undefined;
      } catch (error) {
        console.error('[DailyDataStore] Failed to check globalInbox:', error);
      }
    }

    // 🔍 이동 타입 감지
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

    // ✅ Optimistic Update (inbox ↔ block 이동은 제외)
    if (!isInboxToBlockMove && !isBlockToInboxMove) {
      const optimisticTasks = updateTaskInArray(dailyData.tasks, taskId, sanitizedUpdates);
      set(createOptimisticTaskUpdate(dailyData, optimisticTasks));
    }

    const shouldTrackBehavior =
      !skipBehaviorTracking &&
      Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'timeBlock');
    const previousBlock = originalTask?.timeBlock ?? null;
    const nextBlock = shouldTrackBehavior ? (sanitizedUpdates.timeBlock ?? null) : null;

    try {
      // ✅ Repository 호출
      await updateTaskInRepo(taskId, sanitizedUpdates, currentDate);
      // 🪄 이모지 추천 (비동기) - emoji 직접 업데이트 중이거나 스킵 플래그면 건너뜀
      if (!skipEmoji && !('emoji' in sanitizedUpdates)) {
        const finalText = sanitizedUpdates.text ?? originalTask?.text;
        const hasEmoji = (sanitizedUpdates.emoji ?? originalTask?.emoji) !== undefined;
        if (finalText && !hasEmoji) {
          scheduleEmojiSuggestion(taskId, finalText);
        }
      }

      // 🔹 inbox ↔ timeBlock 이동 시 강제 새로고침
      if (isInboxToBlockMove || isBlockToInboxMove) {
        await loadData(currentDate, true);
      }

      // 🗓️ Event Bus: task:updated 이벤트 발행 (Google Calendar 동기화용)
      eventBus.emit('task:updated', {
        taskId,
        updates: sanitizedUpdates,
        previousTimeBlock: originalTask?.timeBlock ?? null,
        newTimeBlock: sanitizedUpdates.timeBlock ?? originalTask?.timeBlock ?? null,
      }, {
        source: 'dailyDataStore.updateTask',
      });

      // ✅ 목표 연결 변경 시 진행률 재계산
      const affectedGoalIds = new Set<string>();
      if (originalTask?.goalId) affectedGoalIds.add(originalTask.goalId);
      if (sanitizedUpdates.goalId) affectedGoalIds.add(sanitizedUpdates.goalId);

      const affectsSchedule =
        (originalTask?.timeBlock !== null) ||
        (sanitizedUpdates.timeBlock !== undefined && sanitizedUpdates.timeBlock !== null) ||
        isInboxToBlockMove;

      if (affectedGoalIds.size > 0 && affectsSchedule && currentDate === today) {
        for (const goalId of affectedGoalIds) {
          await useGoalStore.getState().recalculateProgress(goalId, today);
        }
        await loadData(currentDate, true);
      }

      if (shouldTrackBehavior) {
        await trackTaskTimeBlockChange({
          taskId,
          previousBlock,
          nextBlock,
          currentDate,
        });
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to update task, rolling back:', err);
      // ❌ Rollback
      set(createRollbackState(dailyData, originalTasks, err as Error));
      throw err;
    }
  },

  /**
   * Task 삭제
   */
  deleteTask: async (taskId: string) => {
    const { currentDate, dailyData, loadData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');
    const today = getLocalDate();

    // 원본 백업
    const originalTasks = dailyData.tasks;
    const deletedTask = dailyData.tasks.find(t => t.id === taskId);

    if (deletedTask?.timeBlock) {
      const blockState = dailyData.timeBlockStates[deletedTask.timeBlock];
      if (blockState?.isLocked) {
        throw new Error('잠금된 블록의 작업은 삭제할 수 없습니다. 잠금을 해제해주세요.');
      }
    }

    // ✅ Optimistic Update
    const optimisticTasks = removeTaskFromArray(dailyData.tasks, taskId);
    set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

    try {
      // ✅ Repository 호출
      await deleteTaskFromRepo(taskId, currentDate);

      // 🗓️ Event Bus: task:deleted 이벤트 발행 (Google Calendar 동기화용)
      if (deletedTask?.timeBlock !== null) {
        eventBus.emit('task:deleted', {
          taskId,
          goalId: deletedTask?.goalId ?? null,
        }, {
          source: 'dailyDataStore.deleteTask',
        });
      }

      // ✅ 목표 연결 시 진행률 재계산
      if (deletedTask?.goalId && deletedTask.timeBlock !== null && currentDate === today) {
        await useGoalStore.getState().recalculateProgress(deletedTask.goalId, today);
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to delete task, rolling back:', err);
      // ❌ Rollback
      set(createRollbackState(dailyData, originalTasks, err as Error));
      throw err;
    }
  },

  /**
   * Task 완료 토글 (모바일/인박스에 위임)
   */
  toggleTaskCompletion: async (taskId: string) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');
    const today = getLocalDate();

    const originalTasks = dailyData.tasks;
    const originalBlockStates = dailyData.timeBlockStates;

    try {
      const taskInDaily = dailyData.tasks.find(t => t.id === taskId);
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
        const inboxTask = await db.globalInbox.get(taskId);
        if (!inboxTask) {
          throw new Error(`Task not found: ${taskId}`);
        }
        wasCompleted = inboxTask.completed;
      }

      const updatedTask = await toggleTaskInRepo(taskId, currentDate);

      // Task completion 처리
      let result: any = null;
      if (!wasCompleted && updatedTask.completed) {
        if (taskInDaily && updatedTask.timeBlock) {
          blockState = dailyData.timeBlockStates[updatedTask.timeBlock];
          blockTasks = optimisticTasks.filter(t => t.timeBlock === updatedTask.timeBlock);
        }

        result = await taskCompletionService.handleTaskCompletion({
          task: updatedTask,
          wasCompleted,
          date: currentDate,
          blockState,
          blockTasks,
        });

        // 🔄 GameState 갱신을 이벤트 버스로 요청 (순환 의존성 해소)
        eventBus.emit('gameState:refreshRequest', {
          reason: 'task_completion',
        }, {
          source: 'dailyDataStore.toggleTaskCompletion',
        });

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

        // 📊 Reality Check Trigger - 이벤트 버스로 요청 (순환 의존성 해소)
        // Only trigger for tasks with a duration > 10 mins to avoid spam
        if (updatedTask.adjustedDuration >= 10) {
          eventBus.emit('realityCheck:request', {
            taskId: updatedTask.id,
            taskTitle: updatedTask.text,
            estimatedDuration: updatedTask.adjustedDuration,
          }, {
            source: 'dailyDataStore.toggleTaskCompletion',
          });
        }

        // 🎉 Event Bus: task:completed 이벤트 발행
        eventBus.emit('task:completed', {
          taskId: updatedTask.id,
          xpEarned: result?.xpEarned || 0,
          isPerfectBlock: result?.isPerfectBlock || false,
          blockId: updatedTask.timeBlock || undefined,
          goalId: updatedTask.goalId || undefined,
          adjustedDuration: updatedTask.adjustedDuration,
        }, {
          source: 'dailyDataStore.toggleTaskCompletion',
        });
      }

      // 🔄 Task 완료 취소 처리 - XP 회수
      if (wasCompleted && !updatedTask.completed) {
        const xpToDeduct = calculateTaskXP(updatedTask);

        // XP 차감 (음수로 addXP 호출)
        const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
        await useGameStateStore.getState().addXP(-xpToDeduct, updatedTask.timeBlock || undefined, true);

        // 🔄 GameState 갱신 요청
        eventBus.emit('gameState:refreshRequest', {
          reason: 'task_uncomplete',
        }, {
          source: 'dailyDataStore.toggleTaskCompletion',
        });

        // 🎉 Event Bus: task:uncompleted 이벤트 발행
        eventBus.emit('task:uncompleted', {
          taskId: updatedTask.id,
          xpDeducted: xpToDeduct,
          blockId: updatedTask.timeBlock || undefined,
        }, {
          source: 'dailyDataStore.toggleTaskCompletion',
        });
      }

      // Goal 진행률 이벤트 (Goal Subscriber가 처리)
      if (updatedTask.goalId && updatedTask.timeBlock !== null && currentDate === today) {
        eventBus.emit('goal:progressChanged', {
          goalId: updatedTask.goalId,
          taskId: updatedTask.id,
          action: 'completed',
        }, {
          source: 'dailyDataStore.toggleTaskCompletion',
        });
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle task completion, rolling back:', err);
      set(createFullRollbackState(dailyData, originalTasks, originalBlockStates, err as Error));
      throw err;
    }
  },

  // ============================================================================
  // TimeBlock 상태 관리
  // ============================================================================

  /**
   * 블록 상태 업데이트
   */
  updateBlockState: async (blockId: string, updates: Partial<TimeBlockState>) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    // 원본 백업
    const originalBlockStates = dailyData.timeBlockStates;

    // ✅ Optimistic Update
    set(createOptimisticBlockUpdate(dailyData, blockId, updates));

    try {
      // ✅ Repository 호출
      await updateBlockStateInRepo(blockId, updates, currentDate);
    } catch (err) {
      console.error('[DailyDataStore] Failed to update block state, rolling back:', err);
      // ❌ Rollback
      set(createBlockRollbackState(dailyData, originalBlockStates, err as Error));
      throw err;
    }
  },

  /**
   * 블록 잠금 토글 (XP 관리 포함)
   */
  toggleBlockLock: async (blockId: string) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    // 원본 백업
    const originalBlockStates = dailyData.timeBlockStates;

    try {
      let blockState = dailyData.timeBlockStates[blockId];
      const blockTasks = dailyData.tasks.filter(t => t.timeBlock === blockId);

      if (!blockState) {
        console.warn(`[DailyDataStore] Block state not found for ${blockId}, initializing default.`);
        blockState = { isLocked: false, isPerfect: false, isFailed: false };
      }

      // 잠금 → 해제 (40 XP 패널티)
      if (blockState.isLocked) {
        const confirmUnlock = confirm(
          '⚠️ 블록 잠금을 해제하시겠습니까?\n\n' +
          '- 40 XP를 소모합니다.\n\n' +
          '정말로 해제하시겠습니까?'
        );

        if (!confirmUnlock) return;

        // ✅ Optimistic Update
        set(createOptimisticBlockUpdate(dailyData, blockId, { isLocked: false }));

        // ✅ XP 소비를 이벤트 버스로 요청 (순환 의존성 해소)
        eventBus.emit('block:unlocked', {
          blockId,
          xpCost: 40,
        }, {
          source: 'dailyDataStore.toggleBlockLock',
        });
        await updateBlockStateInRepo(blockId, { isLocked: false }, currentDate);
      }
      // 해제 → 잠금 (무료)
      else {
        if (blockTasks.length === 0) {
          throw new Error('작업이 없는 블록은 잠금할 수 없습니다.');
        }

        // ✅ Optimistic Update
        set(createOptimisticBlockUpdate(dailyData, blockId, { isLocked: true }));

        // ✅ Repository 호출
        await updateBlockStateInRepo(blockId, { isLocked: true }, currentDate);
        
        // ✅ 블록 잠금 이벤트 발행 (순환 의존성 해소)
        eventBus.emit('block:locked', {
          blockId,
          taskCount: blockTasks.length,
        }, {
          source: 'dailyDataStore.toggleBlockLock',
        });
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle block lock, rolling back:', err);
      // ❌ Rollback
      set(createBlockRollbackState(dailyData, originalBlockStates, err as Error));
      throw err;
    }
  },

  /**
   * 시간대 속성 태그 업데이트
   */
  setHourSlotTag: async (hour: number, tagId: string | null) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const prevTags = dailyData.hourSlotTags || {};
    const nextTags = { ...prevTags };
    if (tagId) {
      nextTags[hour] = tagId;
    } else {
      delete nextTags[hour];
    }

    const optimistic = createUpdatedDailyData(dailyData, { hourSlotTags: nextTags });
    set({ dailyData: optimistic });

    try {
      await saveDailyData(currentDate, dailyData.tasks, dailyData.timeBlockStates, nextTags);
    } catch (err) {
      // 롤백
      set({ dailyData });
      console.error('[DailyDataStore] Failed to update hour slot tag:', err);
      throw err;
    }
  },

  /**
   * 하지않기 체크리스트 항목 토글
   */
  toggleDontDoItem: async (blockId: string, itemId: string, xpReward: number) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const prevStatus = dailyData.timeBlockDontDoStatus || {};
    const blockStatus = prevStatus[blockId] || {};
    const wasChecked = blockStatus[itemId] || false;

    try {
      // 이미 체크된 경우 무시 (한번만 보상)
      if (wasChecked) {
        return;
      }

      // Optimistic Update
      const nextStatus = {
        ...prevStatus,
        [blockId]: {
          ...blockStatus,
          [itemId]: true,
        },
      };

      const optimistic = createUpdatedDailyData(dailyData, { timeBlockDontDoStatus: nextStatus });
      set({ dailyData: optimistic });

      // Repository 저장
      await saveDailyData(
        currentDate,
        dailyData.tasks,
        dailyData.timeBlockStates,
        dailyData.hourSlotTags,
        nextStatus
      );

      // XP 보상 지급 - 이벤트 버스로 요청 (순환 의존성 해소)
      eventBus.emit('xp:earned', {
        amount: xpReward,
        source: 'dont_do_check',
        blockId,
      }, {
        source: 'dailyDataStore.toggleDontDoItem',
      });
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle don\'t-do item, rolling back:', err);
      // Rollback
      set({ dailyData });
      throw err;
    }
  },

  // ============================================================================
  // 유틸리티
  // ============================================================================

  /**
   * 수동 갱신 (강제 리로드)
   */
  refresh: async () => {
    const { currentDate, loadData } = get();
    await loadData(currentDate, true);
  },

  /**
   * 상태 초기화
   */
  reset: () => {
    set({
      dailyData: null,
      currentDate: getLocalDate(),
      loading: false,
      error: null,
    });
  },
}));
