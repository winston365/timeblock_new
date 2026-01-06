import { useCallback, useState } from 'react';

import { useDragDropManager } from '@/features/schedule/hooks/useDragDropManager';
import { notify } from '@/shared/lib/notify';

export interface UseInboxDragDropOptions {
  readonly onMoveTaskToInbox: (taskId: string) => Promise<void>;
}

export interface UseInboxDragDropReturn {
  readonly isDragOver: boolean;
  readonly handleDragOver: (e: React.DragEvent) => void;
  readonly handleDragLeave: () => void;
  readonly handleDrop: (e: React.DragEvent) => Promise<void>;
}

/**
 * Encapsulates Inbox drag-and-drop behavior.
 *
 * @sideEffects Updates tasks through injected callbacks.
 */
export const useInboxDragDrop = (options: UseInboxDragDropOptions): UseInboxDragDropReturn => {
  const { onMoveTaskToInbox } = options;
  const { getDragData } = useDragDropManager();

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent?.stopPropagation) {
        e.nativeEvent.stopPropagation();
      }

      setIsDragOver(false);

      const dragData = getDragData(e);
      if (!dragData) {
        console.warn('No drag data found in drop event');
        return;
      }

      try {
        await onMoveTaskToInbox(dragData.taskId);
      } catch (error) {
        console.error('Failed to move task to inbox:', error);
        notify.error(error instanceof Error ? error.message : '작업을 인박스로 이동하는데 실패했습니다.');
      }
    },
    [getDragData, onMoveTaskToInbox],
  );

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
