/**
 * useServicesInit Hook
 *
 * @file useServicesInit.ts
 * @role 앱 서비스 초기화 로직 분리
 * @responsibilities
 *   - 디버그 함수 window 노출
 *   - 비활동 알림 서비스 초기화
 *   - 비활동 시 집중 모드 전환 서비스 초기화
 * @dependencies
 *   - firebaseDebug: 디버그 함수 노출
 *   - inactivityAlertService: 비활동 알림
 *   - idleFocusModeService: 비활동 시 집중 모드
 *   - settingsStore: 설정 상태
 */

import { useEffect } from 'react';
import { exposeDebugToWindow } from '@/shared/services/sync/firebase/firebaseDebug';
import { useSettingsStore } from '@/shared/stores/settingsStore';

/**
 * 서비스 초기화 훅
 *
 * DB 초기화 완료 후 디버그 함수 노출, 비활동 알림, 비활동 시 집중 모드 전환 등의
 * 부가 서비스를 초기화합니다. 설정에 따라 서비스 활성화 여부가 결정됩니다.
 *
 * @param {boolean} dbInitialized - DB 초기화 완료 여부
 * @returns {void}
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

      cleanup = () => {
        inactivityAlertService.stop();
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

    // 동적 import로 서비스 불러오기
    import('@/shared/services/behavior/idleFocusModeService').then(({ idleFocusModeService }) => {
      // 설정에서 활성화되어 있을 때만 시작
      if (settings?.idleFocusModeEnabled) {
        // 이미 실행 중이면 중지 후 재시작
        idleFocusModeService.stop();
        idleFocusModeService.start();
      } else {
        // 비활성화되면 중지
        idleFocusModeService.stop();
      }

      cleanup = () => {
        idleFocusModeService.stop();
      };
    });

    return () => {
      cleanup?.();
    };
  }, [dbInitialized, settings?.idleFocusModeEnabled, settings?.idleFocusModeMinutes]);
}
