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
 *   - storeUtils: 비동기 액션 래퍼
 */

import { create } from 'zustand';
import type { Task } from '@/shared/types/domain';
import type { TaskCompletionResult } from '@/shared/services/gameplay/taskCompletion/types';
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
import { withAsyncAction } from '@/shared/lib/storeUtils';

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
     */
    loadData: async () => {
        return withAsyncAction(set, async () => {
            const tasks = await loadInboxTasks();
            // globalInbox에는 미완료 작업만 있어야 하지만, 안전을 위해 필터링
            set({ inboxTasks: tasks.filter(t => !t.completed) });
        }, { errorPrefix: 'InboxStore: loadData', rethrow: false });
    },

    /**
     * 인박스에 작업 추가
     */
    addTask: async (task: Task) => {
        return withAsyncAction(set, async () => {
            await addInboxTask(task);
            scheduleEmojiSuggestion(task.id, task.text);
            await get().loadData();
        }, { errorPrefix: 'InboxStore: addTask' });
    },

    /**
     * 인박스 작업 업데이트
     */
    updateTask: async (taskId: string, updates: Partial<Task>) => {
        return withAsyncAction(set, async () => {
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
        }, { errorPrefix: 'InboxStore: updateTask' });
    },

    /**
     * 인박스 작업 삭제
     */
    deleteTask: async (taskId: string) => {
        return withAsyncAction(set, async () => {
            await deleteInboxTask(taskId);
            await get().loadData();
        }, { errorPrefix: 'InboxStore: deleteTask' });
    },

    /**
     * 인박스 작업 완료 토글
     */
    toggleTaskCompletion: async (taskId: string) => {
        return withAsyncAction(set, async () => {
            const current = get().inboxTasks.find(t => t.id === taskId);
            const wasCompleted = current?.completed ?? false;

            const updatedTask = await toggleInboxTaskCompletion(taskId);

            let result: TaskCompletionResult | null = null;
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

            await get().loadData();
        }, { errorPrefix: 'InboxStore: toggleTaskCompletion' });
    },

    /**
     * 수동 갱신 (강제 리로드)
     */
    refresh: async () => {
        await get().loadData();
    },

    /**
     * 상태 초기화
     */
    reset: () => {
        set({ inboxTasks: [], loading: false, error: null });
    },
}));
