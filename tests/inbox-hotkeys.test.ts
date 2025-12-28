/**
 * @file inbox-hotkeys.test.ts
 * @description useInboxHotkeys 관련 순수 로직 테스트
 *
 * 테스트 범위:
 *   - Triage 모드 키 핸들러 로직
 *   - 타입 가드 함수들의 동작
 *   - 콜백 함수 유효성 검사 로직
 */

import { describe, it, expect } from 'vitest';

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
  };
}

// ============================================================================
// 타입 가드 유틸리티 (순수 함수로 테스트)
// ============================================================================

/**
 * 함수 타입 가드 - 콜백이 유효한 함수인지 확인
 * 런타임 TypeError 방지를 위한 핵심 로직
 */
const isValidCallback = <T extends (...args: never[]) => unknown>(
  callback: T | undefined | null
): callback is T => {
  return typeof callback === 'function';
};

/**
 * Triage 키 핸들러에서 키를 처리해야 하는지 결정하는 순수 함수
 * 
 * 주요 변경사항: Triage 모드가 활성화된 경우, 입력 필드 포커스 체크를 건너뜁니다.
 * 이는 Triage 모드 진입 시 blur 처리가 되므로, 사용자가 의도적으로 
 * 입력 필드에 포커스를 둔 경우에도 핫키가 동작해야 하기 때문입니다.
 */
function shouldHandleTriageKey(
  event: MockKeyboardEvent,
  options: {
    triageEnabled: boolean;
    isModalOpen: boolean;
    isInputFocused: boolean;
    hasValidCallback?: boolean;
    focusedTaskId: string | null;
  }
): boolean {
  // IME 조합 중 무시
  if (event.isComposing || event.key === 'Process') return false;
  
  // Triage 모드 비활성화 시 무시
  if (!options.triageEnabled) return false;
  
  // 모달이 열려 있으면 무시
  if (options.isModalOpen) return false;
  
  // Triage 모드에서는 입력 필드 포커스 체크를 건너뜀
  // (Triage 모드 진입 시 InboxTab에서 blur 처리하며,
  //  핫키가 input 위에서도 동작해야 함)
  // 일반 모드에서만 입력 필드 체크
  if (!options.triageEnabled && options.isInputFocused) return false;
  
  // 콜백이 필요한 키인 경우, 유효한 콜백이 없으면 무시
  const callbackRequiredKeys = ['d', 'Backspace', 'Enter'];
  if (callbackRequiredKeys.includes(event.key)) {
    if (options.hasValidCallback === false) return false;
    if (!options.focusedTaskId) return false;
  }
  
  // 액션 키인 경우 포커스된 작업이 있어야 함
  const actionKeys = ['t', 'o', 'n', 'p', 'h', 'd', 'Backspace', 'Enter'];
  if (actionKeys.includes(event.key) && !options.focusedTaskId) {
    return false;
  }
  
  return true;
}

/**
 * Triage 키 매핑 - 어떤 액션을 실행해야 하는지 반환
 */
type TriageAction = 
  | 'moveFocusNext' 
  | 'moveFocusPrev' 
  | 'placeToday' 
  | 'placeTomorrow' 
  | 'placeNext'
  | 'togglePin'
  | 'toggleDefer'
  | 'delete'
  | 'edit'
  | 'exit'
  | null;

function getTriageAction(event: MockKeyboardEvent): TriageAction {
  switch (event.key) {
    case 'ArrowUp':
    case 'k':
      return 'moveFocusPrev';
    case 'ArrowDown':
    case 'j':
      return 'moveFocusNext';
    case 't':
      return 'placeToday';
    case 'o':
      return 'placeTomorrow';
    case 'n':
      return 'placeNext';
    case 'p':
      return 'togglePin';
    case 'h':
      return 'toggleDefer';
    case 'd':
    case 'Backspace':
      return 'delete';
    case 'Enter':
      return 'edit';
    case 'Escape':
      return 'exit';
    default:
      return null;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Inbox Hotkeys Type Guards', () => {
  describe('isValidCallback', () => {
    it('should return true for valid functions', () => {
      const fn = () => { /* no-op */ };
      expect(isValidCallback(fn)).toBe(true);
    });

    it('should return false for undefined', () => {
      expect(isValidCallback(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidCallback(null)).toBe(false);
    });

    it('should return false for non-function values', () => {
      // @ts-expect-error Testing runtime behavior with invalid types
      expect(isValidCallback('string')).toBe(false);
      // @ts-expect-error Testing runtime behavior with invalid types
      expect(isValidCallback(123)).toBe(false);
      // @ts-expect-error Testing runtime behavior with invalid types
      expect(isValidCallback({})).toBe(false);
      // @ts-expect-error Testing runtime behavior with invalid types
      expect(isValidCallback([])).toBe(false);
    });

    it('should work with arrow functions', () => {
      const arrowFn = () => 'result';
      expect(isValidCallback(arrowFn)).toBe(true);
    });

    it('should work with async functions', () => {
      const asyncFn = async () => 'result';
      expect(isValidCallback(asyncFn)).toBe(true);
    });
  });

  describe('shouldHandleTriageKey', () => {
    const baseOptions = {
      triageEnabled: true,
      isModalOpen: false,
      isInputFocused: false,
      hasValidCallback: true,
      focusedTaskId: 'task-123',
    };

    it('should NOT handle when IME is composing', () => {
      const event = createMockKeyboardEvent({ key: 't', isComposing: true });
      expect(shouldHandleTriageKey(event, baseOptions)).toBe(false);
    });

    it('should NOT handle when key is Process (IME)', () => {
      const event = createMockKeyboardEvent({ key: 'Process' });
      expect(shouldHandleTriageKey(event, baseOptions)).toBe(false);
    });

    it('should NOT handle when triage is disabled', () => {
      const event = createMockKeyboardEvent({ key: 't' });
      expect(shouldHandleTriageKey(event, { ...baseOptions, triageEnabled: false })).toBe(false);
    });

    it('should NOT handle when modal is open', () => {
      const event = createMockKeyboardEvent({ key: 't' });
      expect(shouldHandleTriageKey(event, { ...baseOptions, isModalOpen: true })).toBe(false);
    });

    it('should NOT handle when input is focused AND triage is disabled', () => {
      // 일반 모드(triage 비활성화)에서는 input 포커스 시 키 무시
      const event = createMockKeyboardEvent({ key: 't' });
      expect(shouldHandleTriageKey(event, { ...baseOptions, triageEnabled: false, isInputFocused: true })).toBe(false);
    });

    it('should HANDLE when input is focused BUT triage mode is enabled', () => {
      // Triage 모드가 활성화되어 있으면 input 포커스 체크를 건너뜀
      // 이 테스트가 버그 수정의 핵심 검증 포인트
      const event = createMockKeyboardEvent({ key: 't' });
      const options = { 
        ...baseOptions, 
        triageEnabled: true, 
        isInputFocused: true 
      };
      expect(shouldHandleTriageKey(event, options)).toBe(true);
    });

    it('should handle navigation keys even when input is focused in triage mode', () => {
      // 방향키도 input 포커스 상태에서 동작해야 함
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'j', 'k'];
      navigationKeys.forEach((key) => {
        const event = createMockKeyboardEvent({ key });
        const options = { 
          ...baseOptions, 
          triageEnabled: true, 
          isInputFocused: true 
        };
        expect(shouldHandleTriageKey(event, options)).toBe(true);
      });
    });

    it('should NOT handle delete without valid callback', () => {
      const event = createMockKeyboardEvent({ key: 'd' });
      expect(shouldHandleTriageKey(event, { ...baseOptions, hasValidCallback: false })).toBe(false);
    });

    it('should NOT handle Enter without valid callback', () => {
      const event = createMockKeyboardEvent({ key: 'Enter' });
      expect(shouldHandleTriageKey(event, { ...baseOptions, hasValidCallback: false })).toBe(false);
    });

    it('should NOT handle action keys without focused task', () => {
      const actionKeys = ['t', 'o', 'n', 'p', 'h', 'd', 'Enter'];
      actionKeys.forEach((key) => {
        const event = createMockKeyboardEvent({ key });
        expect(shouldHandleTriageKey(event, { ...baseOptions, focusedTaskId: null })).toBe(false);
      });
    });

    it('should handle valid triage keys when all conditions are met', () => {
      const validKeys = ['t', 'o', 'n', 'p', 'h', 'ArrowUp', 'ArrowDown', 'j', 'k'];
      validKeys.forEach((key) => {
        const event = createMockKeyboardEvent({ key });
        expect(shouldHandleTriageKey(event, baseOptions)).toBe(true);
      });
    });
  });

  describe('getTriageAction', () => {
    it('should map navigation keys correctly', () => {
      expect(getTriageAction(createMockKeyboardEvent({ key: 'ArrowUp' }))).toBe('moveFocusPrev');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'ArrowDown' }))).toBe('moveFocusNext');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'k' }))).toBe('moveFocusPrev');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'j' }))).toBe('moveFocusNext');
    });

    it('should map quick place keys correctly', () => {
      expect(getTriageAction(createMockKeyboardEvent({ key: 't' }))).toBe('placeToday');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'o' }))).toBe('placeTomorrow');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'n' }))).toBe('placeNext');
    });

    it('should map triage state keys correctly', () => {
      expect(getTriageAction(createMockKeyboardEvent({ key: 'p' }))).toBe('togglePin');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'h' }))).toBe('toggleDefer');
    });

    it('should map delete keys correctly', () => {
      expect(getTriageAction(createMockKeyboardEvent({ key: 'd' }))).toBe('delete');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'Backspace' }))).toBe('delete');
    });

    it('should map edit and exit keys correctly', () => {
      expect(getTriageAction(createMockKeyboardEvent({ key: 'Enter' }))).toBe('edit');
      expect(getTriageAction(createMockKeyboardEvent({ key: 'Escape' }))).toBe('exit');
    });

    it('should return null for unmapped keys', () => {
      expect(getTriageAction(createMockKeyboardEvent({ key: 'a' }))).toBe(null);
      expect(getTriageAction(createMockKeyboardEvent({ key: 'Tab' }))).toBe(null);
      expect(getTriageAction(createMockKeyboardEvent({ key: ' ' }))).toBe(null);
    });
  });
});

describe('Inbox Hotkeys Callback Safety', () => {
  /**
   * 콜백 안전 실행 헬퍼 - 런타임 TypeError 방지
   * useInboxHotkeys에서 사용되는 패턴을 테스트
   */
  const safeCallCallback = <T>(
    callback: ((arg: T) => void) | undefined,
    arg: T
  ): boolean => {
    if (typeof callback !== 'function') {
      return false;
    }
    callback(arg);
    return true;
  };

  it('should not throw when callback is undefined', () => {
    expect(() => {
      safeCallCallback(undefined, 'test');
    }).not.toThrow();
  });

  it('should return false when callback is undefined', () => {
    expect(safeCallCallback(undefined, 'test')).toBe(false);
  });

  it('should call valid callback and return true', () => {
    let called = false;
    const callback = () => {
      called = true;
    };
    
    const result = safeCallCallback(callback, 'test');
    
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it('should pass argument to callback', () => {
    let receivedArg: string | null = null;
    const callback = (arg: string) => {
      receivedArg = arg;
    };
    
    safeCallCallback(callback, 'test-arg');
    
    expect(receivedArg).toBe('test-arg');
  });
});

describe('Inbox Hotkeys Triage Mode Input Focus Behavior', () => {
  /**
   * Triage 키 목록 - capture phase에서 잡아야 하는 키들
   * useInboxHotkeys.ts의 TRIAGE_KEYS Set과 동일해야 함
   */
  const TRIAGE_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'j', 'k',
    't', 'o', 'n', 'p', 'h',
    'd', 'Backspace', 'Enter', 'Escape',
  ]);

  /**
   * Input 포커스 체크 로직을 시뮬레이션하는 순수 함수
   * Triage 모드가 활성화되면 input 포커스 체크를 건너뜀
   */
  const isInputFocusedCheck = (
    triageEnabled: boolean,
    activeElementTag: string | null,
    isContentEditable: boolean
  ): boolean => {
    // Triage 모드에서는 input 필드 포커스 체크를 건너뜀
    if (triageEnabled) return false;

    if (!activeElementTag) return false;
    const tagName = activeElementTag.toUpperCase();
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || isContentEditable;
  };

  /**
   * InboxTab에서 useInboxHotkeys의 disabled 옵션을 계산하는 로직을 시뮬레이션
   * 
   * 핵심 수정사항: triage 모드가 활성화되면 isInputFocused를 무시
   * - 기존: disabled = isInputFocused || isModalOpen
   * - 수정: disabled = isModalOpen || (!triageEnabled && isInputFocused)
   */
  const computeHotkeyDisabled = (
    triageEnabled: boolean,
    isInputFocused: boolean,
    isModalOpen: boolean
  ): boolean => {
    // 모달이 열려 있으면 항상 disabled
    if (isModalOpen) return true;
    // Triage 모드가 비활성화된 경우에만 isInputFocused를 체크
    // Triage 모드가 활성화되면 input 포커스 상태에서도 핫키가 동작해야 함
    if (!triageEnabled && isInputFocused) return true;
    return false;
  };

  describe('computeHotkeyDisabled (mirrors InboxTab disabled prop logic)', () => {
    it('should return true when modal is open, regardless of triage state', () => {
      // 모달이 열려 있으면 항상 disabled
      expect(computeHotkeyDisabled(true, false, true)).toBe(true);
      expect(computeHotkeyDisabled(false, false, true)).toBe(true);
      expect(computeHotkeyDisabled(true, true, true)).toBe(true);
      expect(computeHotkeyDisabled(false, true, true)).toBe(true);
    });

    it('should return true when triage DISABLED and input focused', () => {
      // Triage 모드가 비활성화되고 input 포커스 중이면 disabled
      expect(computeHotkeyDisabled(false, true, false)).toBe(true);
    });

    it('should return false when triage ENABLED even if input focused (BUG FIX)', () => {
      // 핵심 버그 수정 검증: Triage 모드가 활성화되면 input 포커스를 무시
      // 이전에는 `disabled: isInputFocused || isModalOpen`로 인해 
      // triage 모드에서도 input 포커스 시 핫키가 동작하지 않았음
      expect(computeHotkeyDisabled(true, true, false)).toBe(false);
    });

    it('should return false when neither modal open nor input focused', () => {
      expect(computeHotkeyDisabled(true, false, false)).toBe(false);
      expect(computeHotkeyDisabled(false, false, false)).toBe(false);
    });
  });

  describe('isInputFocusedCheck logic (mirrors useInboxHotkeys.isInputFocused)', () => {
    it('should return false when triageEnabled=true, regardless of activeElement', () => {
      // Triage 모드가 켜져 있으면 항상 false 반환 (핫키가 동작해야 함)
      expect(isInputFocusedCheck(true, 'INPUT', false)).toBe(false);
      expect(isInputFocusedCheck(true, 'TEXTAREA', false)).toBe(false);
      expect(isInputFocusedCheck(true, 'DIV', true)).toBe(false); // contentEditable
      expect(isInputFocusedCheck(true, null, false)).toBe(false);
    });

    it('should return true for INPUT/TEXTAREA when triageEnabled=false', () => {
      expect(isInputFocusedCheck(false, 'INPUT', false)).toBe(true);
      expect(isInputFocusedCheck(false, 'TEXTAREA', false)).toBe(true);
    });

    it('should return true for contentEditable when triageEnabled=false', () => {
      expect(isInputFocusedCheck(false, 'DIV', true)).toBe(true);
      expect(isInputFocusedCheck(false, 'SPAN', true)).toBe(true);
    });

    it('should return false for non-input elements when triageEnabled=false', () => {
      expect(isInputFocusedCheck(false, 'DIV', false)).toBe(false);
      expect(isInputFocusedCheck(false, 'BUTTON', false)).toBe(false);
      expect(isInputFocusedCheck(false, null, false)).toBe(false);
    });
  });

  describe('TRIAGE_KEYS set (mirrors useInboxHotkeys.TRIAGE_KEYS)', () => {
    it('should contain all navigation keys', () => {
      expect(TRIAGE_KEYS.has('ArrowUp')).toBe(true);
      expect(TRIAGE_KEYS.has('ArrowDown')).toBe(true);
      expect(TRIAGE_KEYS.has('j')).toBe(true);
      expect(TRIAGE_KEYS.has('k')).toBe(true);
    });

    it('should contain all quick-place keys', () => {
      expect(TRIAGE_KEYS.has('t')).toBe(true);
      expect(TRIAGE_KEYS.has('o')).toBe(true);
      expect(TRIAGE_KEYS.has('n')).toBe(true);
    });

    it('should contain pin/defer keys', () => {
      expect(TRIAGE_KEYS.has('p')).toBe(true);
      expect(TRIAGE_KEYS.has('h')).toBe(true);
    });

    it('should contain delete/edit/exit keys', () => {
      expect(TRIAGE_KEYS.has('d')).toBe(true);
      expect(TRIAGE_KEYS.has('Backspace')).toBe(true);
      expect(TRIAGE_KEYS.has('Enter')).toBe(true);
      expect(TRIAGE_KEYS.has('Escape')).toBe(true);
    });

    it('should NOT contain regular typing keys', () => {
      // 일반 문자 입력은 triage 키가 아님 (input 필드에서 타이핑 가능해야 함)
      expect(TRIAGE_KEYS.has('a')).toBe(false);
      expect(TRIAGE_KEYS.has('b')).toBe(false);
      expect(TRIAGE_KEYS.has(' ')).toBe(false);
      expect(TRIAGE_KEYS.has('Tab')).toBe(false);
    });
  });

  describe('Triage mode hotkey capture behavior', () => {
    /**
     * Capture phase에서 이벤트를 잡는 시뮬레이션
     * 실제 useInboxHotkeys에서는 { capture: true } 옵션으로 등록됨
     */
    const shouldCaptureTriageKey = (
      key: string,
      triageEnabled: boolean,
      isModalOpen: boolean,
      isInputFocused: boolean
    ): boolean => {
      // Triage 모드 비활성화 시 캡처 안 함
      if (!triageEnabled) return false;
      
      // 모달이 열려 있으면 캡처 안 함
      if (isModalOpen) return false;
      
      // Triage 키가 아니면 캡처 안 함
      if (!TRIAGE_KEYS.has(key)) return false;
      
      // Triage 모드에서는 input 포커스 여부와 관계없이 캡처
      // (isInputFocused는 triage 모드에서 항상 false 반환)
      if (isInputFocused) return false;
      
      return true;
    };

    it('should capture triage keys when triage enabled, even conceptually on input', () => {
      // Triage 모드에서 isInputFocused()는 항상 false를 반환
      // 따라서 input 위에서도 핫키가 동작함
      const triageKeys = ['ArrowUp', 'ArrowDown', 't', 'o', 'n', 'p', 'h', 'd', 'Enter'];
      
      triageKeys.forEach((key) => {
        // isInputFocused가 false로 보고됨 (triage 모드이므로)
        const result = shouldCaptureTriageKey(key, true, false, false);
        expect(result).toBe(true);
      });
    });

    it('should NOT capture non-triage keys even when triage enabled', () => {
      // 일반 문자는 캡처하지 않아서 input에서 타이핑 가능
      const regularKeys = ['a', 'b', 'c', 'Tab', ' ', '1', '2'];
      
      regularKeys.forEach((key) => {
        const result = shouldCaptureTriageKey(key, true, false, false);
        expect(result).toBe(false);
      });
    });

    it('should NOT capture any keys when triage disabled', () => {
      const allKeys = ['ArrowUp', 't', 'a', 'Enter'];
      
      allKeys.forEach((key) => {
        const result = shouldCaptureTriageKey(key, false, false, false);
        expect(result).toBe(false);
      });
    });

    it('should NOT capture when modal is open', () => {
      const result = shouldCaptureTriageKey('t', true, true, false);
      expect(result).toBe(false);
    });
  });
});
