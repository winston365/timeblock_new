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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { modalStackRegistry } from '@/shared/hooks/modalStackRegistry';
import { useInboxStore } from '@/shared/stores/inboxStore';
import { findSuggestedSlot, type SlotFindMode } from '@/shared/services/schedule/slotFinder';
import { useDailyData } from '@/shared/hooks/useDailyData';
import { notify } from '@/shared/lib/notify';
import { getLocalDate } from '@/shared/lib/utils';
import type { TimeBlockId } from '@/shared/types/domain';

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
    disabled 
  } = options;

  // Store hooks - 필요한 것만 추출 (미정의 함수는 외부에서 주입받음)
  const {
    inboxTasks,
    updateTask,
  } = useInboxStore();

  // 외부에서 value+setter가 제공되는지 확인
  const isExternallyControlled = triageFocusedTaskIdProp !== undefined && typeof setTriageFocusedTaskIdProp === 'function';

  // 로컬 상태: triageFocusedTaskId (외부 미제공 시에만 사용)
  const [triageFocusedTaskIdInternal, setTriageFocusedTaskIdInternal] = useState<string | null>(null);

  /**
   * triageFocusedTaskId: 외부 제공 시 외부 값, 그렇지 않으면 내부 값 사용
   * 단일 진실 공급원(Single Source of Truth) 보장
   */
  const triageFocusedTaskId = isExternallyControlled 
    ? (triageFocusedTaskIdProp ?? null)
    : triageFocusedTaskIdInternal;

  /**
   * setTriageFocusedTaskId: 외부 setter가 있으면 외부 사용, 없으면 내부 사용
   * 타입 가드를 통해 함수 여부를 확인하여 런타임 에러 방지
   */
  const setTriageFocusedTaskId = useCallback((taskId: string | null) => {
    if (isExternallyControlled && typeof setTriageFocusedTaskIdProp === 'function') {
      setTriageFocusedTaskIdProp(taskId);
    } else {
      setTriageFocusedTaskIdInternal(taskId);
    }
  }, [isExternallyControlled, setTriageFocusedTaskIdProp]);

  // placeTaskToSlot fallback: 외부 주입 없으면 updateTask 사용
  const placeTaskToSlot = useMemo(() => {
    if (placeTaskToSlotProp) return placeTaskToSlotProp;
    return async (taskId: string, _date: string, blockId: TimeBlockId, hourSlot: number) => {
      await updateTask(taskId, { timeBlock: blockId, hourSlot });
    };
  }, [placeTaskToSlotProp, updateTask]);

  // setLastUsedSlot fallback: 외부 주입 없으면 no-op
  const setLastUsedSlot = useMemo(() => {
    if (setLastUsedSlotProp) return setLastUsedSlotProp;
    return async (_slot: { mode: SlotFindMode; date: string; blockId: string; hourSlot: number }) => {
      // no-op placeholder
    };
  }, [setLastUsedSlotProp]);

  // Daily data for slot finding
  const { dailyData } = useDailyData();
  const todayTasks = useMemo(() => dailyData?.tasks ?? [], [dailyData?.tasks]);
  const timeBlockStates = dailyData?.timeBlockStates;

  // Refs for stable callbacks
  const isProcessingRef = useRef(false);

  // ========================================================================
  // Local Focus Navigation (store에 미정의 함수들 로컬 구현)
  // ========================================================================

  /**
   * 다음 작업으로 포커스 이동
   */
  const moveFocusNext = useCallback(() => {
    if (inboxTasks.length === 0) return;
    const currentIndex = triageFocusedTaskId 
      ? inboxTasks.findIndex(t => t.id === triageFocusedTaskId) 
      : -1;
    const nextIndex = currentIndex < inboxTasks.length - 1 ? currentIndex + 1 : 0;
    setTriageFocusedTaskId(inboxTasks[nextIndex]?.id ?? null);
  }, [inboxTasks, triageFocusedTaskId, setTriageFocusedTaskId]);

  /**
   * 이전 작업으로 포커스 이동
   */
  const moveFocusPrev = useCallback(() => {
    if (inboxTasks.length === 0) return;
    const currentIndex = triageFocusedTaskId 
      ? inboxTasks.findIndex(t => t.id === triageFocusedTaskId) 
      : 0;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : inboxTasks.length - 1;
    setTriageFocusedTaskId(inboxTasks[prevIndex]?.id ?? null);
  }, [inboxTasks, triageFocusedTaskId, setTriageFocusedTaskId]);

  /**
   * 처리된 작업 수 증가 (no-op placeholder)
   */
  const incrementProcessedCount = useCallback(async () => {
    // Placeholder: 처리된 작업 카운트 기능은 향후 구현
  }, []);

  // ========================================================================
  // Callbacks
  // ========================================================================

  /**
   * 모달이 열려 있는지 확인
   */
  const isModalOpen = useCallback((): boolean => {
    return modalStackRegistry.size() > 0;
  }, []);

  /**
   * 입력 필드에 포커스 중인지 확인
   * 
   * Triage 모드에서는 입력 필드 체크를 건너뜁니다.
   * Triage 모드가 활성화되면 InboxTab에서 blur 처리를 하므로,
   * 사용자가 의도적으로 입력 필드에 포커스를 둔 경우에만 해당합니다.
   * 
   * @returns 일반 모드에서 입력 필드 포커스 여부, Triage 모드에서는 항상 false
   */
  const isInputFocused = useCallback((): boolean => {
    // Triage 모드에서는 입력 필드 포커스 체크를 건너뜀
    // (Triage 모드 진입 시 InboxTab에서 blur 처리하며, 
    //  핫키가 input 위에서도 동작해야 함)
    if (triageEnabled) return false;

    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toUpperCase();
    const isEditable = (activeElement as HTMLElement).isContentEditable;

    return tagName === 'INPUT' || tagName === 'TEXTAREA' || isEditable;
  }, [triageEnabled]);

  /**
   * 빠른 배치 실행
   */
  const handleQuickPlace = useCallback(
    async (mode: SlotFindMode) => {
      if (!triageFocusedTaskId || isProcessingRef.current) return;

      const task = inboxTasks.find((t) => t.id === triageFocusedTaskId);
      if (!task) return;

      isProcessingRef.current = true;

      try {
        const today = getLocalDate();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = getLocalDate(tomorrow);

        const suggestion = findSuggestedSlot({
          now: new Date(),
          mode,
          today: {
            tasks: todayTasks,
            timeBlockStates,
            dateISO: today,
          },
          tomorrow: {
            tasks: [], // 내일 데이터는 현재 로드 안 함 (간단화)
            dateISO: tomorrowISO,
          },
          options: {
            skipLockedBlocks: true,
            avoidHourSlotCollisions: true,
          },
        });

        if (!suggestion) {
          notify.error('배치 가능한 슬롯이 없습니다');
          return;
        }

        await placeTaskToSlot(
          triageFocusedTaskId,
          suggestion.dateISO,
          suggestion.blockId as TimeBlockId,
          suggestion.hourSlot,
        );

        // 마지막 사용 슬롯 저장
        await setLastUsedSlot({
          mode,
          date: suggestion.dateISO,
          blockId: suggestion.blockId as string,
          hourSlot: suggestion.hourSlot,
        });

        notify.placement(suggestion.label);
      } catch (error) {
        console.error('Quick place failed:', error);
        notify.error('배치에 실패했습니다');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      triageFocusedTaskId,
      inboxTasks,
      todayTasks,
      timeBlockStates,
      placeTaskToSlot,
      setLastUsedSlot,
    ],
  );

  /**
   * 삭제 처리 (타입 가드 적용)
   */
  const handleDelete = useCallback(async () => {
    if (!triageFocusedTaskId || isProcessingRef.current) return;
    if (typeof onDeleteTask !== 'function') return;

    isProcessingRef.current = true;

    try {
      await onDeleteTask(triageFocusedTaskId);
      await incrementProcessedCount();
    } catch (error) {
      console.error('Delete failed:', error);
      notify.error('삭제에 실패했습니다');
    } finally {
      isProcessingRef.current = false;
    }
  }, [triageFocusedTaskId, onDeleteTask, incrementProcessedCount]);

  /**
   * 편집 모달 열기 (타입 가드 적용)
   */
  const handleEdit = useCallback(() => {
    if (!triageFocusedTaskId) return;
    if (typeof onEditTask !== 'function') return;
    onEditTask(triageFocusedTaskId);
  }, [triageFocusedTaskId, onEditTask]);

  /**
   * 고정 토글
   */
  const handleTogglePin = useCallback(async () => {
    if (!triageFocusedTaskId || isProcessingRef.current) return;

    const task = inboxTasks.find((t) => t.id === triageFocusedTaskId);
    if (!task) return;

    isProcessingRef.current = true;
    try {
      await updateTask(triageFocusedTaskId, { isPinned: !task.isPinned });
      notify.info(task.isPinned ? '고정 해제됨' : '📌 고정됨');
    } catch (error) {
      console.error('Toggle pin failed:', error);
      notify.error('고정 변경에 실패했습니다');
    } finally {
      isProcessingRef.current = false;
    }
  }, [triageFocusedTaskId, inboxTasks, updateTask]);

  /**
   * 보류 토글 (내일까지)
   */
  const handleToggleDefer = useCallback(async () => {
    if (!triageFocusedTaskId || isProcessingRef.current) return;

    const task = inboxTasks.find((t) => t.id === triageFocusedTaskId);
    if (!task) return;

    const todayISO = getLocalDate();
    const isDeferred = (task.deferredUntil ?? null) !== null && (task.deferredUntil ?? '') > todayISO;

    isProcessingRef.current = true;
    try {
      if (isDeferred) {
        await updateTask(triageFocusedTaskId, { deferredUntil: null });
        notify.info('보류 해제됨');
        return;
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await updateTask(triageFocusedTaskId, { deferredUntil: getLocalDate(tomorrow) });
      notify.info('⏸️ 내일까지 보류');
    } catch (error) {
      console.error('Toggle defer failed:', error);
      notify.error('보류 변경에 실패했습니다');
    } finally {
      isProcessingRef.current = false;
    }
  }, [triageFocusedTaskId, inboxTasks, updateTask]);

  /**
   * 포커스 이동 (외부 호출용)
   */
  const moveFocus = useCallback(
    (direction: 'next' | 'prev') => {
      if (direction === 'next') {
        moveFocusNext();
      } else {
        moveFocusPrev();
      }
    },
    [moveFocusNext, moveFocusPrev],
  );

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
      'ArrowUp', 'ArrowDown', 'j', 'k',
      't', 'o', 'n', 'p', 'h',
      'd', 'Backspace', 'Enter', 'Escape',
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

      // 키 처리
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
          // Triage 종료는 외부(InboxTab)에서 처리
          break;

        default:
          break;
      }
    };

    // capture: true로 설정하여 input 필드에서도 이벤트를 먼저 잡음
    // Triage 모드에서는 입력 필드 위에서도 핫키가 동작해야 함
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

  // ========================================================================
  // 초기 포커스 설정
  // ========================================================================

  useEffect(() => {
    if (triageEnabled && !triageFocusedTaskId && inboxTasks.length > 0) {
      setTriageFocusedTaskId(inboxTasks[0]?.id ?? null);
    }
  }, [triageEnabled, triageFocusedTaskId, inboxTasks, setTriageFocusedTaskId]);

  return {
    focusedTaskId: triageFocusedTaskId,
    moveFocus,
  };
};
