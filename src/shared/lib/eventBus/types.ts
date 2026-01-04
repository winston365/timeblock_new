/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Event Bus - 타입 정의
 *
 * @file types.ts
 * @description 모든 도메인 이벤트의 타입 정의
 *
 * @role EventBus에서 사용하는 모든 이벤트 페이로드 및 타입 정의
 * @responsibilities
 *   - 도메인별 이벤트 페이로드 인터페이스 정의 (Task, Block, XP, Quest 등)
 *   - 이벤트 타입 매핑 (EventTypeMap)으로 타입 안전성 보장
 *   - EventHandler, Middleware 등 공통 타입 정의
 * @naming_convention [domain]:[action]:[detail?]
 */

import type { TempScheduleTask } from '@/shared/types/tempSchedule';

/**
 * 이벤트 메타데이터
 */
export interface EventMeta {
    /** 이벤트 발생 시각 (Unix timestamp) */
    timestamp: number;

    /** 이벤트 발생 위치 (디버깅용) */
    source?: string;

    /** 이벤트 체인 추적 ID */
    correlationId?: string;

    /** 우선순위 (미래 확장용) */
    priority?: 'high' | 'normal' | 'low';
}

/**
 * Task 도메인 이벤트
 */
export interface TaskCreatedEvent {
    taskId: string;
    text: string;
    timeBlock: string | null;
    goalId?: string | null;
}

export interface TaskUpdatedEvent {
    taskId: string;
    updates: Record<string, any>;
    previousTimeBlock?: string | null;
    newTimeBlock?: string | null;
}

export interface TaskDeletedEvent {
    taskId: string;
    goalId?: string | null;
}

export interface TaskCompletedEvent {
    taskId: string;
    xpEarned: number;
    isPerfectBlock: boolean;
    blockId?: string | null;
    goalId?: string | null;
    adjustedDuration: number;
}

export interface TaskUncompletedEvent {
    taskId: string;
    xpDeducted: number;
    blockId?: string | null;
}

/**
 * Inbox 도메인 이벤트
 */
export interface InboxTaskRemovedEvent {
    taskId: string;
}

export interface InboxDailyGoalAchievedEvent {
    goalCount: number;
}

/**
 * TimeBlock 도메인 이벤트
 */
export interface BlockLockedEvent {
    blockId: string;
    taskCount: number;
}

export interface BlockUnlockedEvent {
    blockId: string;
    xpCost: number;
}

export interface BlockPerfectEvent {
    blockId: string;
    xpBonus: number;
}

/**
 * XP/Level 도메인 이벤트
 */
export interface XpEarnedEvent {
    amount: number;
    source: string; // 'task', 'perfect_block', 'dont_do_item', etc.
    blockId?: string;
}

export interface XpSpentEvent {
    amount: number;
    purpose: string; // 'unlock_block', 'shop_item', etc.
}

/**
 * Quest 도메인 이벤트
 */
export interface QuestProgressEvent {
    questType: string;
    progress: number;
    target: number;
}

export interface QuestCompletedEvent {
    questType: string;
    reward: number;
}

/**
 * Waifu 도메인 이벤트
 */
export interface WaifuMessageEvent {
    message: string;
    audioPath?: string;
    expression?: {
        imagePath: string;
        durationMs?: number;
    };
}

/**
 * Reality Check 도메인 이벤트
 */
export interface RealityCheckRequestEvent {
    taskId: string;
    taskTitle: string;
    estimatedDuration: number;
}

export interface GameStateRefreshRequestEvent {
    reason: string;
}

export interface TempScheduleCreatedEvent {
    task: TempScheduleTask;
}

export interface TempScheduleUpdatedEvent {
    task: TempScheduleTask;
    oldTask: TempScheduleTask;
}

export interface TempScheduleDeletedEvent {
    task: TempScheduleTask;
}

/**
 * 이벤트 타입 매핑
 */
export interface EventTypeMap {
    // Task events
    'task:created': TaskCreatedEvent;
    'task:updated': TaskUpdatedEvent;
    'task:deleted': TaskDeletedEvent;
    'task:completed': TaskCompletedEvent;
    'task:uncompleted': TaskUncompletedEvent;

    // Inbox events
    'inbox:taskRemoved': InboxTaskRemovedEvent;
    'inbox:dailyGoalAchieved': InboxDailyGoalAchievedEvent;

    // Block events
    'block:locked': BlockLockedEvent;
    'block:unlocked': BlockUnlockedEvent;
    'block:perfect': BlockPerfectEvent;

    // XP events
    'xp:earned': XpEarnedEvent;
    'xp:spent': XpSpentEvent;

    // Quest events
    'quest:progress': QuestProgressEvent;
    'quest:completed': QuestCompletedEvent;

    // Waifu events
    'waifu:message': WaifuMessageEvent;

    // Reality Check events
    'realityCheck:request': RealityCheckRequestEvent;

    // GameState events
    'gameState:refreshRequest': GameStateRefreshRequestEvent;

    // Temp Schedule events
    'tempSchedule:created': TempScheduleCreatedEvent;
    'tempSchedule:updated': TempScheduleUpdatedEvent;
    'tempSchedule:deleted': TempScheduleDeletedEvent;
}
/**
 * 이벤트 타입 (도메인:액션)
 */
export type EventType = keyof EventTypeMap;

/**
 * 특정 이벤트의 Payload 타입 추출
 */
export type EventPayload<K extends EventType> = EventTypeMap[K];

/**
 * 이벤트 핸들러 함수 타입
 */
export type EventHandler<K extends EventType> = (
    payload: EventPayload<K>,
    meta: EventMeta
) => void | Promise<void>;

/**
 * 구독 해제 함수 타입
 */
export type Unsubscribe = () => void;

/**
 * 구독 옵션
 */
export interface SubscribeOptions {
    /** 한 번만 실행 후 자동 구독 해제 */
    once?: boolean;

    /** 우선순위 (높을수록 먼저 실행) */
    priority?: number;
}

/**
 * 미들웨어 함수 타입
 */
export type Middleware = (
    event: EventType,
    payload: any,
    meta: EventMeta,
    next: () => void
) => void;
