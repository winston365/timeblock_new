/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Performance Monitoring Middleware
 * 
 * @description 이벤트 성능 측정 및 통계
 */

import type { EventType, Middleware } from '../types';

interface PerformanceStats {
    count: number;
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    slowCount: number; // threshold 초과 횟수
}

export interface PerformanceOptions {
    /** 성능 측정 활성화 (기본: true) */
    enabled?: boolean;

    /** 느린 이벤트 threshold (ms, 기본: 50) */
    slowThreshold?: number;

    /** 통계 자동 출력 간격 (ms, 0이면 비활성화) */
    reportInterval?: number;
}

class PerformanceMonitor {
    private stats: Map<EventType, PerformanceStats> = new Map();
    private options: Required<PerformanceOptions>;
    private reportTimer?: ReturnType<typeof setInterval>;

    constructor(options: PerformanceOptions = {}) {
        this.options = {
            enabled: options.enabled ?? true,
            slowThreshold: options.slowThreshold ?? 50,
            reportInterval: options.reportInterval ?? 0,
        };

        if (this.options.reportInterval > 0) {
            this.startAutoReport();
        }
    }

    record(event: EventType, duration: number): void {
        if (!this.options.enabled) return;

        let stat = this.stats.get(event);
        if (!stat) {
            stat = {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0,
                minDuration: Infinity,
                slowCount: 0,
            };
            this.stats.set(event, stat);
        }

        stat.count++;
        stat.totalDuration += duration;
        stat.avgDuration = stat.totalDuration / stat.count;
        stat.maxDuration = Math.max(stat.maxDuration, duration);
        stat.minDuration = Math.min(stat.minDuration, duration);

        if (duration > this.options.slowThreshold) {
            stat.slowCount++;
        }
    }

    getStats(event?: EventType): Map<EventType, PerformanceStats


    > | PerformanceStats | null {
        if (event) {
            return this.stats.get(event) || null;
        }
        return new Map(this.stats);
    }

    printReport(): void {
        if (this.stats.size === 0) return;

        console.group('📊 [Performance] Event Statistics');

        const entriesByAvgDurationDesc = Array.from(this.stats.entries()).sort(
            (a, b) => b[1].avgDuration - a[1].avgDuration
        );

        entriesByAvgDurationDesc.forEach(([event, stat]) => {
            const slowWarning = stat.slowCount > 0 ? ` ⚠️ ${stat.slowCount} slow` : '';
            console.log(
                `  ${event}:`,
                `${stat.count} calls,`,
                `avg ${stat.avgDuration.toFixed(2)}ms,`,
                `max ${stat.maxDuration.toFixed(2)}ms${slowWarning}`
            );
        });

        console.groupEnd();
    }

    reset(): void {
        this.stats.clear();
    }

    private startAutoReport(): void {
        this.reportTimer = globalThis.setInterval(() => {
            this.printReport();
        }, this.options.reportInterval);
    }

    destroy(): void {
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
        }
    }
}

/**
 * Performance Middleware 생성
 */
export function createPerformanceMiddleware(
    options: PerformanceOptions = {}
): { middleware: Middleware; monitor: PerformanceMonitor } {
    const monitor = new PerformanceMonitor(options);

    const middleware: Middleware = (event, _payload, _meta, next) => {
        const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
        const startTime = now();

        try {
            next();
        } finally {
            const duration = now() - startTime;
            monitor.record(event, duration);

            // 느린 이벤트 경고
            if (duration > (options.slowThreshold ?? 50)) {
                console.warn(
                    `⚠️ [Performance] Slow event "${event}": ${duration.toFixed(2)}ms`
                );
            }
        }
    };

    return { middleware, monitor };
}

/**
 * 기본 Performance Monitor (개발 환경 전용)
 */
export const { middleware: performanceMiddleware, monitor: performanceMonitor } =
    createPerformanceMiddleware({
        enabled: import.meta.env.DEV,
        slowThreshold: 50,
        reportInterval: 60000, // 1분마다 리포트
    });

// 전역 접근 (개발 환경에서 콘솔로 확인)
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__performanceMonitor = performanceMonitor;
}
