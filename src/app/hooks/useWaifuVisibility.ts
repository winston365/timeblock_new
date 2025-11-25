/**
 * useWaifuVisibility Hook
 *
 * @role 와이푸 패널 가시성 관련 로직 분리
 * @input visibility from waifuCompanionStore
 * @output CSS 클래스 및 Focus 관리
 */

import { useEffect, useMemo } from 'react';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

interface WaifuVisibilityState {
  visibility: 'visible' | 'peeking' | 'hidden';
  waifuVisibilityClass: string;
  waifuContainerClass: string;
}

/**
 * 와이푸 패널 가시성 관리 훅
 */
export function useWaifuVisibility(): WaifuVisibilityState {
  const { visibility } = useWaifuCompanionStore();

  // Focus safety: 와이푸 패널이 숨겨질 때 포커스 이동
  useEffect(() => {
    if (visibility === 'visible') return;
    
    const container = document.querySelector('.waifu-panel-container');
    const active = document.activeElement as HTMLElement | null;
    
    if (container && active && container.contains(active)) {
      active.blur();
      const main = document.getElementById('main-content');
      main?.focus();
    }
  }, [visibility]);

  // 가시성 클래스 계산
  const waifuVisibilityClass = useMemo(() => {
    switch (visibility) {
      case 'visible':
        return 'translate-x-0 opacity-100 pointer-events-auto scale-100';
      case 'peeking':
        return 'translate-x-[calc(100%-0.35rem)] opacity-60 pointer-events-none scale-95';
      default:
        return 'translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none scale-95';
    }
  }, [visibility]);

  const waifuContainerClass = useMemo(() => {
    const baseClass = 'waifu-panel-container fixed bottom-0 right-0 z-40 p-4';
    return visibility === 'visible' ? baseClass : `${baseClass} pointer-events-none`;
  }, [visibility]);

  return {
    visibility,
    waifuVisibilityClass,
    waifuContainerClass,
  };
}
