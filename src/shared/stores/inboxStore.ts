/**
 * Inbox Zustand Store
 *
 * @role 인박스 작업 상태 관리
 * @input 인박스 작업 CRUD 요청
 * @output 인박스 작업 상태 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - inboxRepository: 데이터 영속성 관리
 */

import { create } from 'zustand';
import type { Task } from '@/shared/types/domain';
import {
    loadInboxTasks,
    addInboxTask,
    updateInboxTask,
    deleteInboxTask,
    toggleInboxTaskCompletion,
} from '@/data/repositories/inboxRepository';

interface InboxStore {
    // 상태
    inboxTasks: Task[];
    loading: boolean;
    error: Error | null;

    // 액션
    loadData: () => Promise<void>;
    addTask: (task: Task) => Promise<void>;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    toggleTaskCompletion: (taskId: string) => Promise<void>;
    refresh: () => Promise<void>;
    reset: () => void;
}

/**
 * 인박스 상태 스토어
 */
export const useInboxStore = create<InboxStore>((set, get) => ({
    inboxTasks: [],
    loading: false,
    error: null,

    loadData: async () => {
        set({ loading: true, error: null });
        try {
            const tasks = await loadInboxTasks();
            // globalInbox에는 미완료 작업만 있어야 하지만, 안전을 위해 필터링
            // (Repository 로직상 globalInbox <-> completedInbox 이동이 일어나므로)
            set({ inboxTasks: tasks.filter(t => !t.completed), loading: false });
        } catch (error) {
            console.error('InboxStore: Failed to load tasks', error);
            set({ error: error as Error, loading: false });
        }
    },

    addTask: async (task: Task) => {
        set({ loading: true, error: null });
        try {
            await addInboxTask(task);
            // 낙관적 업데이트 또는 리로드
            // 여기서는 리로드로 일관성 유지
            await get().loadData();
        } catch (error) {
            console.error('InboxStore: Failed to add task', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    updateTask: async (taskId: string, updates: Partial<Task>) => {
        set({ loading: true, error: null });
        try {
            // timeBlock이 설정되면 dailyData로 이동해야 함
            if (updates.timeBlock !== undefined && updates.timeBlock !== null) {
                const { updateTask: updateTaskInDaily } = await import('@/data/repositories/dailyDataRepository');
                await updateTaskInDaily(taskId, updates);
            } else {
                await updateInboxTask(taskId, updates);
            }
            await get().loadData();
        } catch (error) {
            console.error('InboxStore: Failed to update task', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    deleteTask: async (taskId: string) => {
        set({ loading: true, error: null });
        try {
            await deleteInboxTask(taskId);
            await get().loadData();
        } catch (error) {
            console.error('InboxStore: Failed to delete task', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    toggleTaskCompletion: async (taskId: string) => {
        set({ loading: true, error: null });
        try {
            await toggleInboxTaskCompletion(taskId);
            await get().loadData();
        } catch (error) {
            console.error('InboxStore: Failed to toggle task completion', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    refresh: async () => {
        await get().loadData();
    },

    reset: () => {
        set({ inboxTasks: [], loading: false, error: null });
    },
}));
