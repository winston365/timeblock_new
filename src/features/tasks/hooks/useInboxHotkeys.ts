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
  const { triageEnabled, onEditTask, onDeleteTask, disabled } = options;

  // Store hooks
  const {
    inboxTasks,
    triageFocusedTaskId,
    setTriageEnabled,
    setTriageFocusedTaskId,
    moveFocusNext,
    moveFocusPrev,
    updateTask,
    placeTaskToSlot,
    setLastUsedSlot,
    incrementProcessedCount,
  } = useInboxStore();

  // Daily data for slot finding
  const { dailyData } = useDailyData();
  const todayTasks = useMemo(() => dailyData?.tasks ?? [], [dailyData?.tasks]);
  const timeBlockStates = dailyData?.timeBlockStates;

  // Refs for stable callbacks
  const isProcessingRef = useRef(false);

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
   */
  const isInputFocused = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toUpperCase();
    const isEditable = (activeElement as HTMLElement).isContentEditable;

    return tagName === 'INPUT' || tagName === 'TEXTAREA' || isEditable;
  }, []);

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
   * 삭제 처리
   */
  const handleDelete = useCallback(async () => {
    if (!triageFocusedTaskId || isProcessingRef.current) return;
    if (!onDeleteTask) return;

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
   * 편집 모달 열기
   */
  const handleEdit = useCallback(() => {
    if (!triageFocusedTaskId || !onEditTask) return;
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

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중 무시
      if (e.isComposing || e.key === 'Process') return;

      // 모달이 열려 있으면 무시 (모달이 ESC 처리)
      if (isModalOpen()) return;

      // 입력 필드에 포커스 중이면 무시
      if (isInputFocused()) return;

      // 키 처리
      switch (e.key) {
        // 포커스 이동
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          moveFocusPrev();
          break;

        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          moveFocusNext();
          break;

        // 빠른 배치
        case 't':
          e.preventDefault();
          void handleQuickPlace('today');
          break;

        case 'o':
          e.preventDefault();
          void handleQuickPlace('tomorrow');
          break;

        case 'n':
          e.preventDefault();
          void handleQuickPlace('next');
          break;

        // 고정/보류
        case 'p':
          e.preventDefault();
          void handleTogglePin();
          break;

        case 'h':
          e.preventDefault();
          void handleToggleDefer();
          break;

        // 삭제
        case 'd':
        case 'Backspace':
          e.preventDefault();
          void handleDelete();
          break;

        // 편집
        case 'Enter':
          e.preventDefault();
          handleEdit();
          break;

        // Triage 종료
        case 'Escape':
          e.preventDefault();
          void setTriageEnabled(false);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
    setTriageEnabled,
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
