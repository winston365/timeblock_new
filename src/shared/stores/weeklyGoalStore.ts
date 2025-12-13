/**
 * Weekly Goal Zustand Store
 *
 * @role 장기목표(주간목표) 전역 상태 관리
 * @input 목표 CRUD 요청, 진행도 업데이트
 * @output 목표 상태 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - weeklyGoalRepository: 데이터 영속성 관리
 *   - storeUtils: 비동기 액션 래퍼
 */

import { create } from 'zustand';
import type { WeeklyGoal } from '@/shared/types/domain';
import {
  loadWeeklyGoals,
  addWeeklyGoal,
  updateWeeklyGoal,
  deleteWeeklyGoal,
  updateWeeklyGoalProgress,
  setWeeklyGoalProgress,
  reorderWeeklyGoals,
  getDayOfWeekIndex,
  getTodayTarget,
  getRemainingDays,
  getDailyTargetForToday,
} from '@/data/repositories/weeklyGoalRepository';
import { withAsyncAction } from '@/shared/lib/storeUtils';

interface WeeklyGoalStore {
  // 상태
  goals: WeeklyGoal[];
  loading: boolean;
  error: Error | null;

  // 액션
  loadGoals: () => Promise<void>;
  addGoal: (data: Omit<WeeklyGoal, 'id' | 'createdAt' | 'updatedAt' | 'currentProgress' | 'weekStartDate' | 'history' | 'order'>) => Promise<WeeklyGoal | undefined>;
  updateGoal: (goalId: string, updates: Partial<WeeklyGoal>) => Promise<WeeklyGoal | undefined>;
  deleteGoal: (goalId: string) => Promise<void>;
  reorderGoals: (goals: WeeklyGoal[]) => Promise<void>;

  // 진행도 관련
  updateProgress: (goalId: string, delta: number) => Promise<WeeklyGoal | undefined>;
  setProgress: (goalId: string, progress: number) => Promise<WeeklyGoal | undefined>;

  // 유틸리티 (계산 함수)
  getDayOfWeekIndex: () => number;
  getTodayTarget: (target: number) => number;
  getRemainingDays: () => number;
  getDailyTargetForToday: (target: number, currentProgress: number) => number;

  // 리프레시/리셋
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * 장기목표(주간목표) 상태 스토어
 *
 * @description 주간목표 CRUD 및 진행도 관리를 위한 Zustand 스토어
 */
export const useWeeklyGoalStore = create<WeeklyGoalStore>((set, get) => ({
  goals: [],
  loading: false,
  error: null,

  loadGoals: async () => {
    return withAsyncAction(set, async () => {
      const loadedGoals = await loadWeeklyGoals();
      set({ goals: [...loadedGoals].sort((a, b) => a.order - b.order) });
    }, { errorPrefix: 'WeeklyGoalStore: loadGoals', rethrow: false });
  },

  addGoal: async (data) => {
    return withAsyncAction(set, async () => {
      const newGoal = await addWeeklyGoal(data);

      const currentGoals = get().goals;
      set({
        goals: [...currentGoals, newGoal].sort((a, b) => a.order - b.order)
      });

      return newGoal;
    }, { errorPrefix: 'WeeklyGoalStore: addGoal' });
  },

  updateGoal: async (goalId, updates) => {
    return withAsyncAction(set, async () => {
      const updatedGoal = await updateWeeklyGoal(goalId, updates);

      const currentGoals = get().goals;
      set({
        goals: currentGoals.map(g => g.id === goalId ? updatedGoal : g)
      });

      return updatedGoal;
    }, { errorPrefix: 'WeeklyGoalStore: updateGoal' });
  },

  deleteGoal: async (goalId) => {
    return withAsyncAction(set, async () => {
      await deleteWeeklyGoal(goalId);

      const currentGoals = get().goals;
      set({
        goals: currentGoals.filter(g => g.id !== goalId)
      });
    }, { errorPrefix: 'WeeklyGoalStore: deleteGoal' });
  },

  reorderGoals: async (goals) => {
    return withAsyncAction(set, async () => {
      await reorderWeeklyGoals(goals);
      set({ goals: [...goals].sort((a, b) => a.order - b.order) });
    }, { errorPrefix: 'WeeklyGoalStore: reorderGoals' });
  },

  updateProgress: async (goalId, delta) => {
    return withAsyncAction(set, async () => {
      const updatedGoal = await updateWeeklyGoalProgress(goalId, delta);

      const currentGoals = get().goals;
      set({
        goals: currentGoals.map(g => g.id === goalId ? updatedGoal : g)
      });

      return updatedGoal;
    }, { errorPrefix: 'WeeklyGoalStore: updateProgress' });
  },

  setProgress: async (goalId, progress) => {
    return withAsyncAction(set, async () => {
      const updatedGoal = await setWeeklyGoalProgress(goalId, progress);

      const currentGoals = get().goals;
      set({
        goals: currentGoals.map(g => g.id === goalId ? updatedGoal : g)
      });

      return updatedGoal;
    }, { errorPrefix: 'WeeklyGoalStore: setProgress' });
  },

  // 유틸리티 함수 (스토어에서 편리하게 사용)
  getDayOfWeekIndex: () => getDayOfWeekIndex(),
  getTodayTarget: (target: number) => getTodayTarget(target),
  getRemainingDays: () => getRemainingDays(),
  getDailyTargetForToday: (target: number, currentProgress: number) => getDailyTargetForToday(target, currentProgress),

  refresh: async () => {
    await get().loadGoals();
  },

  reset: () => {
    set({ goals: [], loading: false, error: null });
  },
}));
