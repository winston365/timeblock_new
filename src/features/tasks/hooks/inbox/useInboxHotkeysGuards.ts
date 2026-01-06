/**
 * @file useInboxHotkeysGuards.ts
 * @description 인박스 핫키 가드(모달 오픈/입력 포커스) 로직
 */

import { useCallback } from 'react';
import { modalStackRegistry } from '@/shared/hooks/modalStackRegistry';

export interface UseInboxHotkeysGuardsParams {
  triageEnabled: boolean;
}

export interface UseInboxHotkeysGuardsResult {
  isModalOpen: () => boolean;
  isInputFocused: () => boolean;
}

export const useInboxHotkeysGuards = (
  params: UseInboxHotkeysGuardsParams,
): UseInboxHotkeysGuardsResult => {
  const { triageEnabled } = params;

  const isModalOpen = useCallback((): boolean => {
    return modalStackRegistry.size() > 0;
  }, []);

  const isInputFocused = useCallback((): boolean => {
    // Triage 모드에서는 입력 필드 포커스 체크를 건너뜀
    if (triageEnabled) return false;

    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toUpperCase();
    const isEditable = (activeElement as HTMLElement).isContentEditable;

    return tagName === 'INPUT' || tagName === 'TEXTAREA' || isEditable;
  }, [triageEnabled]);

  return { isModalOpen, isInputFocused };
};
