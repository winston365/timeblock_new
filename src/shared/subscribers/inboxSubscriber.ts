/**
 * @file inboxSubscriber.ts
 * @module shared/subscribers
 *
 * @description Inbox 관련 이벤트 구독자
 *
 * @role dailyDataStore → inboxStore 간 상태 동기화
 *
 * @responsibilities
 * - inbox:taskRemoved 이벤트 처리: inbox에서 task 제거 시 inboxStore 상태 즉시 반영
 *
 * @key_dependencies
 * - eventBus: 이벤트 수신
 * - inboxStore: Inbox 상태 관리 (동적 import로 순환 의존성 방지)
 */

import { eventBus } from '@/shared/lib/eventBus';

let initialized = false;

/**
 * Inbox Subscriber를 초기화합니다.
 *
 * dailyDataStore에서 inbox→block 이동 시 발행하는 이벤트를 구독하여
 * inboxStore의 상태를 즉시 업데이트합니다.
 *
 * @returns {void}
 */
export function initInboxSubscriber(): void {
    if (initialized) return;
    initialized = true;

    /**
     * inbox:taskRemoved 이벤트 핸들러
     * Inbox에서 task가 제거될 때 inboxStore 상태를 즉시 반영
     */
    eventBus.on('inbox:taskRemoved', async ({ taskId }) => {
        try {
            const { useInboxStore } = await import('@/shared/stores/inboxStore');
            const store = useInboxStore.getState();
            const currentTasks = store.inboxTasks;
            const updatedTasks = currentTasks.filter(t => t.id !== taskId);

            // 이미 제거되었거나 존재하지 않으면 스킵
            if (updatedTasks.length === currentTasks.length) return;

            useInboxStore.setState({ inboxTasks: updatedTasks });
        } catch (error) {
            console.error('[InboxSubscriber] Failed to handle inbox:taskRemoved:', error);
        }
    });
}
