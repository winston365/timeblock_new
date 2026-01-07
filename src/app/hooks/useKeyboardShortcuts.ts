/**
 * useKeyboardShortcuts Hook
 *
 * @file useKeyboardShortcuts.ts
 * @role 키보드 단축키 처리 로직 분리
 * @responsibilities
 *   - 전역 키보드 단축키 감지 및 실행
 *   - 입력 필드에서 단축키 비활성화
 *   - 설정 기반 단축키 매핑
 * @dependencies
 *   - Settings: 단축키 설정 정보
 */

import { useEffect, useCallback } from 'react';
import type { Settings } from '@/shared/types/domain';

/**
 * 키보드 단축키 훅 설정 인터페이스
 */
interface KeyboardShortcutsConfig {
  /** 단축키 설정을 포함한 설정 객체 */
  settings: Settings | null;
  /** 대량 추가 모달 열기 콜백 */
  onBulkAdd: () => void;
  /** 좌측 패널 토글 콜백 */
  onToggleLeftPanel: () => void;
  /** 창 최상위 토글 콜백 */
  onToggleAlwaysOnTop?: () => void;
}

/**
 * 단축키 매칭 헬퍼 함수
 *
 * 키보드 이벤트가 주어진 단축키 문자열과 일치하는지 확인합니다.
 *
 * @param {KeyboardEvent} keyboardEvent - 키보드 이벤트
 * @param {string} shortcutStr - 단축키 문자열 (e.g., 'Ctrl+Shift+B')
 * @returns {boolean} 단축키 일치 여부
 */
function matchesShortcut(keyboardEvent: KeyboardEvent, shortcutStr: string): boolean {
  const parts = shortcutStr.split('+').map(part => part.trim());
  const keyPart = parts[parts.length - 1];

  // 수정자 키 확인
  const needsCtrl = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');

  // 수정자 키가 하나라도 필요한 경우
  if (needsCtrl || needsShift || needsAlt) {
    return (
      (!needsCtrl || keyboardEvent.ctrlKey) &&
      (!needsShift || keyboardEvent.shiftKey) &&
      (!needsAlt || keyboardEvent.altKey) &&
      keyboardEvent.key.toUpperCase() === keyPart.toUpperCase()
    );
  }

  // 단순 키인 경우 (수정자 키 없이)
  return (
    !keyboardEvent.ctrlKey && !keyboardEvent.shiftKey && !keyboardEvent.altKey &&
    keyboardEvent.key.toUpperCase() === keyPart.toUpperCase()
  );
}

/**
 * 입력 필드인지 확인
 *
 * 대상 요소가 텍스트 입력을 받는 필드인지 확인합니다.
 *
 * @param {EventTarget | null} eventTarget - 이벤트 대상 요소
 * @returns {boolean} 입력 필드 여부
 */
function isInputField(eventTarget: EventTarget | null): boolean {
  if (!eventTarget || !(eventTarget instanceof HTMLElement)) return false;
  
  return (
    eventTarget.tagName === 'INPUT' ||
    eventTarget.tagName === 'TEXTAREA' ||
    eventTarget.isContentEditable ||
    !!eventTarget.closest('[contenteditable="true"]')
  );
}

/**
 * 키보드 단축키 처리 훅
 *
 * 앱 전역 키보드 단축키를 등록하고 처리합니다.
 * 입력 필드에서는 단축키가 비활성화됩니다.
 *
 * @param {KeyboardShortcutsConfig} config - 단축키 설정 및 콜백 함수
 * @param {Settings | null} config.settings - 단축키 설정
 * @param {() => void} config.onBulkAdd - 대량 추가 모달 열기 콜백
 * @param {() => void} config.onToggleLeftPanel - 좌측 패널 토글 콜백
 * @returns {void}
 */
export function useKeyboardShortcuts({
  settings,
  onBulkAdd,
  onToggleLeftPanel,
  onToggleAlwaysOnTop,
}: KeyboardShortcutsConfig): void {
  const handleKeyDown = useCallback((keyboardEvent: KeyboardEvent) => {
    // 입력 필드에서는 단축키 비활성화
    if (isInputField(keyboardEvent.target)) return;

    // F1: 대량 할 일 추가 (설정 가능)
    const bulkAddKey = settings?.bulkAddModalKey || 'F1';
    if (matchesShortcut(keyboardEvent, bulkAddKey)) {
      keyboardEvent.preventDefault();
      onBulkAdd();
      return;
    }

    // 좌측 패널 토글 (기본: Ctrl+B)
    const leftKey = settings?.leftPanelToggleKey || 'Ctrl+B';
    if (matchesShortcut(keyboardEvent, leftKey)) {
      keyboardEvent.preventDefault();
      onToggleLeftPanel();
      return;
    }

    // 창 최상위 토글 (기본: Ctrl+Shift+T)
    const alwaysOnTopKey = settings?.alwaysOnTopToggleKey || 'Ctrl+Shift+T';
    if (onToggleAlwaysOnTop && matchesShortcut(keyboardEvent, alwaysOnTopKey)) {
      keyboardEvent.preventDefault();
      onToggleAlwaysOnTop();
      return;
    }
  }, [settings, onBulkAdd, onToggleLeftPanel, onToggleAlwaysOnTop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
