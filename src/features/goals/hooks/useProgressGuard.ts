/**
 * useProgressGuard.ts
 *
 * @file 진행도 변경 Guard 훅
 * @description
 *   - T26: 큰 폭의 진행도 변경 시 확인 요청
 *   - ADHD 친화적: 실수 방지, 안전 장치
 */

import { useCallback } from 'react';
import { PROGRESS_GUARD } from '../constants/goalConstants';

interface UseProgressGuardReturn {
  /** 변경 가능 여부 확인 (큰 변경 시 confirm 표시) */
  checkChange: (currentProgress: number, delta: number, goalTitle: string) => boolean;
  /** 직접 설정 가능 여부 확인 */
  checkDirectSet: (currentProgress: number, newProgress: number, goalTitle: string) => boolean;
}

/**
 * 진행도 변경 Guard 훅
 */
export function useProgressGuard(): UseProgressGuardReturn {
  // 변경 가능 여부 확인 (증감)
  const checkChange = useCallback(
    (currentProgress: number, delta: number, goalTitle: string): boolean => {
      const absDelta = Math.abs(delta);

      // 최대 허용 변경량 초과
      if (absDelta > PROGRESS_GUARD.MAX_SINGLE_CHANGE) {
        alert(`한 번에 ${PROGRESS_GUARD.MAX_SINGLE_CHANGE} 이상 변경할 수 없습니다.`);
        return false;
      }

      // 확인 필요 임계값 초과
      if (absDelta >= PROGRESS_GUARD.CONFIRM_THRESHOLD) {
        const message = delta > 0
          ? `"${goalTitle}" 목표에 +${delta}를 추가하시겠습니까?\n(현재: ${currentProgress} → ${currentProgress + delta})`
          : `"${goalTitle}" 목표에서 ${Math.abs(delta)}를 빼시겠습니까?\n(현재: ${currentProgress} → ${currentProgress + delta})`;

        return confirm(message);
      }

      return true;
    },
    []
  );

  // 직접 설정 가능 여부 확인
  const checkDirectSet = useCallback(
    (currentProgress: number, newProgress: number, goalTitle: string): boolean => {
      const delta = Math.abs(newProgress - currentProgress);

      // 최대 허용 변경량 초과
      if (delta > PROGRESS_GUARD.MAX_SINGLE_CHANGE) {
        alert(`한 번에 ${PROGRESS_GUARD.MAX_SINGLE_CHANGE} 이상 변경할 수 없습니다.`);
        return false;
      }

      // 확인 필요 임계값 초과
      if (delta >= PROGRESS_GUARD.CONFIRM_THRESHOLD) {
        const message = `"${goalTitle}" 목표 진행도를 ${currentProgress}에서 ${newProgress}(으)로 변경하시겠습니까?`;
        return confirm(message);
      }

      return true;
    },
    []
  );

  return {
    checkChange,
    checkDirectSet,
  };
}
