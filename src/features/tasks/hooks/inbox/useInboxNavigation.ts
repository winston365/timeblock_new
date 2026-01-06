/**
 * @file useInboxNavigation.ts
 * @description 인박스 triage 포커스 상태 및 네비게이션 로직
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface InboxTaskIdLike {
  id: string;
}

export interface UseInboxNavigationParams {
  /** triage 모드 활성화 여부 */
  triageEnabled: boolean;
  /** 인박스 작업 목록 */
  inboxTasks: readonly InboxTaskIdLike[];
  /** 외부 제어 포커스 값 */
  triageFocusedTaskIdProp?: string | null;
  /** 외부 제어 포커스 setter */
  setTriageFocusedTaskIdProp?: (taskId: string | null) => void;
}

export interface UseInboxNavigationResult {
  triageFocusedTaskId: string | null;
  setTriageFocusedTaskId: (taskId: string | null) => void;
  moveFocusNext: () => void;
  moveFocusPrev: () => void;
  moveFocus: (direction: 'next' | 'prev') => void;
}

export const useInboxNavigation = ({
  triageEnabled,
  inboxTasks,
  triageFocusedTaskIdProp,
  setTriageFocusedTaskIdProp,
}: UseInboxNavigationParams): UseInboxNavigationResult => {
  // 외부에서 value+setter가 제공되는지 확인
  const isExternallyControlled =
    triageFocusedTaskIdProp !== undefined && typeof setTriageFocusedTaskIdProp === 'function';

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
   */
  const setTriageFocusedTaskId = useCallback(
    (taskId: string | null) => {
      if (isExternallyControlled && typeof setTriageFocusedTaskIdProp === 'function') {
        setTriageFocusedTaskIdProp(taskId);
      } else {
        setTriageFocusedTaskIdInternal(taskId);
      }
    },
    [isExternallyControlled, setTriageFocusedTaskIdProp],
  );

  const moveFocusNext = useCallback(() => {
    if (inboxTasks.length === 0) return;

    const currentIndex = triageFocusedTaskId
      ? inboxTasks.findIndex((t) => t.id === triageFocusedTaskId)
      : -1;

    const nextIndex = currentIndex < inboxTasks.length - 1 ? currentIndex + 1 : 0;
    setTriageFocusedTaskId(inboxTasks[nextIndex]?.id ?? null);
  }, [inboxTasks, triageFocusedTaskId, setTriageFocusedTaskId]);

  const moveFocusPrev = useCallback(() => {
    if (inboxTasks.length === 0) return;

    const currentIndex = triageFocusedTaskId
      ? inboxTasks.findIndex((t) => t.id === triageFocusedTaskId)
      : 0;

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : inboxTasks.length - 1;
    setTriageFocusedTaskId(inboxTasks[prevIndex]?.id ?? null);
  }, [inboxTasks, triageFocusedTaskId, setTriageFocusedTaskId]);

  const moveFocus = useMemo(() => {
    return (direction: 'next' | 'prev') => {
      if (direction === 'next') {
        moveFocusNext();
      } else {
        moveFocusPrev();
      }
    };
  }, [moveFocusNext, moveFocusPrev]);

  // 초기 포커스 설정
  useEffect(() => {
    if (triageEnabled && !triageFocusedTaskId && inboxTasks.length > 0) {
      setTriageFocusedTaskId(inboxTasks[0]?.id ?? null);
    }
  }, [triageEnabled, triageFocusedTaskId, inboxTasks, setTriageFocusedTaskId]);

  return {
    triageFocusedTaskId,
    setTriageFocusedTaskId,
    moveFocusNext,
    moveFocusPrev,
    moveFocus,
  };
};
