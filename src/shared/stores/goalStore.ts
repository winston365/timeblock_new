/**
 * Goal Zustand Store
 *
 * @role 전역 목표 상태 관리
 * @input 목표 CRUD 요청
 * @output 목표 상태 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - globalGoalRepository: 데이터 영속성 관리
 *   - storeUtils: 비동기 액션 래퍼
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
import { withAsyncAction, withBackgroundAction } from '@/shared/lib/storeUtils';

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
 *
 * @description 목표 CRUD 및 진행률 관리를 위한 Zustand 스토어
 * @returns {GoalStore} 목표 상태 및 액션 객체
 *   - goals: 현재 목표 목록
 *   - loading: 로딩 상태
 *   - error: 에러 상태
 *   - loadGoals: 목표 로드
 *   - addGoal: 목표 추가
 *   - updateGoal: 목표 수정
 *   - deleteGoal: 목표 삭제
 *   - reorderGoals: 목표 순서 변경
 *   - recalculateProgress: 진행률 재계산
 *   - refresh: 목표 새로고침
 *   - reset: 스토어 초기화
 */
export const useGoalStore = create<GoalStore>((set, get) => ({
    goals: [],
    loading: false,
    error: null,

    loadGoals: async () => {
        return withAsyncAction(set, async () => {
            const loadedGoals = await loadGlobalGoals();
            set({ goals: loadedGoals.sort((goalA, goalB) => goalA.order - goalB.order) });
        }, { errorPrefix: 'GoalStore: loadGoals', rethrow: false });
    },

    addGoal: async (data) => {
        return withAsyncAction(set, async () => {
            const newGoal = await addGlobalGoal(data);

            // 낙관적 업데이트: 즉시 스토어에 추가
            const currentGoals = get().goals;
            set({
                goals: [...currentGoals, newGoal].sort((goalA, goalB) => goalA.order - goalB.order)
            });

            return newGoal;
        }, { errorPrefix: 'GoalStore: addGoal' });
    },

    updateGoal: async (goalId, updates) => {
        return withAsyncAction(set, async () => {
            const updatedGoal = await updateGlobalGoal(goalId, updates);

            // 낙관적 업데이트: 즉시 스토어에 반영
            const currentGoals = get().goals;
            set({
                goals: currentGoals.map(existingGoal => existingGoal.id === goalId ? updatedGoal : existingGoal)
            });

            return updatedGoal;
        }, { errorPrefix: 'GoalStore: updateGoal' });
    },

    deleteGoal: async (goalId) => {
        return withAsyncAction(set, async () => {
            await deleteGlobalGoal(goalId);

            // 낙관적 업데이트: 즉시 스토어에서 제거
            const currentGoals = get().goals;
            set({
                goals: currentGoals.filter(existingGoal => existingGoal.id !== goalId)
            });
        }, { errorPrefix: 'GoalStore: deleteGoal' });
    },

    reorderGoals: async (goals) => {
        return withAsyncAction(set, async () => {
            await reorderGlobalGoals(goals);

            // 낙관적 업데이트: 즉시 스토어에 반영
            set({ goals: goals.sort((goalA, goalB) => goalA.order - goalB.order) });
        }, { errorPrefix: 'GoalStore: reorderGoals' });
    },

    recalculateProgress: async (goalId, date) => {
        // 백그라운드 작업: 로딩 상태 없이, 에러도 throw 안 함
        return withBackgroundAction(set, async () => {
            const updatedGoal = await recalculateGlobalGoalProgress(goalId, date);

            // 낙관적 업데이트: 진행률 업데이트
            const currentGoals = get().goals;
            set({
                goals: currentGoals.map(existingGoal => existingGoal.id === goalId ? updatedGoal : existingGoal)
            });
        }, 'GoalStore: recalculateProgress');
    },

    refresh: async () => {
        await get().loadGoals();
    },

    reset: () => {
        set({ goals: [], loading: false, error: null });
    },
}));
