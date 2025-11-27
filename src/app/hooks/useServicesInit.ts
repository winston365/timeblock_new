/**
 * useServicesInit Hook
 *
 * @role 앱 서비스 초기화 로직 분리 (디버그 노출, 비활동 알림, 비활동 집중모드 등)
 * @input dbInitialized
 * @output 없음 (사이드 이펙트만)
 */

import { useEffect } from 'react';
import { exposeDebugToWindow } from '@/shared/services/sync/firebase/firebaseDebug';
import { useSettingsStore } from '@/shared/stores/settingsStore';

/**
 * 서비스 초기화 훅
 */
export function useServicesInit(dbInitialized: boolean): void {
  const { settings } = useSettingsStore();

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

  // 비활동 시 집중 모드 전환 서비스 초기화
  useEffect(() => {
    if (!dbInitialized) return;

    let cleanup: (() => void) | undefined;
    let serviceRef: { stop: () => void } | null = null;

    // 동적 import로 서비스 불러오기
    import('@/shared/services/behavior/idleFocusModeService').then(({ idleFocusModeService }) => {
      serviceRef = idleFocusModeService;

      // 설정에서 활성화되어 있을 때만 시작
      if (settings?.idleFocusModeEnabled) {
        // 이미 실행 중이면 중지 후 재시작
        idleFocusModeService.stop();
        idleFocusModeService.start();
        console.log(`✅ [useServicesInit] Idle focus mode service started`);
      } else {
        // 비활성화되면 중지
        idleFocusModeService.stop();
      }

      cleanup = () => {
        idleFocusModeService.stop();
        console.log('🛑 [useServicesInit] Idle focus mode service stopped');
      };
    });

    return () => {
      cleanup?.();
    };
  }, [dbInitialized, settings?.idleFocusModeEnabled, settings?.idleFocusModeMinutes]);
}
