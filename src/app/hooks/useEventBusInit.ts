/**
 * useEventBusInit Hook
 *
 * @role Event Bus 초기화 및 Subscriber 설정
 * @input 없음
 * @output 없음 (사이드 이펙트만)
 */

import { useEffect } from 'react';
import { eventBus, loggerMiddleware, performanceMiddleware } from '@/shared/lib/eventBus';
import { initAllSubscribers } from '@/shared/subscribers';

/**
 * Event Bus 초기화 훅
 * - 앱 시작 시 한 번만 실행됨
 * - 개발 환경에서만 미들웨어 활성화
 */
export function useEventBusInit(): void {
  useEffect(() => {
    if (import.meta.env.DEV) {
      // 개발 환경에서만 미들웨어 활성화
      eventBus.use(loggerMiddleware);
      eventBus.use(performanceMiddleware);
      console.log('✅ [useEventBusInit] Event Bus middleware registered');
    }

    // Subscribers 초기화
    initAllSubscribers();

    console.log('✅ [useEventBusInit] Event Bus initialized');
  }, []);
}
