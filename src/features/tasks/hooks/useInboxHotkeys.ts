/**
 * useInboxHotkeys.ts
 *
 * @role 인박스 전용 키보드 단축키 훅
 * @description Triage 모드 및 빠른 배치를 위한 키보드 네비게이션
 *
 * 키 매핑:
 * - ↑/↓ 또는 j/k: 포커스 이동
 * - t: Today로 배치
 * - o: Tomorrow로 배치
 * - n: NextSlot으로 배치
 * - p: 고정 토글
 * - h: 내일까지 보류 토글
 * - d/Backspace: 삭제
 * - Enter: 편집 모달 열기
 * - Escape: Triage 종료
 *
 * 우선순위:
 * 1. 모달이 열려 있으면 모달이 최우선 (이 훅은 무시됨)
 * 2. 입력 필드에 포커스 중이면 무시
 * 3. IME 조합 중이면 무시
 *
 * @dependencies
 * - react-hotkeys-hook (권장) 또는 직접 keydown 이벤트
 * - modalStackRegistry: 모달 스택 상태 확인
 * - useInboxStore: 인박스 상태/액션
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInboxStore } from '@/shared/stores/inboxStore';
import type { SlotFindMode } from '@/shared/services/schedule/slotFinder';
import type { TimeBlockId } from '@/shared/types/domain';
import { useInboxEditing } from './inbox/useInboxEditing';
import { useInboxHotkeysGuards } from './inbox/useInboxHotkeysGuards';
import { useInboxNavigation } from './inbox/useInboxNavigation';
import { useInboxPlacement } from './inbox/useInboxPlacement';

// ============================================================================
// Types
// ============================================================================

export interface UseInboxHotkeysOptions {
  /** Triage 모드 활성화 여부 */
  readonly triageEnabled: boolean;
  /** Triage 포커스 Task ID (외부에서 주입 시 setter도 함께 제공해야 함) */
  readonly triageFocusedTaskId?: string | null;
  /** Triage 포커스 Task ID 설정 (외부에서 주입 시 value도 함께 제공해야 함) */
  readonly setTriageFocusedTaskId?: (taskId: string | null) => void;
  /** 빠른 배치 함수 (store 미정의 시 외부에서 주입) */
  readonly placeTaskToSlot?: (taskId: string, date: string, blockId: TimeBlockId, hourSlot: number) => Promise<void>;
  /** 마지막 사용 슬롯 저장 함수 (store 미정의 시 외부에서 주입) */
  readonly setLastUsedSlot?: (slot: { mode: SlotFindMode; date: string; blockId: string; hourSlot: number }) => Promise<void>;
  /** 편집 모달 열기 콜백 */
  readonly onEditTask?: (taskId: string) => void;
  /** 삭제 확인 콜백 (undefined 반환 시 삭제 취소) */
  readonly onDeleteTask?: (taskId: string) => Promise<void>;
  /** 핫키 비활성화 (다른 입력에 포커스 중일 때) */
  readonly disabled?: boolean;
}

export interface UseInboxHotkeysReturn {
  /** 현재 포커스된 Task ID */
  readonly focusedTaskId: string | null;
  /** 포커스 이동 (수동 호출용) */
  readonly moveFocus: (direction: 'next' | 'prev') => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 인박스 전용 키보드 단축키 훅
 *
 * @param options - 훅 옵션
 * @returns 포커스 상태 및 수동 제어 함수
 *
 * @example
 * ```tsx
 * const { focusedTaskId } = useInboxHotkeys({
 *   triageEnabled,
 *   onEditTask: (taskId) => setEditingTaskId(taskId),
 *   onDeleteTask: async (taskId) => {
 *     await deleteTask(taskId);
 *   },
 * });
 * ```
 */
export const useInboxHotkeys = (
  options: UseInboxHotkeysOptions,
): UseInboxHotkeysReturn => {
  const {
    triageEnabled,
    triageFocusedTaskId: triageFocusedTaskIdProp,
    setTriageFocusedTaskId: setTriageFocusedTaskIdProp,
    placeTaskToSlot: placeTaskToSlotProp,
    setLastUsedSlot: setLastUsedSlotProp,
    onEditTask,
    onDeleteTask,
    disabled,
  } = options;

  // Store hooks - 필요한 것만 추출 (미정의 함수는 외부에서 주입받음)
  const { inboxTasks, updateTask } = useInboxStore();

  // Refs for stable callbacks
  const isProcessingRef = useRef(false);

  // ========================================================================
  // Navigation / Focus (controlled or uncontrolled)
  // ========================================================================

  const { triageFocusedTaskId, moveFocusNext, moveFocusPrev, moveFocus } = useInboxNavigation({
    triageEnabled,
    inboxTasks,
    triageFocusedTaskIdProp,
    setTriageFocusedTaskIdProp,
  });

  // ========================================================================
  // Guards
  // ========================================================================

  const { isModalOpen, isInputFocused } = useInboxHotkeysGuards({ triageEnabled });

  // ========================================================================
  // Fallbacks (store 미정의 함수는 외부 주입, 없으면 로컬 구현)
  // ========================================================================

  const placeTaskToSlot = useMemo(() => {
    if (placeTaskToSlotProp) return placeTaskToSlotProp;
    return async (taskId: string, _date: string, blockId: TimeBlockId, hourSlot: number) => {
      await updateTask(taskId, { timeBlock: blockId, hourSlot });
    };
  }, [placeTaskToSlotProp, updateTask]);

  const setLastUsedSlot = useMemo(() => {
    if (setLastUsedSlotProp) return setLastUsedSlotProp;
    return async (_slot: { mode: SlotFindMode; date: string; blockId: string; hourSlot: number }) => {
      // no-op placeholder
    };
  }, [setLastUsedSlotProp]);

  const incrementProcessedCount = useCallback(async () => {
    // Placeholder: 처리된 작업 카운트 기능은 향후 구현
  }, []);

  // ========================================================================
  // Placement / Editing
  // ========================================================================

  const { handleQuickPlace } = useInboxPlacement({
    triageFocusedTaskId,
    inboxTasks,
    placeTaskToSlot,
    setLastUsedSlot,
    isProcessingRef,
  });

  const { handleDelete, handleEdit, handleTogglePin, handleToggleDefer } = useInboxEditing({
    triageFocusedTaskId,
    inboxTasks,
    updateTask,
    onEditTask,
    onDeleteTask,
    incrementProcessedCount,
    isProcessingRef,
  });

  // ========================================================================
  // Keydown Handler
  // ========================================================================

  useEffect(() => {
    if (!triageEnabled || disabled) return;

    /**
     * Triage 키 목록 - 입력 필드에서도 동작해야 하는 키들
     * 이 키들은 capture phase에서 잡아서 기본 동작을 막음
     */
    const TRIAGE_KEYS = new Set([
      'ArrowUp',
      'ArrowDown',
      'j',
      'k',
      't',
      'o',
      'n',
      'p',
      'h',
      'd',
      'Backspace',
      'Enter',
      'Escape',
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중 무시
      if (e.isComposing || e.key === 'Process') return;

      // 모달이 열려 있으면 무시 (모달이 ESC 처리)
      if (isModalOpen()) return;

      // Triage 키가 아니면 무시 (일반 입력 허용)
      if (!TRIAGE_KEYS.has(e.key)) return;

      // 입력 필드에 포커스 중이면 무시 (triage 모드에서는 건너뜀)
      if (isInputFocused()) return;

      switch (e.key) {
        // 포커스 이동
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          e.stopPropagation();
          moveFocusPrev();
          break;

        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          e.stopPropagation();
          moveFocusNext();
          break;

        // 빠른 배치
        case 't':
          e.preventDefault();
          e.stopPropagation();
          void handleQuickPlace('today');
          break;

        case 'o':
          e.preventDefault();
          e.stopPropagation();
          void handleQuickPlace('tomorrow');
          break;

        case 'n':
          e.preventDefault();
          e.stopPropagation();
          void handleQuickPlace('next');
          break;

        // 고정/보류
        case 'p':
          e.preventDefault();
          e.stopPropagation();
          void handleTogglePin();
          break;

        case 'h':
          e.preventDefault();
          e.stopPropagation();
          void handleToggleDefer();
          break;

        // 삭제
        case 'd':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          void handleDelete();
          break;

        // 편집
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          handleEdit();
          break;

        // Triage 종료 (ESC는 보통 외부에서 처리)
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          break;

        default:
          break;
      }
    };

    // capture: true로 설정하여 input 필드에서도 이벤트를 먼저 잡음
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [
    triageEnabled,
    disabled,
    isModalOpen,
    isInputFocused,
    moveFocusNext,
    moveFocusPrev,
    handleQuickPlace,
    handleTogglePin,
    handleToggleDefer,
    handleDelete,
    handleEdit,
  ]);

  return {
    focusedTaskId: triageFocusedTaskId,
    moveFocus,
  };
};;
