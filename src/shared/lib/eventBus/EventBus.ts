/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Event Bus - 핵심 구현
 *
 * @file EventBus.ts
 * @description 타입 안전한 Pub/Sub 이벤트 버스
 *
 * @role 앱 전역에서 도메인 이벤트를 발행/구독하는 중앙 메시징 시스템
 * @responsibilities
 *   - 이벤트 발행(emit) 및 구독(on/once/off) 관리
 *   - 미들웨어 체인을 통한 이벤트 가공/로깅
 *   - 우선순위 기반 핸들러 실행 순서 제어
 *   - 에러 격리로 개별 핸들러 실패가 전파되지 않도록 보장
 *   - 순환 이벤트 감지 및 방지
 * @dependencies ./types (EventType, EventPayload, EventHandler 등 타입 정의)
 */

import type {
    EventType,
    EventPayload,
    EventHandler,
    EventMeta,
    Unsubscribe,
    SubscribeOptions,
    Middleware,
} from './types';

/**
 * 구독자 정보를 담는 내부 인터페이스
 */
interface SubscriberInfo<K extends EventType = EventType> {
    handler: EventHandler<K>;
    priority: number;
    once: boolean;
}

/**
 * 타입 안전한 Pub/Sub 이벤트 버스 클래스
 *
 * @description 미들웨어, 우선순위, 에러 격리를 지원하는 이벤트 버스
 * @example
 * ```typescript
 * eventBus.on('task:completed', (payload, meta) => {
 *   console.log('Task completed:', payload.taskId);
 * });
 * eventBus.emit('task:completed', { taskId: '123', xpEarned: 10, ... });
 * ```
 */
export class EventBus {
    private subscribers: Map<EventType, Set<SubscriberInfo<any>>> = new Map();
    private middlewares: Middleware[] = [];
    private eventStack: EventType[] = []; // 순환 이벤트 감지용

    /**
     * 이벤트를 발행하여 모든 구독자에게 전달
     *
     * @param event - 발행할 이벤트 타입 (예: 'task:completed')
     * @param payload - 이벤트에 첨부할 데이터
     * @param meta - 선택적 메타데이터 (timestamp, source 등)
     * @returns void
     */
    emit<K extends EventType>(
        event: K,
        payload: EventPayload<K>,
        meta?: Partial<EventMeta>
    ): void {
        // 메타데이터 기본값 설정
        const fullMeta: EventMeta = {
            timestamp: Date.now(),
            priority: 'normal',
            ...meta,
        };

        // 순환 이벤트 감지
        if (this.eventStack.includes(event)) {
            console.error(
                `🔴 [EventBus] Circular event detected: ${event}`,
                '\nStack:', this.eventStack
            );
            return;
        }

        this.eventStack.push(event);

        try {
            // 미들웨어 실행
            this.runMiddlewares(event, payload, fullMeta, () => {
                // Subscriber들에게 전달
                this.notifySubscribers(event, payload, fullMeta);
            });
        } finally {
            this.eventStack.pop();
        }
    }

    /**
     * 이벤트를 구독하고 핸들러 등록
     *
     * @param event - 구독할 이벤트 타입
     * @param handler - 이벤트 발생 시 호출될 핸들러 함수
     * @param options - 구독 옵션 (once, priority)
     * @returns 구독 해제 함수
     */
    on<K extends EventType>(
        event: K,
        handler: EventHandler<K>,
        options: SubscribeOptions = {}
    ): Unsubscribe {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }

        const subscriberInfo: SubscriberInfo<K> = {
            handler,
            priority: options.priority ?? 0,
            once: options.once ?? false,
        };

        this.subscribers.get(event)!.add(subscriberInfo);

        // 구독 해제 함수 반환
        return () => {
            this.subscribers.get(event)?.delete(subscriberInfo);
        };
    }

    /**
     * 일회성 이벤트 구독 (한 번 실행 후 자동 해제)
     *
     * @param event - 구독할 이벤트 타입
     * @param handler - 이벤트 발생 시 호출될 핸들러 함수
     * @returns 구독 해제 함수
     */
    once<K extends EventType>(
        event: K,
        handler: EventHandler<K>
    ): Unsubscribe {
        return this.on(event, handler, { once: true });
    }

    /**
     * 이벤트 구독 해제
     *
     * @param event - 구독 해제할 이벤트 타입
     * @param handler - 선택적. 특정 핸들러만 제거. 생략 시 해당 이벤트의 모든 구독 해제
     * @returns void
     */
    off<K extends EventType>(event: K, handler?: EventHandler<K>): void {
        if (!handler) {
            // 특정 이벤트의 모든 구독 해제
            this.subscribers.delete(event);
            return;
        }

        // 특정 핸들러만 제거
        const subs = this.subscribers.get(event);
        if (subs) {
            subs.forEach((sub) => {
                if (sub.handler === handler) {
                    subs.delete(sub);
                }
            });
        }
    }

    /**
     * 미들웨어를 등록하여 모든 이벤트에 대해 전처리/후처리 수행
     *
     * @param middleware - 이벤트 처리 전에 실행될 미들웨어 함수
     * @returns void
     */
    use(middleware: Middleware): void {
        this.middlewares.push(middleware);
    }

    /**
     * 디버깅용: 구독자 목록 조회
     *
     * @param event - 선택적. 특정 이벤트의 구독자만 조회. 생략 시 전체 조회
     * @returns 이벤트별 구독자 정보 Map
     */
    getSubscribers(event?: EventType): Map<EventType, Set<SubscriberInfo<any>>> {
        if (event) {
            const subs = this.subscribers.get(event);
            return subs ? new Map([[event, subs]]) : new Map();
        }
        return new Map(this.subscribers);
    }

    /**
     * 미들웨어 체인을 순차적으로 실행
     *
     * @param event - 처리 중인 이벤트 타입
     * @param payload - 이벤트 페이로드
     * @param meta - 이벤트 메타데이터
     * @param finalHandler - 모든 미들웨어 실행 후 호출될 최종 핸들러
     */
    private runMiddlewares(
        event: EventType,
        payload: any,
        meta: EventMeta,
        finalHandler: () => void
    ): void {
        let index = 0;

        const next = () => {
            if (index < this.middlewares.length) {
                const middleware = this.middlewares[index++];
                middleware(event, payload, meta, next);
            } else {
                finalHandler();
            }
        };

        next();
    }

    /**
     * 등록된 구독자들에게 우선순위 순으로 이벤트 전달
     *
     * @param event - 전달할 이벤트 타입
     * @param payload - 이벤트 페이로드
     * @param meta - 이벤트 메타데이터
     */
    private notifySubscribers<K extends EventType>(
        event: K,
        payload: EventPayload<K>,
        meta: EventMeta
    ): void {
        const subs = this.subscribers.get(event);
        if (!subs || subs.size === 0) {
            return;
        }

        // 우선순위별 정렬 (높은 우선순위 먼저)
        const sortedSubs = Array.from(subs).sort(
            (a, b) => b.priority - a.priority
        );

        // 각 핸들러 실행 (에러 격리)
        sortedSubs.forEach((sub) => {
            try {
                sub.handler(payload, meta);

                // 일회성 구독이면 제거
                if (sub.once) {
                    subs.delete(sub);
                }
            } catch (error) {
                console.error(
                    `🔴 [EventBus] Error in subscriber for "${event}":`,
                    error
                );
                // 에러를 삼키고 다음 핸들러 실행
            }
        });
    }

    /**
     * 모든 구독, 미들웨어, 이벤트 스택을 초기화 (테스트용)
     *
     * @returns void
     */
    clear(): void {
        this.subscribers.clear();
        this.middlewares = [];
        this.eventStack = [];
    }
}

/**
 * 앱 전역에서 사용하는 EventBus 싱글톤 인스턴스
 *
 * @example
 * ```typescript
 * import { eventBus } from '@/shared/lib/eventBus';
 * eventBus.emit('task:completed', { taskId: '123', ... });
 * ```
 */
export const eventBus = new EventBus();
