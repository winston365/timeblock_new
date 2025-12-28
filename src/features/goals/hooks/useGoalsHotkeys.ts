/**
 * useGoalsHotkeys.ts
 *
 * @file Goals 모달 전용 키보드 단축키 훅
 * @role Goals 모달 내부 키보드 네비게이션 및 액션
 *
 * 키 매핑:
 * - Ctrl/Cmd+Shift+G: Goals 모달 열기/닫기 (글로벌)
 * - ↑/↓/←/→: 카드 포커스 이동 (DOM 순서 기준)
 * - L: 현재 포커스된 카드의 Quick Log 팝오버 열기
 * - Enter: 현재 포커스된 카드의 히스토리 모달 열기
 * - ESC: 닫기 (useModalHotkeys에서 처리)
 *
 * 우선순위:
 * 1. 다른 모달이 열려 있으면 무시 (modalStackRegistry 확인)
 * 2. 입력 필드에 포커스 중이면 무시
 * 3. IME 조합 중이면 무시
 *
 * @dependencies
 * - modalStackRegistry: 모달 스택 상태 확인
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { modalStackRegistry } from '@/shared/hooks/modalStackRegistry';

/** Goals 카드 액션 콜백 */
export interface GoalCardActions {
  /** 히스토리 모달 열기 */
  readonly onShowHistory: (goalId: string) => void;
  /** Quick Log 팝오버 열기 */
  readonly onOpenQuickLog: (goalId: string) => void;
}

/** useGoalsHotkeys 옵션 */
export interface UseGoalsHotkeysOptions {
  /** Goals 모달 열림 상태 */
  readonly isOpen: boolean;
  /** 목표 ID 배열 (DOM 순서) */
  readonly goalIds: readonly string[];
  /** 카드 액션 콜백 */
  readonly cardActions: GoalCardActions;
  /** 핫키 비활성화 */
  readonly disabled?: boolean;
}

/** useGoalsHotkeys 반환값 */
export interface UseGoalsHotkeysReturn {
  /** 현재 포커스된 목표 ID */
  readonly focusedGoalId: string | null;
  /** 포커스 설정 (수동 호출용) */
  readonly setFocusedGoalId: (goalId: string | null) => void;
  /** 키보드 힌트 표시 여부 */
  readonly showHints: boolean;
  /** 힌트 토글 */
  readonly toggleHints: () => void;
}

/**
 * 입력 필드인지 확인
 */
const isInputField = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    !!target.closest('[contenteditable="true"]')
  );
};

/**
 * Goals 모달 전용 키보드 단축키 훅
 *
 * @param options - 훅 옵션
 * @returns 포커스 상태 및 힌트 제어
 */
export const useGoalsHotkeys = (
  options: UseGoalsHotkeysOptions,
): UseGoalsHotkeysReturn => {
  const {
    isOpen,
    goalIds,
    cardActions,
    disabled = false,
  } = options;

  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const focusedGoalIdRef = useRef(focusedGoalId);

  // Ref 동기화
  useEffect(() => {
    focusedGoalIdRef.current = focusedGoalId;
  }, [focusedGoalId]);

  // 모달이 닫히면 포커스 초기화
  useEffect(() => {
    if (!isOpen) {
      setFocusedGoalId(null);
    }
  }, [isOpen]);

  // 목표가 없으면 포커스 해제
  useEffect(() => {
    if (focusedGoalId && !goalIds.includes(focusedGoalId)) {
      setFocusedGoalId(goalIds[0] ?? null);
    }
  }, [goalIds, focusedGoalId]);

  /** 포커스 이동 (DOM 순서 기반, 단순 +1/-1) */
  const moveFocusBy = useCallback((delta: number) => {
    const currentId = focusedGoalIdRef.current;
    if (goalIds.length === 0) return;

    const currentIndex = currentId ? goalIds.indexOf(currentId) : -1;
    const baseIndex = currentIndex >= 0 ? currentIndex : delta > 0 ? 0 : goalIds.length - 1;
    const nextIndex = Math.max(0, Math.min(goalIds.length - 1, baseIndex + delta));
    setFocusedGoalId(goalIds[nextIndex] ?? null);
  }, [goalIds]);

  /** 현재 포커스된 카드에 액션 실행 */
  const executeAction = useCallback((action: 'history' | 'quickLog') => {
    const currentId = focusedGoalIdRef.current;
    if (!currentId) return;

    if (action === 'history') {
      cardActions.onShowHistory(currentId);
    } else if (action === 'quickLog') {
      cardActions.onOpenQuickLog(currentId);
    }
  }, [cardActions]);

  /** 힌트 토글 */
  const toggleHints = useCallback(() => {
    setShowHints((prev) => !prev);
  }, []);

  // 키보드 이벤트 핸들러
  useEffect(() => {
    if (!isOpen || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중 무시
      if (e.isComposing || e.key === 'Process') return;

      // 다른 모달이 최상위면 무시 (Goals 모달이 top이어야 함)
      // 단, ESC는 useModalHotkeys에서 처리하므로 여기서는 네비게이션만
      if (modalStackRegistry.size() > 1) return;

      // 입력 필드에서는 무시
      if (isInputField(e.target)) return;

      switch (e.key) {
        // 카드 이동
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          moveFocusBy(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          moveFocusBy(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          moveFocusBy(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          moveFocusBy(1);
          break;

        // Quick Log 열기 (L)
        case 'L':
          e.preventDefault();
          e.stopPropagation();
          executeAction('quickLog');
          break;

        // 히스토리 열기 (Enter)
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          executeAction('history');
          break;

        // 힌트 토글 (?)
        case '?':
          e.preventDefault();
          e.stopPropagation();
          toggleHints();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, disabled, moveFocusBy, executeAction, toggleHints]);

  return {
    focusedGoalId,
    setFocusedGoalId,
    showHints,
    toggleHints,
  };
};

/**
 * Goals 모달 열기 글로벌 단축키 훅 (Ctrl/Cmd+Shift+G)
 *
 * @param options - 옵션
 */
export interface UseGoalsGlobalHotkeyOptions {
  /** Goals 모달 열림 상태 */
  readonly isOpen: boolean;
  /** 모달 열기 콜백 */
  readonly onOpen: () => void;
  /** 모달 닫기 콜백 */
  readonly onClose: () => void;
  /** 비활성화 */
  readonly disabled?: boolean;
}

/**
 * Goals 모달 열기/닫기 글로벌 단축키 (Ctrl/Cmd+Shift+G)
 */
export const useGoalsGlobalHotkey = (
  options: UseGoalsGlobalHotkeyOptions,
): void => {
  const { isOpen, onOpen, onClose, disabled = false } = options;

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중 무시
      if (e.isComposing || e.key === 'Process') return;

      // 입력 필드에서는 무시
      if (isInputField(e.target)) return;

      // Ctrl/Cmd+Shift+G만 허용 (충돌 방지)
      const isTriggerKey = e.key === 'g' || e.key === 'G';
      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (!isTriggerKey || !hasCtrlOrMeta || !e.shiftKey || e.altKey) return;

      // 모달이 닫혀있을 때: 다른 모달이 없으면 열기
      if (!isOpen) {
        if (modalStackRegistry.size() !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        onOpen();
        return;
      }

      // 모달이 열려있을 때: 닫기 (단, 자식 모달이 위에 없을 때만)
      if (modalStackRegistry.size() !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, isOpen, onOpen, onClose]);
};
