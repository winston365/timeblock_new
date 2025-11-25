/**
 * Inbox Zustand Store
 *
 * @role 인박스 작업 상태 관리
 * @input 인박스 작업 CRUD 요청
 * @output 인박스 작업 상태 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - inboxRepository: 데이터 영속성 관리
 *   - eventBus: Store 간 통신 (순환 의존성 해소)
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
import { scheduleEmojiSuggestion } from '@/shared/services/ai/emojiSuggester';
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';
import { getLocalDate } from '@/shared/lib/utils';
import { eventBus } from '@/shared/lib/eventBus';

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
            scheduleEmojiSuggestion(task.id, task.text);
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
            if (updates.text) {
                scheduleEmojiSuggestion(taskId, updates.text);
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
            const current = get().inboxTasks.find(t => t.id === taskId);
            const wasCompleted = current?.completed ?? false;

            const updatedTask = await toggleInboxTaskCompletion(taskId);

            let result: any = null;
            if (!wasCompleted && updatedTask.completed) {
                // XP/퀘스트/와이푸 토스트 포함 공통 완료 파이프라인 재사용
                result = await taskCompletionService.handleTaskCompletion({
                    task: updatedTask,
                    wasCompleted,
                    date: getLocalDate(),
                });
                
                // 🔄 GameState 갱신을 이벤트 버스로 요청 (순환 의존성 해소)
                eventBus.emit('gameState:refreshRequest', {
                    reason: 'inbox_task_completion',
                }, {
                    source: 'inboxStore.toggleTaskCompletion',
                });

                // 📊 Reality Check 모달 (10분 이상만) - 이벤트 버스로 요청 (순환 의존성 해소)
                if (updatedTask.adjustedDuration >= 10) {
                    eventBus.emit('realityCheck:request', {
                        taskId: updatedTask.id,
                        taskTitle: updatedTask.text,
                        estimatedDuration: updatedTask.adjustedDuration,
                    }, {
                        source: 'inboxStore.toggleTaskCompletion',
                    });
                }

                // 🎉 Event Bus: task:completed 이벤트 발행
                console.log('[InboxStore] Emitting task:completed event:', {
                    taskId: updatedTask.id,
                    xpEarned: result?.xpEarned || 0,
                });
                eventBus.emit('task:completed', {
                    taskId: updatedTask.id,
                    xpEarned: result?.xpEarned || 0,
                    isPerfectBlock: false, // 인박스 작업은 블록이 없으므로 항상 false
                    blockId: undefined,
                    goalId: updatedTask.goalId || undefined,
                    adjustedDuration: updatedTask.adjustedDuration,
                }, {
                    source: 'inboxStore.toggleTaskCompletion',
                });
            }

            // Goal 진행률 이벤트 (Goal Subscriber가 처리)
            if (updatedTask.goalId) {
                eventBus.emit('goal:progressChanged', {
                    goalId: updatedTask.goalId,
                    taskId: updatedTask.id,
                    action: 'completed',
                }, {
                    source: 'inboxStore.toggleTaskCompletion',
                });
            }

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
