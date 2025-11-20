/**
 * Goal Zustand Store
 *
 * @role 전역 목표 상태 관리
 * @input 목표 CRUD 요청
 * @output 목표 상태 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - globalGoalRepository: 데이터 영속성 관리
 */

import { create } from 'zustand';
import type { DailyGoal } from '@/shared/types/domain';
import {
    loadGlobalGoals,
    addGlobalGoal,
    updateGlobalGoal,
    deleteGlobalGoal,
    reorderGlobalGoals,
    recalculateGlobalGoalProgress,
} from '@/data/repositories/globalGoalRepository';

interface GoalStore {
    // 상태
    goals: DailyGoal[];
    loading: boolean;
    error: Error | null;

    // 액션
    loadGoals: () => Promise<void>;
    addGoal: (data: Omit<DailyGoal, 'id' | 'createdAt' | 'updatedAt' | 'plannedMinutes' | 'completedMinutes' | 'order'>) => Promise<DailyGoal>;
    updateGoal: (goalId: string, updates: Partial<DailyGoal>) => Promise<DailyGoal>;
    deleteGoal: (goalId: string) => Promise<void>;
    reorderGoals: (goals: DailyGoal[]) => Promise<void>;
    recalculateProgress: (goalId: string, date: string) => Promise<void>;
    refresh: () => Promise<void>;
    reset: () => void;
}

/**
 * 전역 목표 상태 스토어
 */
export const useGoalStore = create<GoalStore>((set, get) => ({
    goals: [],
    loading: false,
    error: null,

    loadGoals: async () => {
        set({ loading: true, error: null });
        try {
            const goals = await loadGlobalGoals();
            set({ goals: goals.sort((a, b) => a.order - b.order), loading: false });
        } catch (error) {
            console.error('GoalStore: Failed to load goals', error);
            set({ error: error as Error, loading: false });
        }
    },

    addGoal: async (data) => {
        set({ loading: true, error: null });
        try {
            const newGoal = await addGlobalGoal(data);

            // 낙관적 업데이트: 즉시 스토어에 추가
            const currentGoals = get().goals;
            set({
                goals: [...currentGoals, newGoal].sort((a, b) => a.order - b.order),
                loading: false
            });

            return newGoal;
        } catch (error) {
            console.error('GoalStore: Failed to add goal', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    updateGoal: async (goalId, updates) => {
        set({ loading: true, error: null });
        try {
            const updatedGoal = await updateGlobalGoal(goalId, updates);

            // 낙관적 업데이트: 즉시 스토어에 반영
            const currentGoals = get().goals;
            set({
                goals: currentGoals.map(g => g.id === goalId ? updatedGoal : g),
                loading: false
            });

            return updatedGoal;
        } catch (error) {
            console.error('GoalStore: Failed to update goal', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    deleteGoal: async (goalId) => {
        set({ loading: true, error: null });
        try {
            await deleteGlobalGoal(goalId);

            // 낙관적 업데이트: 즉시 스토어에서 제거
            const currentGoals = get().goals;
            set({
                goals: currentGoals.filter(g => g.id !== goalId),
                loading: false
            });
        } catch (error) {
            console.error('GoalStore: Failed to delete goal', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    reorderGoals: async (goals) => {
        set({ loading: true, error: null });
        try {
            await reorderGlobalGoals(goals);

            // 낙관적 업데이트: 즉시 스토어에 반영
            set({ goals: goals.sort((a, b) => a.order - b.order), loading: false });
        } catch (error) {
            console.error('GoalStore: Failed to reorder goals', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    recalculateProgress: async (goalId, date) => {
        try {
            const updatedGoal = await recalculateGlobalGoalProgress(goalId, date);

            // 낙관적 업데이트: 진행률 업데이트
            const currentGoals = get().goals;
            set({
                goals: currentGoals.map(g => g.id === goalId ? updatedGoal : g)
            });
        } catch (error) {
            console.error('GoalStore: Failed to recalculate progress', error);
            // 진행률 재계산 실패는 치명적이지 않으므로 error 상태는 설정하지 않음
        }
    },

    refresh: async () => {
        await get().loadGoals();
    },

    reset: () => {
        set({ goals: [], loading: false, error: null });
    },
}));
