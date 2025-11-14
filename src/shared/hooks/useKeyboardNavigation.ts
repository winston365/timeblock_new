/**
 * useKeyboardNavigation - 키보드 네비게이션 훅
 * WCAG 2.1 AAA 준수를 위한 전역 키보드 단축키 관리
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

interface UseKeyboardNavigationOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * 키보드 단축키를 등록하고 관리하는 훅
 *
 * @example
 * ```tsx
 * useKeyboardNavigation({
 *   shortcuts: [
 *     { key: 'n', description: '새 작업', handler: () => openNewTask() },
 *     { key: 'f', description: '집중 모드', handler: () => toggleFocus() },
 *     { key: '/', description: '검색', handler: () => focusSearch(), preventDefault: true }
 *   ]
 * });
 * ```
 */
export function useKeyboardNavigation({
  shortcuts,
  enabled = true
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 입력 요소에서는 단축키 비활성화
    const target = event.target as HTMLElement;
    const isInputElement = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const isContentEditable = target.isContentEditable;

    if (isInputElement || isContentEditable) {
      // '/' 키는 검색을 위해 예외 처리
      if (event.key !== '/') {
        return;
      }
    }

    // 등록된 단축키 찾기
    const shortcut = shortcuts.find(s => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = s.ctrlKey === undefined || s.ctrlKey === event.ctrlKey;
      const shiftMatch = s.shiftKey === undefined || s.shiftKey === event.shiftKey;
      const altMatch = s.altKey === undefined || s.altKey === event.altKey;
      const metaMatch = s.metaKey === undefined || s.metaKey === event.metaKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
    });

    if (shortcut) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }
      shortcut.handler(event);
    }
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // 단축키 목록 반환 (도움말 표시용)
  return {
    shortcuts: shortcuts.map(s => ({
      key: s.key,
      modifiers: {
        ctrl: s.ctrlKey,
        shift: s.shiftKey,
        alt: s.altKey,
        meta: s.metaKey,
      },
      description: s.description,
    })),
  };
}

/**
 * 화살표 키를 이용한 포커스 이동 훅
 *
 * @example
 * ```tsx
 * const containerRef = useArrowKeyNavigation<HTMLDivElement>({
 *   selector: '.time-block',
 *   orientation: 'vertical'
 * });
 *
 * return <div ref={containerRef}>...</div>
 * ```
 */
export function useArrowKeyNavigation<T extends HTMLElement>({
  selector,
  orientation = 'vertical',
  loop = false,
  enabled = true,
}: {
  selector: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
  loop?: boolean;
  enabled?: boolean;
}) {
  const containerRef = useCallback((container: T | null) => {
    if (!container || !enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
      const currentIndex = items.findIndex(item => item === document.activeElement);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      let handled = false;

      // 세로 방향
      if (orientation === 'vertical' || orientation === 'both') {
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex + 1;
          handled = true;
        } else if (event.key === 'ArrowUp') {
          nextIndex = currentIndex - 1;
          handled = true;
        }
      }

      // 가로 방향
      if (orientation === 'horizontal' || orientation === 'both') {
        if (event.key === 'ArrowRight') {
          nextIndex = currentIndex + 1;
          handled = true;
        } else if (event.key === 'ArrowLeft') {
          nextIndex = currentIndex - 1;
          handled = true;
        }
      }

      if (!handled) return;

      // Home/End 키 지원
      if (event.key === 'Home') {
        nextIndex = 0;
        handled = true;
      } else if (event.key === 'End') {
        nextIndex = items.length - 1;
        handled = true;
      }

      // 범위 체크
      if (loop) {
        nextIndex = (nextIndex + items.length) % items.length;
      } else {
        nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
      }

      // 다음 요소로 포커스 이동
      if (nextIndex !== currentIndex && items[nextIndex]) {
        event.preventDefault();
        items[nextIndex].focus();

        // 스크롤 위치 조정
        items[nextIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [selector, orientation, loop, enabled]);

  return containerRef;
}

/**
 * Tab 키를 이용한 탭 네비게이션 훅
 *
 * @example
 * ```tsx
 * const { activeTab, setActiveTab, tabListProps, getTabProps, getPanelProps } = useTabNavigation({
 *   tabs: ['today', 'stats', 'energy'],
 *   defaultTab: 'today'
 * });
 * ```
 */
export function useTabNavigation({
  tabs,
  defaultTab,
  onChange,
}: {
  tabs: string[];
  defaultTab?: string;
  onChange?: (tab: string) => void;
}) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    onChange?.(tab);
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      handleTabChange(tabs[nextIndex]);
    }
  }, [activeTab, tabs, handleTabChange]);

  return {
    activeTab,
    setActiveTab: handleTabChange,
    tabListProps: {
      role: 'tablist',
      onKeyDown: handleKeyDown,
    },
    getTabProps: (tab: string) => ({
      role: 'tab',
      'aria-selected': activeTab === tab,
      'aria-controls': `panel-${tab}`,
      id: `tab-${tab}`,
      tabIndex: activeTab === tab ? 0 : -1,
      onClick: () => handleTabChange(tab),
    }),
    getPanelProps: (tab: string) => ({
      role: 'tabpanel',
      'aria-labelledby': `tab-${tab}`,
      id: `panel-${tab}`,
      hidden: activeTab !== tab,
    }),
  };
}

// React import 추가 (useTabNavigation에서 사용)
import React from 'react';
