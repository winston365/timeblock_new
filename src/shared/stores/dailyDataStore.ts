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
  addXP,
  spendXP,
  updateQuestProgress,
  increaseAffectionFromTask,
} from '@/data/repositories';
import { getLocalDate, calculateTaskXP } from '../lib/utils';

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
    const { currentDate } = get();

    try {
      await saveDailyData(currentDate, tasks, timeBlockStates);
      set({ dailyData: { tasks, timeBlockStates, updatedAt: Date.now() } });
    } catch (err) {
      console.error('[DailyDataStore] Failed to save daily data:', err);
      set({ error: err as Error });
    }
  },

  // Task 추가
  addTask: async (task: Task) => {
    const { currentDate, loadData } = get();

    try {
      await addTaskToRepo(task, currentDate);
      await loadData(currentDate, true); // 강제 리로드
    } catch (err) {
      console.error('[DailyDataStore] Failed to add task:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // Task 업데이트
  updateTask: async (taskId: string, updates: Partial<Task>) => {
    const { currentDate, loadData } = get();

    try {
      await updateTaskInRepo(taskId, updates, currentDate);
      await loadData(currentDate, true); // 강제 리로드
    } catch (err) {
      console.error('[DailyDataStore] Failed to update task:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // Task 삭제
  deleteTask: async (taskId: string) => {
    const { currentDate, loadData } = get();

    try {
      await deleteTaskFromRepo(taskId, currentDate);
      await loadData(currentDate, true); // 강제 리로드
    } catch (err) {
      console.error('[DailyDataStore] Failed to delete task:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // Task 완료 토글
  toggleTaskCompletion: async (taskId: string) => {
    const { currentDate, loadData } = get();

    try {
      // 현재 task 상태 확인
      const currentData = await loadDailyData(currentDate);
      const task = currentData.tasks.find(t => t.id === taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const wasCompleted = task.completed;

      // Task 완료 토글
      const updatedTask = await toggleTaskInRepo(taskId, currentDate);

      // 완료 -> 미완료가 아니라, 미완료 -> 완료로 변경된 경우에만 XP & 퀘스트 & 와이푸 호감도 업데이트
      if (!wasCompleted && updatedTask.completed) {
        // XP 추가
        const xpAmount = calculateTaskXP(updatedTask);
        await addXP(xpAmount, updatedTask.timeBlock || undefined);

        // 퀘스트 업데이트
        await updateQuestProgress('complete_tasks', 1);
        await updateQuestProgress('earn_xp', xpAmount);

        // 와이푸 호감도 증가
        await increaseAffectionFromTask();

        // 잠금된 블록의 모든 작업이 완료되었는지 체크
        if (updatedTask.timeBlock) {
          const updatedData = await loadDailyData(currentDate);
          const blockState = updatedData.timeBlockStates[updatedTask.timeBlock];
          const blockTasks = updatedData.tasks.filter(t => t.timeBlock === updatedTask.timeBlock);
          const allCompleted = blockTasks.length > 0 && blockTasks.every(t => t.completed);

          // 잠금된 블록이고 모든 작업이 완료되었으면 +40XP
          if (blockState?.isLocked && allCompleted) {
            await addXP(40, updatedTask.timeBlock);
            // 완벽 블록 상태 업데이트
            await updateBlockStateInRepo(
              updatedTask.timeBlock,
              { isPerfect: true },
              currentDate
            );
            await updateQuestProgress('perfect_blocks', 1);
          }
        }
      }

      await loadData(currentDate, true); // 강제 리로드
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle task completion:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // 블록 상태 업데이트
  updateBlockState: async (blockId: string, updates: Partial<TimeBlockState>) => {
    const { currentDate, loadData } = get();

    try {
      await updateBlockStateInRepo(blockId, updates, currentDate);
      await loadData(currentDate, true); // 강제 리로드
    } catch (err) {
      console.error('[DailyDataStore] Failed to update block state:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // 블록 잠금 토글 (XP 관리 포함)
  toggleBlockLock: async (blockId: string) => {
    const { currentDate, loadData } = get();

    try {
      const currentData = await loadDailyData(currentDate);
      const blockState = currentData.timeBlockStates[blockId];
      const blockTasks = currentData.tasks.filter((t) => t.timeBlock === blockId);

      if (!blockState) {
        throw new Error(`Block state not found: ${blockId}`);
      }

      // 잠금 -> 해제
      if (blockState.isLocked) {
        // 잠금 해제 시 XP 변화 없음 (이미 베팅한 15 XP는 돌려받지 못함)

        // 블록 상태 업데이트 (잠금 해제)
        await updateBlockStateInRepo(
          blockId,
          { isLocked: false },
          currentDate
        );
      }
      // 해제 -> 잠금 (베팅)
      else {
        // 블록에 작업이 없으면 잠금 불가
        if (blockTasks.length === 0) {
          throw new Error('작업이 없는 블록은 잠금할 수 없습니다.');
        }

        // 잠금 설정 시 15 XP 소모 (베팅)
        await spendXP(15);

        // 블록 잠금
        await updateBlockStateInRepo(blockId, { isLocked: true }, currentDate);

        // 퀘스트 업데이트
        await updateQuestProgress('lock_blocks', 1);
      }

      await loadData(currentDate, true); // 강제 리로드
    } catch (err) {
      console.error('[DailyDataStore] Failed to toggle block lock:', err);
      set({ error: err as Error });
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
