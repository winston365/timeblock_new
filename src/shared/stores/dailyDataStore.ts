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
import { taskCompletionService } from '@/shared/services/taskCompletion';

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

  // 데이터 로드
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

  // 데이터 저장
  saveData: async (tasks: Task[], timeBlockStates: DailyData['timeBlockStates']) => {
    const { currentDate, dailyData } = get();

    try {
      await saveDailyData(currentDate, tasks, timeBlockStates);
      set({ dailyData: { tasks, goals: dailyData?.goals || [], timeBlockStates, updatedAt: Date.now() } });
    } catch (err) {
      console.error('[DailyDataStore] Failed to save daily data:', err);
      set({ error: err as Error });
    }
  },

  // Task 추가 (Optimistic Update 패턴)
  addTask: async (task: Task) => {
    const { currentDate, dailyData, loadData } = get();

    if (!dailyData) {
      console.error('[DailyDataStore] No dailyData available');
      return;
    }

    // ✅ Optimistic Update: UI 즉시 업데이트
    const optimisticData = {
      ...dailyData,
      tasks: [...dailyData.tasks, task],
      updatedAt: Date.now(),
    };
    set({ dailyData: optimisticData });

    // ✅ 백그라운드에서 DB 저장
    try {
      await addTaskToRepo(task, currentDate);

      // ✅ 목표 연결 시 진행률 자동 재계산
      if (task.goalId) {
        await recalculateGoalProgress(currentDate, task.goalId);
        // 강제 재로드로 최신 목표 데이터 반영
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to add task, rolling back:', err);
      // ❌ 실패 시 롤백 (DB에서 최신 데이터 다시 로드)
      await loadData(currentDate, true);
      set({ error: err as Error });
      throw err;
    }
  },

  // Task 업데이트 (Optimistic Update 패턴)
  updateTask: async (taskId: string, updates: Partial<Task>) => {
    const { currentDate, dailyData, loadData } = get();

    if (!dailyData) {
      console.error('[DailyDataStore] No dailyData available');
      return;
    }

    // 원본 데이터 백업 (롤백용)
    const originalTasks = dailyData.tasks;
    const originalTask = dailyData.tasks.find(t => t.id === taskId);

    // 작업이 dailyData.tasks에 없는 경우 (globalInbox에 있음)
    if (!originalTask && updates.timeBlock !== null) {
      // 인박스→타임블록 이동: DB 업데이트 후 강제 재로드
      console.log('[DailyDataStore] Task not in dailyData, moving from inbox to timeblock');

      try {
        await updateTaskInRepo(taskId, updates, currentDate);
        // 강제 재로드로 UI 업데이트
        await loadData(currentDate, true);
      } catch (err) {
        console.error('[DailyDataStore] Failed to move task from inbox:', err);
        set({ error: err as Error });
        throw err;
      }
      return;
    }

    // 타임블록→인박스 이동 또는 타임블록 내 이동
    // ✅ Optimistic Update: UI 즉시 업데이트
    const optimisticTasks = dailyData.tasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    );

    // 타임블록→인박스 이동의 경우 tasks 배열에서 제거
    const finalTasks = updates.timeBlock === null && originalTask?.timeBlock !== null
      ? optimisticTasks.filter(t => t.id !== taskId)
      : optimisticTasks;

    set({
      dailyData: {
        ...dailyData,
        tasks: finalTasks,
        updatedAt: Date.now(),
      },
    });

    // ✅ 백그라운드에서 DB 저장
    try {
      await updateTaskInRepo(taskId, updates, currentDate);

      // ✅ 목표 연결 변경 시 진행률 자동 재계산
      const affectedGoalIds = new Set<string>();
      if (originalTask?.goalId) affectedGoalIds.add(originalTask.goalId);
      if (updates.goalId) affectedGoalIds.add(updates.goalId);

      if (affectedGoalIds.size > 0) {
        for (const goalId of affectedGoalIds) {
          await recalculateGoalProgress(currentDate, goalId);
        }
        // 강제 재로드로 최신 목표 데이터 반영
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to update task, rolling back:', err);
      // ❌ 실패 시 롤백
      set({
        dailyData: {
          ...dailyData,
          tasks: originalTasks,
          updatedAt: Date.now(),
        },
        error: err as Error,
      });
      throw err;
    }
  },

  // Task 삭제 (Optimistic Update 패턴)
  deleteTask: async (taskId: string) => {
    const { currentDate, dailyData, loadData } = get();

    if (!dailyData) {
      console.error('[DailyDataStore] No dailyData available');
      return;
    }

    // 원본 데이터 백업 (롤백용)
    const originalTasks = dailyData.tasks;
    const deletedTask = dailyData.tasks.find(t => t.id === taskId);

    // ✅ Optimistic Update: UI 즉시 업데이트
    const optimisticTasks = dailyData.tasks.filter(task => task.id !== taskId);
    set({
      dailyData: {
        ...dailyData,
        tasks: optimisticTasks,
        updatedAt: Date.now(),
      },
    });

    // ✅ 백그라운드에서 DB 삭제
    try {
      await deleteTaskFromRepo(taskId, currentDate);

      // ✅ 목표 연결 시 진행률 자동 재계산
      if (deletedTask?.goalId) {
        await recalculateGoalProgress(currentDate, deletedTask.goalId);
        // 강제 재로드로 최신 목표 데이터 반영
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to delete task, rolling back:', err);
      // ❌ 실패 시 롤백
      set({
        dailyData: {
          ...dailyData,
          tasks: originalTasks,
          updatedAt: Date.now(),
        },
        error: err as Error,
      });
      throw err;
    }
  },

  // Task 완료 토글 (Optimistic Update 패턴 + 서비스 레이어 분리)
  toggleTaskCompletion: async (taskId: string) => {
    const { currentDate, dailyData, loadData } = get();

    if (!dailyData) {
      console.error('[DailyDataStore] No dailyData available');
      return;
    }

    // 원본 데이터 백업 (롤백용)
    const originalTasks = dailyData.tasks;
    const originalBlockStates = dailyData.timeBlockStates;

    try {
      // 현재 task 상태 확인
      const task = dailyData.tasks.find(t => t.id === taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const wasCompleted = task.completed;

      // ✅ Optimistic Update: Task 완료 상태 즉시 변경
      const optimisticTasks = dailyData.tasks.map(t =>
        t.id === taskId
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
          : t
      );
      set({
        dailyData: {
          ...dailyData,
          tasks: optimisticTasks,
          updatedAt: Date.now(),
        },
      });

      // ✅ 백그라운드에서 DB 업데이트
      const updatedTask = await toggleTaskInRepo(taskId, currentDate);

      // ✅ 완료 처리 (미완료 -> 완료인 경우에만)
      if (!wasCompleted && updatedTask.completed) {
        // 블록 상태 및 작업 정보 준비
        const blockState = updatedTask.timeBlock
          ? dailyData.timeBlockStates[updatedTask.timeBlock]
          : undefined;
        const blockTasks = updatedTask.timeBlock
          ? optimisticTasks.filter(t => t.timeBlock === updatedTask.timeBlock)
          : undefined;

        // 🎯 TaskCompletionService에 위임 (모든 부수효과 처리)
        const result = await taskCompletionService.handleTaskCompletion({
          task: updatedTask,
          wasCompleted,
          date: currentDate,
          blockState,
          blockTasks,
        });

        // 완벽한 블록 달성 시 UI 상태 업데이트
        if (result.isPerfectBlock && updatedTask.timeBlock && blockState) {
          set({
            dailyData: {
              ...dailyData,
              tasks: optimisticTasks,
              timeBlockStates: {
                ...dailyData.timeBlockStates,
                [updatedTask.timeBlock]: {
                  ...blockState,
                  isPerfect: true,
                },
              },
              updatedAt: Date.now(),
            },
          });
        }

        console.log('[DailyDataStore] ✅ Task completion processed:', result);
      }

      // ✅ 목표 연결 시 진행률 자동 재계산 및 Store 갱신
      if (updatedTask.goalId) {
        await recalculateGoalProgress(currentDate, updatedTask.goalId);
        // 강제 재로드로 최신 목표 데이터 반영
        await loadData(currentDate, true);
      }
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle task completion, rolling back:', err);
      // ❌ 실패 시 롤백
      set({
        dailyData: {
          ...dailyData,
          tasks: originalTasks,
          timeBlockStates: originalBlockStates,
          updatedAt: Date.now(),
        },
        error: err as Error,
      });
      throw err;
    }
  },

  // 블록 상태 업데이트 (Optimistic Update 패턴)
  updateBlockState: async (blockId: string, updates: Partial<TimeBlockState>) => {
    const { currentDate, dailyData } = get();

    if (!dailyData) {
      console.error('[DailyDataStore] No dailyData available');
      return;
    }

    // 원본 데이터 백업 (롤백용)
    const originalBlockStates = dailyData.timeBlockStates;

    // ✅ Optimistic Update: 블록 상태 즉시 변경
    const currentBlockState = dailyData.timeBlockStates[blockId] || {
      isLocked: false,
      isPerfect: false,
      isFailed: false,
    };
    set({
      dailyData: {
        ...dailyData,
        timeBlockStates: {
          ...dailyData.timeBlockStates,
          [blockId]: { ...currentBlockState, ...updates },
        },
        updatedAt: Date.now(),
      },
    });

    // ✅ 백그라운드에서 DB 저장
    try {
      await updateBlockStateInRepo(blockId, updates, currentDate);
    } catch (err) {
      console.error('[DailyDataStore] Failed to update block state, rolling back:', err);
      // ❌ 실패 시 롤백
      set({
        dailyData: {
          ...dailyData,
          timeBlockStates: originalBlockStates,
          updatedAt: Date.now(),
        },
        error: err as Error,
      });
      throw err;
    }
  },

  // 블록 잠금 토글 (XP 관리 포함, Optimistic Update 패턴)
  toggleBlockLock: async (blockId: string) => {
    const { currentDate, dailyData } = get();

    if (!dailyData) {
      console.error('[DailyDataStore] No dailyData available');
      return;
    }

    // 원본 데이터 백업 (롤백용) - try 블록 밖에서 선언
    const originalBlockStates = dailyData.timeBlockStates;

    try {
      const blockState = dailyData.timeBlockStates[blockId];
      const blockTasks = dailyData.tasks.filter((t) => t.timeBlock === blockId);

      if (!blockState) {
        throw new Error(`Block state not found: ${blockId}`);
      }

      // 잠금 -> 해제
      if (blockState.isLocked) {
        // 잠금 해제 시 40 XP 추가 소모 (베팅한 15 XP + 패널티 40 XP)
        const confirmUnlock = confirm(
          '⚠️ 블록 잠금을 해제하시겠습니까?\n\n' +
          '- 베팅한 15 XP는 돌려받지 못합니다.\n' +
          '- 추가로 40 XP를 소모합니다. (총 손실: 55 XP)\n\n' +
          '정말로 해제하시겠습니까?'
        );

        if (!confirmUnlock) {
          return; // 사용자가 취소하면 아무것도 하지 않음
        }

        // ✅ Optimistic Update: 블록 잠금 즉시 해제
        set({
          dailyData: {
            ...dailyData,
            timeBlockStates: {
              ...dailyData.timeBlockStates,
              [blockId]: { ...blockState, isLocked: false },
            },
            updatedAt: Date.now(),
          },
        });

        // ✅ 백그라운드에서 XP 소모 및 DB 저장
        await spendXP(40);
        await updateBlockStateInRepo(blockId, { isLocked: false }, currentDate);
      }
      // 해제 -> 잠금 (베팅)
      else {
        // 블록에 작업이 없으면 잠금 불가
        if (blockTasks.length === 0) {
          throw new Error('작업이 없는 블록은 잠금할 수 없습니다.');
        }

        // ✅ Optimistic Update: 블록 즉시 잠금
        set({
          dailyData: {
            ...dailyData,
            timeBlockStates: {
              ...dailyData.timeBlockStates,
              [blockId]: { ...blockState, isLocked: true },
            },
            updatedAt: Date.now(),
          },
        });

        // ✅ 백그라운드에서 XP 소모 및 DB 저장
        await spendXP(15);
        await updateBlockStateInRepo(blockId, { isLocked: true }, currentDate);
        await updateQuestProgress('lock_blocks', 1);
      }

      // ✅ DB 재조회 제거
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle block lock, rolling back:', err);
      // ❌ 실패 시 롤백
      set({
        dailyData: {
          ...dailyData,
          timeBlockStates: originalBlockStates,
          updatedAt: Date.now(),
        },
        error: err as Error,
      });
      throw err;
    }
  },

  // 수동 갱신 (강제 리로드)
  refresh: async () => {
    const { currentDate, loadData } = get();
    await loadData(currentDate, true); // force=true
  },

  // 상태 초기화
  reset: () => {
    set({
      dailyData: null,
      currentDate: getLocalDate(),
      loading: false,
      error: null,
    });
  },
}));
