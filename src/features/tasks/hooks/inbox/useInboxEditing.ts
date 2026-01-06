/**
 * @file useInboxEditing.ts
 * @description 인박스 triage 편집/뮤테이션(삭제, 편집, 고정, 보류) 로직
 */

import { useCallback } from 'react';
import { notify } from '@/shared/lib/notify';
import { getLocalDate } from '@/shared/lib/utils';
import type { TimeBlockId } from '@/shared/types/domain';
import type { MutableRefObject } from 'react';

export interface InboxTaskForEditing {
  id: string;
  isPinned?: boolean;
  deferredUntil?: string | null;
}

export interface UpdateInboxTaskPatch {
  isPinned?: boolean;
  deferredUntil?: string | null;
  timeBlock?: TimeBlockId;
  hourSlot?: number;
}

export interface UseInboxEditingParams {
  triageFocusedTaskId: string | null;
  inboxTasks: readonly InboxTaskForEditing[];
  updateTask: (taskId: string, patch: UpdateInboxTaskPatch) => Promise<void>;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  incrementProcessedCount: () => Promise<void>;
  isProcessingRef: MutableRefObject<boolean>;
}

export interface UseInboxEditingResult {
  handleDelete: () => Promise<void>;
  handleEdit: () => void;
  handleTogglePin: () => Promise<void>;
  handleToggleDefer: () => Promise<void>;
}

export const useInboxEditing = (params: UseInboxEditingParams): UseInboxEditingResult => {
  const {
    triageFocusedTaskId,
    inboxTasks,
    updateTask,
    onEditTask,
    onDeleteTask,
    incrementProcessedCount,
    isProcessingRef,
  } = params;

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
  }, [triageFocusedTaskId, onDeleteTask, incrementProcessedCount, isProcessingRef]);

  const handleEdit = useCallback(() => {
    if (!triageFocusedTaskId) return;
    if (typeof onEditTask !== 'function') return;
    onEditTask(triageFocusedTaskId);
  }, [triageFocusedTaskId, onEditTask]);

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
  }, [triageFocusedTaskId, inboxTasks, updateTask, isProcessingRef]);

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
  }, [triageFocusedTaskId, inboxTasks, updateTask, isProcessingRef]);

  return {
    handleDelete,
    handleEdit,
    handleTogglePin,
    handleToggleDefer,
  };
};
