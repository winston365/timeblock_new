/**
 * DailyData Zustand Store
 *
 * @role 일일 데이터(작업, 블록 상태)의 전역 상태 관리 및 동기화 중복 방지
 * @input 날짜, 작업 CRUD 요청, 블록 상태 업데이트 요청
 * @output 일일 데이터 상태, CRUD 함수, 로딩/에러 상태
 * @external_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - repositories: 작업, 블록, XP, 퀘스트, 와이푸 데이터 레포지토리
 *   - utils: 날짜 및 XP 계산 유틸리티
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
  spendXP,
  updateQuestProgress,
  recalculateGoalProgress,
} from '@/data/repositories';
import { getLocalDate } from '../lib/utils';
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
  findTaskOrThrow,
} from '../lib/storeUtils';
import { taskCompletionService } from '@/shared/services/taskCompletion';
import { db } from '@/data/db/dexieClient';

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
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string) => Promise<void>;
  updateBlockState: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
  toggleBlockLock: (blockId: string) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
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
      await saveDailyData(currentDate, tasks, timeBlockStates);
      set({
        dailyData: {
          tasks,
          goals: dailyData?.goals || [],
          timeBlockStates,
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

    // ✅ Optimistic Update
    const optimisticTasks = addTaskToArray(dailyData.tasks, task);
    set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

    try {
      // ✅ Repository 호출
      await addTaskToRepo(task, currentDate);

      // ✅ 목표 연결 시 진행률 재계산
      if (task.goalId) {
        await recalculateGoalProgress(currentDate, task.goalId);
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
  updateTask: async (taskId: string, updates: Partial<Task>) => {
    const { currentDate, dailyData, loadData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

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
    if (inboxTask && sanitizedUpdates.timeBlock !== null && sanitizedUpdates.timeBlock !== undefined) {
      isInboxToBlockMove = true;
    } else if (originalTask && sanitizedUpdates.timeBlock === null && originalTask.timeBlock !== null) {
      isBlockToInboxMove = true;
    }

    // ✅ Optimistic Update (inbox ↔ block 이동은 제외)
    if (!isInboxToBlockMove && !isBlockToInboxMove) {
      const optimisticTasks = updateTaskInArray(dailyData.tasks, taskId, sanitizedUpdates);
      set(createOptimisticTaskUpdate(dailyData, optimisticTasks));
    } else {
      console.log('[DailyDataStore] Skipping Optimistic Update for inbox ↔ timeBlock move', {
        taskId,
        isInboxToBlockMove,
        isBlockToInboxMove,
      });
    }

    try {
      // ✅ Repository 호출
      await updateTaskInRepo(taskId, sanitizedUpdates, currentDate);

      // 🔹 inbox ↔ timeBlock 이동 시 강제 새로고침
      if (isInboxToBlockMove || isBlockToInboxMove) {
        await loadData(currentDate, true);
      }

      // ✅ 목표 연결 변경 시 진행률 재계산
      const affectedGoalIds = new Set<string>();
      if (originalTask?.goalId) affectedGoalIds.add(originalTask.goalId);
      if (sanitizedUpdates.goalId) affectedGoalIds.add(sanitizedUpdates.goalId);

      if (affectedGoalIds.size > 0) {
        for (const goalId of affectedGoalIds) {
          await recalculateGoalProgress(currentDate, goalId);
        }
        await loadData(currentDate, true);
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

    // 원본 백업
    const originalTasks = dailyData.tasks;
    const deletedTask = dailyData.tasks.find(t => t.id === taskId);

    // ✅ Optimistic Update
    const optimisticTasks = removeTaskFromArray(dailyData.tasks, taskId);
    set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

    try {
      // ✅ Repository 호출
      await deleteTaskFromRepo(taskId, currentDate);

      // ✅ 목표 연결 시 진행률 재계산
      if (deletedTask?.goalId) {
        await recalculateGoalProgress(currentDate, deletedTask.goalId);
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
   * Task 완료 토글 (서비스 레이어에 위임)
   */
  toggleTaskCompletion: async (taskId: string) => {
    const { currentDate, dailyData, loadData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    console.log('[DailyDataStore] 🎯 toggleTaskCompletion called', { taskId, currentDate });

    // 원본 백업
    const originalTasks = dailyData.tasks;
    const originalBlockStates = dailyData.timeBlockStates;

    try {
      // Task 확인
      const task = findTaskOrThrow(dailyData.tasks, taskId);
      const wasCompleted = task.completed;

      console.log('[DailyDataStore] 📋 Task found', {
        taskId: task.id,
        text: task.text,
        wasCompleted,
        timeBlock: task.timeBlock
      });

      // ✅ Optimistic Update
      const optimisticTasks = updateTaskInArray(dailyData.tasks, taskId, {
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null,
      });
      set(createOptimisticTaskUpdate(dailyData, optimisticTasks));

      console.log('[DailyDataStore] 🔄 Calling toggleTaskInRepo...');

      // ✅ Repository 호출
      const updatedTask = await toggleTaskInRepo(taskId, currentDate);

      console.log('[DailyDataStore] ✅ toggleTaskInRepo returned', {
        taskId: updatedTask.id,
        completed: updatedTask.completed,
        wasCompleted,
        willCallService: !wasCompleted && updatedTask.completed
      });

      // ✅ 완료 처리 (미완료 → 완료만)
      if (!wasCompleted && updatedTask.completed) {
        console.log('[DailyDataStore] 🎮 Calling taskCompletionService...');
        const blockState = updatedTask.timeBlock
          ? dailyData.timeBlockStates[updatedTask.timeBlock]
          : undefined;
        const blockTasks = updatedTask.timeBlock
          ? optimisticTasks.filter(t => t.timeBlock === updatedTask.timeBlock)
          : undefined;

        // 🎯 TaskCompletionService에 위임
        const result = await taskCompletionService.handleTaskCompletion({
          task: updatedTask,
          wasCompleted,
          date: currentDate,
          blockState,
          blockTasks,
        });

        // ✅ GameStateStore 강제 새로고침
        const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
        await useGameStateStore.getState().refresh();

        // 완벽한 블록 달성 시 UI 업데이트
        if (result.isPerfectBlock && updatedTask.timeBlock && blockState) {
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

        console.log('[DailyDataStore] ✅ Task completion processed:', result);
      } else {
        console.log('[DailyDataStore] ⏭️ Skipping taskCompletionService', {
          wasCompleted,
          'updatedTask.completed': updatedTask.completed,
          reason: wasCompleted ? 'Task was already completed' : 'Task is not completed after toggle'
        });
      }

      // ✅ 목표 연결 시 진행률 재계산
      if (updatedTask.goalId) {
        await recalculateGoalProgress(currentDate, updatedTask.goalId);
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle task completion, rolling back:', err);
      // ❌ Rollback (Task + BlockState)
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
      const blockState = dailyData.timeBlockStates[blockId];
      const blockTasks = dailyData.tasks.filter(t => t.timeBlock === blockId);

      if (!blockState) {
        throw new Error(`Block state not found: ${blockId}`);
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

        // ✅ Repository 호출
        await spendXP(40);
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
        await updateQuestProgress('lock_blocks', 1);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle block lock, rolling back:', err);
      // ❌ Rollback
      set(createBlockRollbackState(dailyData, originalBlockStates, err as Error));
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
