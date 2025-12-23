/**
 * Inbox Zustand Store
 *
 * @role 인박스(Global Inbox) 작업 상태 관리
 * @responsibilities
 *   - 인박스 작업 로드/저장
 *   - 인박스 작업 CRUD (추가, 수정, 삭제)
 *   - 인박스 작업 완료 토글 (XP/퀘스트 파이프라인 연동)
 *   - TimeBlock 설정 시 dailyData로 자동 이동
 *   - Triage 모드 UI 상태 관리
 *   - HUD 상태 관리 (정리 목표/진행도)
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - inboxRepository: 인박스 데이터 영속성 관리
 *   - systemRepository: UI 상태 영속성 관리
 *   - eventBus: Store 간 통신 (순환 의존성 해소)
 *   - taskCompletionService: 작업 완료 파이프라인
 *   - storeUtils: 비동기 액션 래퍼
 */

import { create } from 'zustand';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import type { TaskCompletionResult } from '@/shared/services/gameplay/taskCompletion/types';
import {
    loadInboxTasks,
    addInboxTask,
    updateInboxTask,
    deleteInboxTask,
    toggleInboxTaskCompletion,
} from '@/data/repositories/inboxRepository';
import {
    getSystemState,
    setSystemState,
    SYSTEM_KEYS,
} from '@/data/repositories/systemRepository';
import { SYSTEM_STATE_DEFAULTS, type InboxLastUsedSlot, type InboxFilterState } from '@/shared/constants/defaults';
import { scheduleEmojiSuggestion } from '@/shared/services/ai/emojiSuggester';
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';
import { getLocalDate } from '@/shared/lib/utils';
import { eventBus } from '@/shared/lib/eventBus';
import { withAsyncAction } from '@/shared/lib/storeUtils';

const getTriageCandidates = (tasks: readonly Task[]): Task[] => {
    const todayISO = getLocalDate();
    return tasks.filter((t) => !((t.deferredUntil ?? null) !== null && (t.deferredUntil ?? '') > todayISO));
};

interface InboxStore {
    // 작업 상태
    inboxTasks: Task[];
    loading: boolean;
    error: Error | null;

    // Triage 모드 UI 상태
    triageEnabled: boolean;
    triageFocusedTaskId: string | null;

    // HUD 상태 (정리 목표/진행도)
    hudCollapsed: boolean;
    dailyGoalCount: number;
    todayProcessedCount: number;
    todayProcessedDate: string | null;

    // 필터 상태
    filters: InboxFilterState;

    // 마지막 사용 슬롯
    lastUsedSlot: InboxLastUsedSlot | null;

    // 작업 액션
    loadData: () => Promise<void>;
    addTask: (task: Task) => Promise<void>;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    toggleTaskCompletion: (taskId: string) => Promise<void>;
    refresh: () => Promise<void>;
    reset: () => void;

    // Triage 액션
    setTriageEnabled: (enabled: boolean) => Promise<void>;
    setTriageFocusedTaskId: (taskId: string | null) => void;
    moveFocusNext: () => void;
    moveFocusPrev: () => void;

    // HUD 액션
    setHudCollapsed: (collapsed: boolean) => Promise<void>;
    setDailyGoalCount: (count: number) => Promise<void>;
    incrementProcessedCount: () => Promise<void>;

    // 필터 액션
    setFilters: (filters: Partial<InboxFilterState>) => Promise<void>;

    // 슬롯 액션
    setLastUsedSlot: (slot: InboxLastUsedSlot) => Promise<void>;

    // 빠른 배치 액션 (inbox → schedule)
    placeTaskToSlot: (taskId: string, dateISO: string, blockId: TimeBlockId, hourSlot: number) => Promise<void>;
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
    // 작업 상태
    inboxTasks: [],
    loading: false,
    error: null,

    // Triage 모드 UI 상태
    triageEnabled: SYSTEM_STATE_DEFAULTS.inboxTriageEnabled,
    triageFocusedTaskId: null,

    // HUD 상태
    hudCollapsed: SYSTEM_STATE_DEFAULTS.inboxHudCollapsed,
    dailyGoalCount: SYSTEM_STATE_DEFAULTS.inboxTriageDailyGoalCount,
    todayProcessedCount: SYSTEM_STATE_DEFAULTS.inboxTodayProcessedCount,
    todayProcessedDate: SYSTEM_STATE_DEFAULTS.inboxTodayProcessedDate,

    // 필터 상태
    filters: SYSTEM_STATE_DEFAULTS.inboxFilters,

    // 마지막 사용 슬롯
    lastUsedSlot: SYSTEM_STATE_DEFAULTS.inboxLastUsedSlot,

    /**
     * 인박스 작업 데이터 로드 (UI 상태 포함)
     */
    loadData: async () => {
        return withAsyncAction(set, async () => {
            const tasks = await loadInboxTasks();
            // globalInbox에는 미완료 작업만 있어야 하지만, 안전을 위해 필터링
            set({ inboxTasks: tasks.filter(t => !t.completed) });

            // UI 상태 로드 (systemState에서)
            const [
                triageEnabled,
                hudCollapsed,
                dailyGoalCount,
                todayProcessedCount,
                todayProcessedDate,
                filters,
                lastUsedSlot,
            ] = await Promise.all([
                getSystemState<boolean>(SYSTEM_KEYS.INBOX_TRIAGE_ENABLED),
                getSystemState<boolean>(SYSTEM_KEYS.INBOX_HUD_COLLAPSED),
                getSystemState<number>(SYSTEM_KEYS.INBOX_TRIAGE_DAILY_GOAL_COUNT),
                getSystemState<number>(SYSTEM_KEYS.INBOX_TODAY_PROCESSED_COUNT),
                getSystemState<string | null>(SYSTEM_KEYS.INBOX_TODAY_PROCESSED_DATE),
                getSystemState<InboxFilterState>(SYSTEM_KEYS.INBOX_FILTERS),
                getSystemState<InboxLastUsedSlot | null>(SYSTEM_KEYS.INBOX_LAST_USED_SLOT),
            ]);

            // 날짜가 바뀌면 오늘 처리 카운트 리셋
            const today = getLocalDate();
            const shouldResetCount = todayProcessedDate !== today;

            set({
                triageEnabled: triageEnabled ?? SYSTEM_STATE_DEFAULTS.inboxTriageEnabled,
                hudCollapsed: hudCollapsed ?? SYSTEM_STATE_DEFAULTS.inboxHudCollapsed,
                dailyGoalCount: dailyGoalCount ?? SYSTEM_STATE_DEFAULTS.inboxTriageDailyGoalCount,
                todayProcessedCount: shouldResetCount ? 0 : (todayProcessedCount ?? SYSTEM_STATE_DEFAULTS.inboxTodayProcessedCount),
                todayProcessedDate: shouldResetCount ? today : (todayProcessedDate ?? SYSTEM_STATE_DEFAULTS.inboxTodayProcessedDate),
                filters: filters ?? SYSTEM_STATE_DEFAULTS.inboxFilters,
                lastUsedSlot: lastUsedSlot ?? SYSTEM_STATE_DEFAULTS.inboxLastUsedSlot,
            });

            // 리셋된 경우 저장
            if (shouldResetCount) {
                await setSystemState(SYSTEM_KEYS.INBOX_TODAY_PROCESSED_COUNT, 0);
                await setSystemState(SYSTEM_KEYS.INBOX_TODAY_PROCESSED_DATE, today);
            }
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
     * timeBlock이 설정되면 dailyDataStore를 통해 처리 (optimistic update 포함)
     */
    updateTask: async (taskId: string, updates: Partial<Task>) => {
        return withAsyncAction(set, async () => {
            // timeBlock이 설정되면 dailyDataStore를 통해 처리 (optimistic update 활용)
            if (updates.timeBlock !== undefined && updates.timeBlock !== null) {
                // Optimistic: 즉시 inbox에서 제거
                const { inboxTasks } = get();
                set({ inboxTasks: inboxTasks.filter(t => t.id !== taskId) });

                try {
                    // dailyDataStore를 통해 처리 (순환 의존성 방지를 위해 동적 import)
                    const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
                    await useDailyDataStore.getState().updateTask(taskId, updates);
                } catch (error) {
                    // 실패 시 롤백: inbox 목록 다시 로드
                    await get().loadData();
                    throw error;
                }
            } else {
                await updateInboxTask(taskId, updates);
                if (updates.text) {
                    scheduleEmojiSuggestion(taskId, updates.text);
                }
                await get().loadData();
            }
        }, { errorPrefix: 'InboxStore: updateTask' });
    },

    /**
     * 인박스 작업 삭제
     */
    deleteTask: async (taskId: string) => {
        return withAsyncAction(set, async () => {
            await deleteInboxTask(taskId);
            await get().loadData();

            // Triage 모드에서 삭제된 task가 포커스였다면 다음 후보로 이동
            const { triageEnabled, triageFocusedTaskId, inboxTasks } = get();
            if (triageEnabled && triageFocusedTaskId === taskId) {
                const candidates = getTriageCandidates(inboxTasks);
                set({ triageFocusedTaskId: candidates[0]?.id ?? null });
            }
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
        set({
            inboxTasks: [],
            loading: false,
            error: null,
            triageEnabled: SYSTEM_STATE_DEFAULTS.inboxTriageEnabled,
            triageFocusedTaskId: null,
            hudCollapsed: SYSTEM_STATE_DEFAULTS.inboxHudCollapsed,
            dailyGoalCount: SYSTEM_STATE_DEFAULTS.inboxTriageDailyGoalCount,
            todayProcessedCount: SYSTEM_STATE_DEFAULTS.inboxTodayProcessedCount,
            todayProcessedDate: SYSTEM_STATE_DEFAULTS.inboxTodayProcessedDate,
            filters: SYSTEM_STATE_DEFAULTS.inboxFilters,
            lastUsedSlot: SYSTEM_STATE_DEFAULTS.inboxLastUsedSlot,
        });
    },

    // ========================================================================
    // Triage 액션
    // ========================================================================

    /**
     * Triage 모드 활성화/비활성화
     */
    setTriageEnabled: async (enabled: boolean) => {
        set({ triageEnabled: enabled });
        await setSystemState(SYSTEM_KEYS.INBOX_TRIAGE_ENABLED, enabled);

        // Triage 시작 시 첫 번째 작업에 포커스
        if (enabled) {
            const { inboxTasks } = get();
            const candidates = getTriageCandidates(inboxTasks);
            if (candidates.length > 0) {
                set({ triageFocusedTaskId: candidates[0]?.id ?? null });
            } else {
                set({ triageFocusedTaskId: null });
            }
        } else {
            set({ triageFocusedTaskId: null });
        }
    },

    /**
     * Triage 포커스 Task ID 설정
     */
    setTriageFocusedTaskId: (taskId: string | null) => {
        set({ triageFocusedTaskId: taskId });
    },

    /**
     * Triage 포커스 다음으로 이동
     */
    moveFocusNext: () => {
        const { inboxTasks, triageFocusedTaskId } = get();
        const candidates = getTriageCandidates(inboxTasks);
        if (candidates.length === 0) return;

        const currentIndex = candidates.findIndex(t => t.id === triageFocusedTaskId);
        const nextIndex = currentIndex >= 0 && currentIndex < candidates.length - 1 ? currentIndex + 1 : 0;
        set({ triageFocusedTaskId: candidates[nextIndex]?.id ?? null });
    },

    /**
     * Triage 포커스 이전으로 이동
     */
    moveFocusPrev: () => {
        const { inboxTasks, triageFocusedTaskId } = get();
        const candidates = getTriageCandidates(inboxTasks);
        if (candidates.length === 0) return;

        const currentIndex = candidates.findIndex(t => t.id === triageFocusedTaskId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : candidates.length - 1;
        set({ triageFocusedTaskId: candidates[prevIndex]?.id ?? null });
    },

    // ========================================================================
    // HUD 액션
    // ========================================================================

    /**
     * HUD 접힘 상태 설정
     */
    setHudCollapsed: async (collapsed: boolean) => {
        set({ hudCollapsed: collapsed });
        await setSystemState(SYSTEM_KEYS.INBOX_HUD_COLLAPSED, collapsed);
    },

    /**
     * 오늘 정리 목표 개수 설정
     */
    setDailyGoalCount: async (count: number) => {
        const validCount = Math.max(1, Math.min(50, count)); // 1~50 범위 제한
        set({ dailyGoalCount: validCount });
        await setSystemState(SYSTEM_KEYS.INBOX_TRIAGE_DAILY_GOAL_COUNT, validCount);
    },

    /**
     * 오늘 처리 카운트 증가 (배치/삭제 시 호출)
     */
    incrementProcessedCount: async () => {
        const { todayProcessedCount, dailyGoalCount } = get();
        const today = getLocalDate();
        const newCount = todayProcessedCount + 1;

        set({
            todayProcessedCount: newCount,
            todayProcessedDate: today,
        });

        await setSystemState(SYSTEM_KEYS.INBOX_TODAY_PROCESSED_COUNT, newCount);
        await setSystemState(SYSTEM_KEYS.INBOX_TODAY_PROCESSED_DATE, today);

        // 목표 달성 시 이벤트 발행
        if (newCount === dailyGoalCount) {
            eventBus.emit('inbox:dailyGoalAchieved', {
                goalCount: dailyGoalCount,
                processedCount: newCount,
            }, {
                source: 'inboxStore.incrementProcessedCount',
            });
        }
    },

    // ========================================================================
    // 필터 액션
    // ========================================================================

    /**
     * 필터 상태 설정
     */
    setFilters: async (newFilters: Partial<InboxFilterState>) => {
        const { filters } = get();
        const updated = { ...filters, ...newFilters };
        set({ filters: updated });
        await setSystemState(SYSTEM_KEYS.INBOX_FILTERS, updated);
    },

    // ========================================================================
    // 슬롯 액션
    // ========================================================================

    /**
     * 마지막 사용 슬롯 저장
     */
    setLastUsedSlot: async (slot: InboxLastUsedSlot) => {
        set({ lastUsedSlot: slot });
        await setSystemState(SYSTEM_KEYS.INBOX_LAST_USED_SLOT, slot);
    },

    // ========================================================================
    // 빠른 배치 액션
    // ========================================================================

    /**
     * 인박스 작업을 특정 슬롯으로 배치 (안전한 이동)
     *
     * @param taskId - 이동할 작업 ID
     * @param dateISO - 대상 날짜 (YYYY-MM-DD)
     * @param blockId - 대상 블록 ID
     * @param hourSlot - 대상 시간 슬롯
     */
    placeTaskToSlot: async (taskId: string, dateISO: string, blockId: TimeBlockId, hourSlot: number) => {
        return withAsyncAction(set, async () => {
            const { inboxTasks } = get();
            const originalTask = inboxTasks.find(t => t.id === taskId);

            if (!originalTask) {
                throw new Error(`Task not found: ${taskId}`);
            }

            // Optimistic: 즉시 inbox에서 제거
            set({ inboxTasks: inboxTasks.filter(t => t.id !== taskId) });

            try {
                // dailyDataStore를 통해 처리
                const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
                await useDailyDataStore.getState().updateTask(taskId, {
                    timeBlock: blockId,
                    hourSlot,
                });

                // 처리 카운트 증가
                await get().incrementProcessedCount();

                // Triage 모드에서는 다음 작업으로 포커스 이동
                const { triageEnabled, triageFocusedTaskId, inboxTasks: updatedTasks } = get();
                if (triageEnabled && triageFocusedTaskId === taskId) {
                    const candidates = getTriageCandidates(updatedTasks);
                    set({ triageFocusedTaskId: candidates[0]?.id ?? null });
                }

                // 이벤트 발행
                eventBus.emit('inbox:taskPlaced', {
                    taskId,
                    dateISO,
                    blockId,
                    hourSlot,
                }, {
                    source: 'inboxStore.placeTaskToSlot',
                });
            } catch (error) {
                // 실패 시 롤백
                await get().loadData();
                throw error;
            }
        }, { errorPrefix: 'InboxStore: placeTaskToSlot' });
    },
}));
