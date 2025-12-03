/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Inbox Zustand Store
 *
 * @role 인박스(Global Inbox) 작업 상태 관리
 * @responsibilities
 *   - 인박스 작업 로드/저장
 *   - 인박스 작업 CRUD (추가, 수정, 삭제)
 *   - 인박스 작업 완료 토글 (XP/퀘스트 파이프라인 연동)
 *   - TimeBlock 설정 시 dailyData로 자동 이동
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - inboxRepository: 인박스 데이터 영속성 관리
 *   - eventBus: Store 간 통신 (순환 의존성 해소)
 *   - taskCompletionService: 작업 완료 파이프라인
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
 * 인박스 상태 Zustand 스토어
 *
 * @returns {InboxStore} 인박스 상태 및 관리 함수
 * @sideEffects
 *   - IndexedDB에 인박스 작업 저장
 *   - 작업 완료 시 XP, 퀘스트, 와이푸 호감도 업데이트
 *
 * @example
 * ```tsx
 * const { inboxTasks, addTask, toggleTaskCompletion } = useInboxStore();
 * await addTask({ id: '1', text: '작업', completed: false });
 * await toggleTaskCompletion('1');
 * ```
 */
export const useInboxStore = create<InboxStore>((set, get) => ({
    inboxTasks: [],
    loading: false,
    error: null,

    /**
     * 인박스 작업 데이터 로드
     *
     * @returns {Promise<void>}
     * @throws {Error} 로드 실패 시
     */
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

    /**
     * 인박스에 작업 추가
     *
     * @param {Task} task - 추가할 작업
     * @returns {Promise<void>}
     * @throws {Error} 추가 실패 시
     */
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

    /**
     * 인박스 작업 업데이트
     *
     * @param {string} taskId - 업데이트할 작업 ID
     * @param {Partial<Task>} updates - 업데이트할 필드
     * @returns {Promise<void>}
     * @throws {Error} 업데이트 실패 시
     * @sideEffects
     *   - timeBlock 설정 시 dailyData로 자동 이동
     */
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

    /**
     * 인박스 작업 삭제
     *
     * @param {string} taskId - 삭제할 작업 ID
     * @returns {Promise<void>}
     * @throws {Error} 삭제 실패 시
     */
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

    /**
     * 인박스 작업 완료 토글
     *
     * @param {string} taskId - 토글할 작업 ID
     * @returns {Promise<void>}
     * @throws {Error} 토글 실패 시
     * @sideEffects
     *   - 완료 시 XP/퀘스트/와이푸 호감도 업데이트
     *   - 완료된 작업은 completedInbox로 이동
     */
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
            // 인박스 작업은 목표 진행도에 포함하지 않는다 (타임블록 계획 기준)
            if (updatedTask.goalId && updatedTask.timeBlock !== null) {
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

    /**
     * 수동 갱신 (강제 리로드)
     *
     * @returns {Promise<void>}
     */
    refresh: async () => {
        await get().loadData();
    },

    /**
     * 상태 초기화
     *
     * @returns {void}
     */
    reset: () => {
        set({ inboxTasks: [], loading: false, error: null });
    },
}));
