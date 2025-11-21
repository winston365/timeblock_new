/**
 * Event Bus - Public API
 * 
 * @description Event Bus의 진입점
 */

export { eventBus, EventBus } from './EventBus';

export type {
    EventType,
    EventPayload,
    EventHandler,
    EventMeta,
    Unsubscribe,
    SubscribeOptions,
    Middleware,
    // Event payloads
    TaskCreatedEvent,
    TaskUpdatedEvent,
    TaskDeletedEvent,
    TaskCompletedEvent,
    BlockLockedEvent,
    BlockUnlockedEvent,
    BlockPerfectEvent,
    XpEarnedEvent,
    XpSpentEvent,
    LevelUpEvent,
    QuestProgressEvent,
    QuestCompletedEvent,
    GoalProgressChangedEvent,
    WaifuMessageEvent,
} from './types';

export {
    createLoggerMiddleware,
    loggerMiddleware,
} from './middleware/logger';

export {
    createPerformanceMiddleware,
    performanceMiddleware,
    performanceMonitor,
} from './middleware/performance';

// 개발 환경에서 디버깅을 위해 eventBus를 전역으로 노출
import { eventBus } from './EventBus';
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__eventBus = eventBus;
    console.log('🔍 [EventBus] Available at window.__eventBus for debugging');
}
