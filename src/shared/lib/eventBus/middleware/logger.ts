/**
 * Event Logger Middleware
 * 
 * @description 개발 환경에서 모든 이벤트를 콘솔에 로깅
 * @features 색상 코딩, 성능 측정, 필터링, 그룹화
 */

import type { EventType, Middleware } from '../types';

export interface LoggerOptions {
    /** 로거 활성화 여부 (기본: true) */
    enabled?: boolean;

    /** Payload 출력 여부 (기본: true) */
    logPayload?: boolean;

    /** Meta 출력 여부 (기본: true) */
    logMeta?: boolean;

    /** 필터 함수 (true 반환 시 로깅) */
    filter?: (event: EventType) => boolean;

    /** 느린 핸들러 경고 threshold (ms, 기본: 10) */
    slowThreshold?: number;

    /** 색상 코딩 활성화 (기본: true) */
    useColors?: boolean;
}

/**
 * 이벤트 타입별 색상
 */
const EVENT_COLORS: Record<string, string> = {
    task: '#3b82f6',    // blue
    block: '#8b5cf6',   // purple
    xp: '#f59e0b',      // amber
    level: '#10b981',   // green
    quest: '#06b6d4',   // cyan
    goal: '#ec4899',    // pink
    waifu: '#f97316',   // orange
};

/**
 * 이벤트 타입별 이모지
 */
const EVENT_EMOJIS: Record<string, string> = {
    task: '📝',
    block: '🔒',
    xp: '⭐',
    level: '🎉',
    quest: '🎯',
    goal: '🏆',
    waifu: '💬',
};

/**
 * Logger Middleware 생성
 */
export function createLoggerMiddleware(
    options: LoggerOptions = {}
): Middleware {
    const {
        enabled = true,
        logPayload = true,
        logMeta = true,
        filter = () => true,
        slowThreshold = 10,
        useColors = true,
    } = options;

    return (event, payload, meta, next) => {
        // 비활성화 또는 필터링
        if (!enabled || !filter(event)) {
            next();
            return;
        }

        // 이벤트 도메인 추출 (task:completed -> task)
        const domain = event.split(':')[0];
        const color = useColors ? EVENT_COLORS[domain] || '#64748b' : undefined;
        const emoji = EVENT_EMOJIS[domain] || '📡';

        // 시작 시간 기록
        const startTime = performance.now();

        // 로그 시작
        if (color && typeof console.groupCollapsed === 'function') {
            console.groupCollapsed(
                `%c${emoji} [EVENT] ${event}`,
                `color: ${color}; font-weight: bold;`
            );
        } else {
            console.log(`${emoji} [EVENT] ${event}`);
        }

        // Timestamp
        const timestamp = new Date(meta.timestamp).toLocaleTimeString('ko-KR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        console.log(`  ├─ Timestamp: ${timestamp}`);

        // Source
        if (logMeta && meta.source) {
            console.log(`  ├─ Source: ${meta.source}`);
        }

        // Correlation ID
        if (logMeta && meta.correlationId) {
            console.log(`  ├─ CorrelationId: ${meta.correlationId}`);
        }

        // Payload
        if (logPayload) {
            console.log('  ├─ Payload:', payload);
        }

        // 핸들러 실행
        try {
            next();
        } finally {
            // 실행 시간 측정
            const duration = performance.now() - startTime;

            if (duration > slowThreshold) {
                console.warn(
                    `  ⚠️  Slow event: ${duration.toFixed(2)}ms (threshold: ${slowThreshold}ms)`
                );
            } else {
                console.log(`  └─ Duration: ${duration.toFixed(2)}ms`);
            }

            // 로그 종료
            if (typeof console.groupEnd === 'function') {
                console.groupEnd();
            }
        }
    };
}

/**
 * 기본 Logger (개발 환경 전용)
 */
export const loggerMiddleware = createLoggerMiddleware({
    enabled: import.meta.env.DEV,
    logPayload: true,
    logMeta: true,
    slowThreshold: 10,
});
