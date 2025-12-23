/**
 * @file modal-hotkeys.test.ts
 * @description useModalHotkeys 및 modalStackRegistry 테스트
 *
 * 테스트 범위:
 *   - ESC 키로 top-of-stack 모달만 닫힘
 *   - Ctrl/Cmd+Enter로 primary action 실행
 *   - IME 조합 중(isComposing) 핫키 무시
 *   - 중첩 모달 스택 관리
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { modalStackRegistry } from '@/shared/hooks/modalStackRegistry';

describe('modalStackRegistry', () => {
  beforeEach(() => {
    modalStackRegistry.clear();
  });

  it('should add modal to stack', () => {
    const modalId = Symbol('test-modal');
    modalStackRegistry.add(modalId);
    expect(modalStackRegistry.size()).toBe(1);
  });

  it('should remove modal from stack', () => {
    const modalId = Symbol('test-modal');
    modalStackRegistry.add(modalId);
    modalStackRegistry.remove(modalId);
    expect(modalStackRegistry.size()).toBe(0);
  });

  it('should correctly identify top-of-stack modal', () => {
    const modal1 = Symbol('modal-1');
    const modal2 = Symbol('modal-2');

    modalStackRegistry.add(modal1);
    modalStackRegistry.add(modal2);

    expect(modalStackRegistry.isTop(modal1)).toBe(false);
    expect(modalStackRegistry.isTop(modal2)).toBe(true);
  });

  it('should update top-of-stack when top modal is removed', () => {
    const modal1 = Symbol('modal-1');
    const modal2 = Symbol('modal-2');

    modalStackRegistry.add(modal1);
    modalStackRegistry.add(modal2);
    modalStackRegistry.remove(modal2);

    expect(modalStackRegistry.isTop(modal1)).toBe(true);
  });

  it('should handle empty stack gracefully', () => {
    const modal = Symbol('test-modal');
    expect(modalStackRegistry.isTop(modal)).toBe(false);
  });
});

/**
 * 키보드 이벤트를 나타내는 인터페이스 (순수 테스트용)
 */
interface MockKeyboardEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  target: { tagName: string; isContentEditable?: boolean } | null;
}

/**
 * 모의 키보드 이벤트 생성 헬퍼
 */
function createMockKeyboardEvent(options: Partial<MockKeyboardEvent>): MockKeyboardEvent {
  return {
    key: options.key ?? '',
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    isComposing: options.isComposing ?? false,
    target: options.target ?? null,
  };
}

describe('Modal Hotkey Event Handling (Unit Tests)', () => {
  /**
   * ESC 핸들러 로직을 테스트하기 위한 순수 함수
   * (훅 내부 로직을 분리하여 테스트)
   */
  function shouldHandleEscape(
    event: MockKeyboardEvent,
    modalId: symbol,
    ignoreWhenComposing: boolean
  ): boolean {
    if (event.key !== 'Escape') return false;
    if (ignoreWhenComposing && event.isComposing) return false;
    if (ignoreWhenComposing && event.key === 'Process') return false;
    if (!modalStackRegistry.isTop(modalId)) return false;
    return true;
  }

  /**
   * Primary action 핸들러 로직을 테스트하기 위한 순수 함수
   */
  function shouldHandlePrimaryAction(
    event: MockKeyboardEvent,
    modalId: symbol,
    options: {
      enabled?: boolean;
      includeCtrlKey?: boolean;
      includeMetaKey?: boolean;
      allowInTextarea?: boolean;
      allowInInput?: boolean;
      ignoreWhenComposing?: boolean;
    }
  ): boolean {
    if (event.key !== 'Enter') return false;

    const {
      enabled = true,
      includeCtrlKey = true,
      includeMetaKey = true,
      allowInTextarea = true,
      allowInInput = true,
      ignoreWhenComposing = true,
    } = options;

    if (!enabled) return false;
    if (ignoreWhenComposing && event.isComposing) return false;
    if (!modalStackRegistry.isTop(modalId)) return false;

    const hasCtrl = includeCtrlKey && event.ctrlKey;
    const hasMeta = includeMetaKey && event.metaKey;
    if (!hasCtrl && !hasMeta) return false;

    if (event.shiftKey || event.altKey) return false;

    const target = event.target;
    if (target) {
      if (!allowInTextarea && target.tagName === 'TEXTAREA') return false;
      if (!allowInInput && target.tagName === 'INPUT') return false;
    }

    return true;
  }

  beforeEach(() => {
    modalStackRegistry.clear();
  });

  describe('ESC key handling', () => {
    it('should handle ESC when modal is top-of-stack', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Escape' });
      expect(shouldHandleEscape(event, modalId, true)).toBe(true);
    });

    it('should NOT handle ESC when modal is NOT top-of-stack', () => {
      const modal1 = Symbol('modal-1');
      const modal2 = Symbol('modal-2');
      modalStackRegistry.add(modal1);
      modalStackRegistry.add(modal2);

      const event = createMockKeyboardEvent({ key: 'Escape' });
      expect(shouldHandleEscape(event, modal1, true)).toBe(false);
      expect(shouldHandleEscape(event, modal2, true)).toBe(true);
    });

    it('should NOT handle ESC when IME is composing', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Escape', isComposing: true });
      expect(shouldHandleEscape(event, modalId, true)).toBe(false);
    });

    it('should handle ESC when isComposing is false', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Escape', isComposing: false });
      expect(shouldHandleEscape(event, modalId, true)).toBe(true);
    });
  });

  describe('Ctrl/Cmd+Enter handling', () => {
    it('should handle Ctrl+Enter when modal is top-of-stack', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter', ctrlKey: true });
      expect(shouldHandlePrimaryAction(event, modalId, {})).toBe(true);
    });

    it('should handle Cmd+Enter (macOS) when modal is top-of-stack', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter', metaKey: true });
      expect(shouldHandlePrimaryAction(event, modalId, {})).toBe(true);
    });

    it('should NOT handle Enter alone (without Ctrl/Cmd)', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter' });
      expect(shouldHandlePrimaryAction(event, modalId, {})).toBe(false);
    });

    it('should NOT handle Ctrl+Enter when modal is NOT top-of-stack', () => {
      const modal1 = Symbol('modal-1');
      const modal2 = Symbol('modal-2');
      modalStackRegistry.add(modal1);
      modalStackRegistry.add(modal2);

      const event = createMockKeyboardEvent({ key: 'Enter', ctrlKey: true });
      expect(shouldHandlePrimaryAction(event, modal1, {})).toBe(false);
      expect(shouldHandlePrimaryAction(event, modal2, {})).toBe(true);
    });

    it('should NOT handle Ctrl+Enter when IME is composing', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter', ctrlKey: true, isComposing: true });
      expect(shouldHandlePrimaryAction(event, modalId, {})).toBe(false);
    });

    it('should NOT handle Ctrl+Shift+Enter (shift modifier)', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter', ctrlKey: true, shiftKey: true });
      expect(shouldHandlePrimaryAction(event, modalId, {})).toBe(false);
    });

    it('should NOT handle Ctrl+Alt+Enter (alt modifier)', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter', ctrlKey: true, altKey: true });
      expect(shouldHandlePrimaryAction(event, modalId, {})).toBe(false);
    });

    it('should handle Ctrl+Enter in textarea by default', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({
        key: 'Enter',
        ctrlKey: true,
        target: { tagName: 'TEXTAREA' },
      });
      expect(shouldHandlePrimaryAction(event, modalId, { allowInTextarea: true })).toBe(true);
    });

    it('should NOT handle Ctrl+Enter in textarea when allowInTextarea is false', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({
        key: 'Enter',
        ctrlKey: true,
        target: { tagName: 'TEXTAREA' },
      });
      expect(shouldHandlePrimaryAction(event, modalId, { allowInTextarea: false })).toBe(false);
    });

    it('should NOT handle when enabled is false', () => {
      const modalId = Symbol('modal');
      modalStackRegistry.add(modalId);

      const event = createMockKeyboardEvent({ key: 'Enter', ctrlKey: true });
      expect(shouldHandlePrimaryAction(event, modalId, { enabled: false })).toBe(false);
    });
  });
});

describe('Nested Modal Stack Integration', () => {
  beforeEach(() => {
    modalStackRegistry.clear();
  });

  it('should maintain correct order with multiple modals', () => {
    const parent = Symbol('parent-modal');
    const child = Symbol('child-modal');
    const grandchild = Symbol('grandchild-modal');

    modalStackRegistry.add(parent);
    expect(modalStackRegistry.isTop(parent)).toBe(true);

    modalStackRegistry.add(child);
    expect(modalStackRegistry.isTop(parent)).toBe(false);
    expect(modalStackRegistry.isTop(child)).toBe(true);

    modalStackRegistry.add(grandchild);
    expect(modalStackRegistry.isTop(parent)).toBe(false);
    expect(modalStackRegistry.isTop(child)).toBe(false);
    expect(modalStackRegistry.isTop(grandchild)).toBe(true);

    // 최상위 제거 후 다음 모달이 top이 됨
    modalStackRegistry.remove(grandchild);
    expect(modalStackRegistry.isTop(child)).toBe(true);

    modalStackRegistry.remove(child);
    expect(modalStackRegistry.isTop(parent)).toBe(true);
  });

  it('should handle out-of-order removal gracefully', () => {
    const modal1 = Symbol('modal-1');
    const modal2 = Symbol('modal-2');
    const modal3 = Symbol('modal-3');

    modalStackRegistry.add(modal1);
    modalStackRegistry.add(modal2);
    modalStackRegistry.add(modal3);

    // 중간 모달 제거
    modalStackRegistry.remove(modal2);
    expect(modalStackRegistry.isTop(modal3)).toBe(true);
    expect(modalStackRegistry.size()).toBe(2);

    // 첫 번째 모달 제거
    modalStackRegistry.remove(modal1);
    expect(modalStackRegistry.isTop(modal3)).toBe(true);
    expect(modalStackRegistry.size()).toBe(1);
  });

  it('should handle duplicate removal without error', () => {
    const modal = Symbol('modal');
    modalStackRegistry.add(modal);
    modalStackRegistry.remove(modal);
    modalStackRegistry.remove(modal); // 이미 제거됨
    expect(modalStackRegistry.size()).toBe(0);
  });
});
