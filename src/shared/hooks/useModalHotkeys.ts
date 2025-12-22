/**
 * @file useModalHotkeys.ts
 *
 * @role 모달 키보드 핫키 통합 관리 훅 (ESC 닫기 + Ctrl/Cmd+Enter Primary 실행)
 *
 * @responsibilities
 *   - ESC 키로 모달 닫기 (top-of-stack만 반응)
 *   - Ctrl/Cmd+Enter로 primary action 실행
 *   - IME 조합 중(isComposing) 단축키 무시
 *   - 중첩 모달 스택 관리
 *
 * @dependencies
 *   - modalStackRegistry: 공유 모달 스택 (useModalEscapeClose와 동일)
 */

import { useEffect, useRef } from 'react';
import { modalStackRegistry } from './modalStackRegistry';

/**
 * Primary action 핫키 옵션
 */
export interface PrimaryHotkeyOptions {
  /** primary action이 활성화되어 있는지 (default: true) */
  enabled?: boolean;
  /** primary action 콜백 */
  onPrimary: () => void | Promise<void>;
  /** macOS Cmd+Enter 허용 (default: true) */
  includeMetaKey?: boolean;
  /** Win/Linux Ctrl+Enter 허용 (default: true) */
  includeCtrlKey?: boolean;
  /** textarea에서도 허용 (default: true) */
  allowInTextarea?: boolean;
  /** input에서도 허용 (default: true) */
  allowInInput?: boolean;
  /** contentEditable에서도 허용 (default: true) */
  allowInContentEditable?: boolean;
}

/**
 * useModalHotkeys 옵션
 */
export interface UseModalHotkeysOptions {
  /** 모달이 열려있는지 */
  isOpen: boolean;
  /** ESC 닫기 콜백 (없으면 ESC 바인딩 안 함) */
  onEscapeClose?: () => void;
  /** Primary action 옵션 (없으면 Ctrl+Enter 바인딩 안 함) */
  primaryAction?: PrimaryHotkeyOptions;
  /** 처리 시 preventDefault (default: true) */
  preventDefaultWhenHandled?: boolean;
  /** 처리 시 stopPropagation (default: true) */
  stopPropagationWhenHandled?: boolean;
  /** IME 조합 중 무시 (default: true) */
  ignoreWhenComposing?: boolean;
}

/**
 * 모달 키보드 핫키 통합 관리 훅
 *
 * - ESC: top-of-stack 모달만 닫힘
 * - Ctrl/Cmd+Enter: top-of-stack 모달의 primary action 실행
 * - IME 조합 중에는 동작하지 않음
 *
 * @example
 * ```tsx
 * useModalHotkeys({
 *   isOpen,
 *   onEscapeClose: handleClose,
 *   primaryAction: {
 *     onPrimary: handleSubmit,
 *   },
 * });
 * ```
 */
export function useModalHotkeys(options: UseModalHotkeysOptions): void {
  const {
    isOpen,
    onEscapeClose,
    primaryAction,
    preventDefaultWhenHandled = true,
    stopPropagationWhenHandled = true,
    ignoreWhenComposing = true,
  } = options;

  const modalIdRef = useRef<symbol | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // 모달이 닫히면 스택에서 제거
      if (modalIdRef.current) {
        modalStackRegistry.remove(modalIdRef.current);
        modalIdRef.current = null;
      }
      return;
    }

    // 모달이 열리면 고유 ID 생성 후 스택에 추가
    const modalId = Symbol('modal-hotkeys');
    modalIdRef.current = modalId;
    modalStackRegistry.add(modalId);

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중 무시
      if (ignoreWhenComposing && e.isComposing) {
        return;
      }

      // Chromium/Electron에서 IME 조합 중 key가 'Process'인 경우도 무시
      if (ignoreWhenComposing && e.key === 'Process') {
        return;
      }

      // top-of-stack 검증
      if (!modalStackRegistry.isTop(modalId)) {
        return;
      }

      // ESC 처리
      if (e.key === 'Escape' && onEscapeClose) {
        if (preventDefaultWhenHandled) e.preventDefault();
        if (stopPropagationWhenHandled) e.stopPropagation();
        onEscapeClose();
        return;
      }

      // Ctrl/Cmd+Enter 처리
      if (e.key === 'Enter' && primaryAction) {
        const {
          enabled = true,
          onPrimary,
          includeMetaKey = true,
          includeCtrlKey = true,
          allowInTextarea = true,
          allowInInput = true,
          allowInContentEditable = true,
        } = primaryAction;

        if (!enabled) return;

        // Ctrl/Cmd 키 체크
        const hasCtrl = includeCtrlKey && e.ctrlKey;
        const hasMeta = includeMetaKey && e.metaKey;

        if (!hasCtrl && !hasMeta) return;

        // Shift/Alt와 조합된 경우 무시 (다른 단축키와 충돌 방지)
        if (e.shiftKey || e.altKey) return;

        // 포커스 컨텍스트 체크
        const target = e.target as HTMLElement;

        if (!allowInTextarea && target.tagName === 'TEXTAREA') return;
        if (!allowInInput && target.tagName === 'INPUT') return;
        if (!allowInContentEditable && target.isContentEditable) return;

        if (preventDefaultWhenHandled) e.preventDefault();
        if (stopPropagationWhenHandled) e.stopPropagation();

        // 비동기 함수 처리
        void onPrimary();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      modalStackRegistry.remove(modalId);
      modalIdRef.current = null;
    };
  }, [
    isOpen,
    onEscapeClose,
    primaryAction,
    preventDefaultWhenHandled,
    stopPropagationWhenHandled,
    ignoreWhenComposing,
  ]);
}
