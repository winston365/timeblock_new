/**
 * CompletedTasks Zustand Store
 *
 * @role 완료된 작업 목록 상태 관리
 * @input 완료된 작업 조회 및 토글 요청
 * @output 완료된 작업 목록 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - dailyDataRepository: 데이터 조회 및 토글 (getRecentCompletedTasks, toggleTaskCompletion)
 */

import { create } from 'zustand';
import type { Task } from '@/shared/types/domain';
import {
    getRecentCompletedTasks,
    toggleTaskCompletion,
} from '@/data/repositories/dailyDataRepository';

interface CompletedTasksStore {
    // 상태
    completedTasks: Task[];
    loading: boolean;
    error: Error | null;

    // 액션
    loadData: (days?: number) => Promise<void>;
    toggleTaskCompletion: (task: Task) => Promise<void>;
    refresh: () => Promise<void>;
    reset: () => void;
}

/**
 * 완료된 작업 상태 스토어
 */
export const useCompletedTasksStore = create<CompletedTasksStore>((set, get) => ({
    completedTasks: [],
    loading: false,
    error: null,

    /**
     * 완료된 작업 목록을 로드합니다.
     * @param days - 조회할 일수 (기본값: 30)
     * @returns 로드 완료 후 resolve되는 Promise
     */
    loadData: async (days: number = 30) => {
        set({ loading: true, error: null });
        try {
            const completedTaskList = await getRecentCompletedTasks(days);
            set({ completedTasks: completedTaskList, loading: false });
        } catch (error) {
            console.error('CompletedTasksStore: Failed to load tasks', error);
            set({ error: error as Error, loading: false });
        }
    },

    /**
     * 작업의 완료 상태를 토글합니다.
     * @param task - 토글할 작업 객체
     * @returns 토글 완료 후 resolve되는 Promise
     */
    toggleTaskCompletion: async (task: Task) => {
        // 낙관적 업데이트 (UI 반응성 향상)
        const previousTasks = get().completedTasks;
        set({
            completedTasks: previousTasks.filter(completedTask => completedTask.id !== task.id),
        });

        try {
            await toggleTaskCompletion(task.id);
            // 성공 시 목록 새로고침 (데이터 일관성 보장)
            await get().loadData();
        } catch (error) {
            console.error('CompletedTasksStore: Failed to toggle task completion', error);
            // 실패 시 롤백
            set({ completedTasks: previousTasks, error: error as Error });
            alert('작업 상태 변경에 실패했습니다.');
        }
    },

    /**
     * 완료된 작업 목록을 새로고침합니다.
     * @returns 새로고침 완료 후 resolve되는 Promise
     */
    refresh: async () => {
        await get().loadData();
    },

    /**
     * 스토어 상태를 초기화합니다.
     */
    reset: () => {
        set({ completedTasks: [], loading: false, error: null });
    },
}));
