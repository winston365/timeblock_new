/**
 * useEventBusInit Hook
 *
 * @file useEventBusInit.ts
 * @role Event Bus 초기화 및 Subscriber 설정
 * @responsibilities
 *   - EventBus 미들웨어 등록 (개발 환경에서만 logger/performance)
 *   - 모든 Subscriber 초기화
 * @dependencies
 *   - eventBus: 이벤트 발행/구독 시스템
 *   - initAllSubscribers: 모든 구독자 등록 함수
 */

import { useEffect } from 'react';
import { eventBus, loggerMiddleware, performanceMiddleware } from '@/shared/lib/eventBus';
import { initAllSubscribers } from '@/shared/subscribers';

/**
 * Event Bus 초기화 훅
 *
 * 앱 시작 시 한 번만 실행되며, EventBus 미들웨어 등록 및 모든 Subscriber를 초기화합니다.
 * 개발 환경에서만 logger/performance 미들웨어가 활성화됩니다.
 *
 * @returns {void}
 */
export function useEventBusInit(): void {
  useEffect(() => {
    if (import.meta.env.DEV) {
      // 개발 환경에서만 미들웨어 활성화
      eventBus.use(loggerMiddleware);
      eventBus.use(performanceMiddleware);
    }

    // Subscribers 초기화
    initAllSubscribers();
  }, []);
}
