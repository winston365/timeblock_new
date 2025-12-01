/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Event Bus - Public API
 *
 * @file index.ts
 * @description Event Bus의 진입점
 *
 * @role EventBus 모듈의 공개 API 및 내보내기 정의
 * @responsibilities
 *   - EventBus 클래스 및 싱글톤 인스턴스 내보내기
 *   - 타입 정의 내보내기
 *   - 미들웨어 (logger, performance) 내보내기
 *   - 개발 환경에서 디버깅을 위한 전역 노출
 * @dependencies ./EventBus, ./types, ./middleware/*
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
    QuestProgressEvent,
    QuestCompletedEvent,
    GoalProgressChangedEvent,
    WaifuMessageEvent,
    RealityCheckRequestEvent,
    GameStateRefreshRequestEvent,
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
    console.debug('🔍 [EventBus] Available at window.__eventBus for debugging');
}
