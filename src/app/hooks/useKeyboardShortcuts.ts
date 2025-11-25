/**
 * useKeyboardShortcuts Hook
 *
 * @role 키보드 단축키 처리 로직을 분리한 커스텀 훅
 * @input settings, callback functions
 * @output 없음 (사이드 이펙트만)
 */

import { useEffect, useCallback } from 'react';
import type { Settings } from '@/shared/types/domain';

interface KeyboardShortcutsConfig {
  settings: Settings | null;
  onBulkAdd: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
}

/**
 * 단축키 매칭 헬퍼 함수
 */
function matchesShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  const parts = shortcutStr.split('+').map(p => p.trim());
  const keyPart = parts[parts.length - 1];

  // 수정자 키 확인
  const needsCtrl = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');

  // 수정자 키가 하나라도 필요한 경우
  if (needsCtrl || needsShift || needsAlt) {
    return (
      (!needsCtrl || e.ctrlKey) &&
      (!needsShift || e.shiftKey) &&
      (!needsAlt || e.altKey) &&
      e.key.toUpperCase() === keyPart.toUpperCase()
    );
  }

  // 단순 키인 경우 (수정자 키 없이)
  return (
    !e.ctrlKey && !e.shiftKey && !e.altKey &&
    e.key.toUpperCase() === keyPart.toUpperCase()
  );
}

/**
 * 입력 필드인지 확인
 */
function isInputField(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    !!target.closest('[contenteditable="true"]')
  );
}

/**
 * 키보드 단축키 처리 훅
 */
export function useKeyboardShortcuts({
  settings,
  onBulkAdd,
  onToggleLeftPanel,
  onToggleRightPanel,
}: KeyboardShortcutsConfig): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 입력 필드에서는 단축키 비활성화
    if (isInputField(e.target)) return;

    // F1: 대량 할 일 추가 (설정 가능)
    const bulkAddKey = settings?.bulkAddModalKey || 'F1';
    if (matchesShortcut(e, bulkAddKey)) {
      e.preventDefault();
      onBulkAdd();
      return;
    }

    // 좌측 패널 토글 (기본: Ctrl+B)
    const leftKey = settings?.leftPanelToggleKey || 'Ctrl+B';
    if (matchesShortcut(e, leftKey)) {
      e.preventDefault();
      onToggleLeftPanel();
      return;
    }

    // 우측 패널 토글 (기본: Ctrl+Shift+B)
    const rightKey = settings?.rightPanelToggleKey || 'Ctrl+Shift+B';
    if (matchesShortcut(e, rightKey)) {
      e.preventDefault();
      onToggleRightPanel();
      return;
    }
  }, [settings, onBulkAdd, onToggleLeftPanel, onToggleRightPanel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
