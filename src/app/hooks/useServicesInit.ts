/**
 * useServicesInit Hook
 *
 * @role 앱 서비스 초기화 로직 분리 (디버그 노출, 비활동 알림 등)
 * @input dbInitialized
 * @output 없음 (사이드 이펙트만)
 */

import { useEffect } from 'react';
import { exposeDebugToWindow } from '@/shared/services/sync/firebase/firebaseDebug';

/**
 * 서비스 초기화 훅
 */
export function useServicesInit(dbInitialized: boolean): void {
  // 디버그 함수 노출
  useEffect(() => {
    if (dbInitialized) {
      exposeDebugToWindow();
    }
  }, [dbInitialized]);

  // 비활동 알림 서비스 초기화
  useEffect(() => {
    if (!dbInitialized) return;

    let cleanup: (() => void) | undefined;

    // 동적 import로 서비스 불러오기
    import('@/shared/services/behavior/inactivityAlertService').then(({ inactivityAlertService }) => {
      inactivityAlertService.start();
      console.log('✅ [useServicesInit] Inactivity alert service started');

      cleanup = () => {
        inactivityAlertService.stop();
        console.log('🛑 [useServicesInit] Inactivity alert service stopped');
      };
    });

    return () => {
      cleanup?.();
    };
  }, [dbInitialized]);
}
