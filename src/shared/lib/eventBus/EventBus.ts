/**
 * Event Bus - 핵심 구현
 * 
 * @description 타입 안전한 Pub/Sub 이벤트 버스
 * @features 미들웨어, 우선순위, 에러 격리
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

interface SubscriberInfo<K extends EventType = EventType> {
    handler: EventHandler<K>;
    priority: number;
    once: boolean;
}

export class EventBus {
    private subscribers: Map<EventType, Set<SubscriberInfo<any>>> = new Map();
    private middlewares: Middleware[] = [];
    private eventStack: EventType[] = []; // 순환 이벤트 감지용

    /**
     * 이벤트 발행
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
     * 이벤트 구독
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
     * 일회성 구독
     */
    once<K extends EventType>(
        event: K,
        handler: EventHandler<K>
    ): Unsubscribe {
        return this.on(event, handler, { once: true });
    }

    /**
     * 구독 해제
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
     * 미들웨어 추가
     */
    use(middleware: Middleware): void {
        this.middlewares.push(middleware);
    }

    /**
     * 디버깅용: 모든 구독자 조회
     */
    getSubscribers(event?: EventType): Map<EventType, Set<SubscriberInfo<any>>> {
        if (event) {
            const subs = this.subscribers.get(event);
            return subs ? new Map([[event, subs]]) : new Map();
        }
        return new Map(this.subscribers);
    }

    /**
     * 미들웨어 실행
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
     * Subscriber들에게 이벤트 전달
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
     * 모든 구독 해제 (테스트용)
     */
    clear(): void {
        this.subscribers.clear();
        this.middlewares = [];
        this.eventStack = [];
    }
}

// 싱글톤 인스턴스
export const eventBus = new EventBus();
