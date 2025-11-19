/**
 * useDragDrop - 드래그 앤 드롭 로직 캡슐화 훅
 *
 * @role 드래그 앤 드롭 핸들러를 재사용 가능한 훅으로 추상화 (단일 책임 원칙)
 * @benefits
 *   - 중복 코드 제거 (DRY)
 *   - 테스트 용이
 *   - 비즈니스 로직 재사용
 */

import { useState } from 'react';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { useDragDropManager } from './useDragDropManager';

let lastDropEventId: number | null = null;

/**
 * 드래그 앤 드롭 훅
 *
 * @param blockId - 드롭 대상 블록 ID
 * @param hourSlot - 드롭 대상 시간 슬롯 (optional)
 * @returns 드래그 앤 드롭 핸들러와 상태
 * @example
 * const {
 *   isDragOver,
 *   handleDragStart,
 *   handleDragOver,
 *   handleDragLeave,
 *   handleDrop,
 * } = useDragDrop(blockId, hourSlot);
 */
export const useDragDrop = (
  blockId: TimeBlockId,
  hourSlot?: number
) => {
  const { setDragData, getDragData, isSameLocation } = useDragDropManager();
  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * 드래그 시작 핸들러
   *
   * @param task - 드래그할 작업
   * @param e - React 드래그 이벤트
   */
  const handleDragStart = (task: Task, e: React.DragEvent) => {
    setDragData(
      {
        taskId: task.id,
        sourceBlockId: task.timeBlock,
        sourceHourSlot: task.hourSlot,
        taskData: task,
      },
      e
    );
  };

  /**
   * 드래그 오버 핸들러
   *
   * @param e - React 드래그 이벤트
   *
   * NOTE: dragOver 이벤트에서는 dataTransfer.getData()를 호출할 수 없음 (브라우저 보안 제약)
   * 따라서 같은 위치 검증은 handleDrop에서만 수행
   */
  const handleDragOver = (e: React.DragEvent) => {
    // 드롭 허용 (같은 위치 검증은 drop 시점에 수행)
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  /**
   * 드래그 리브 핸들러
   */
  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  /**
   * 드롭 핸들러
   *
   * @param e - React 드래그 이벤트
   * @param onUpdate - 작업 업데이트 콜백 함수
   */
  const handleDrop = async (
    e: React.DragEvent,
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent?.stopPropagation) {
      e.nativeEvent.stopPropagation();
    }
    setIsDragOver(false);

    const eventId = e.timeStamp ?? e.nativeEvent?.timeStamp ?? null;
    if (eventId !== null) {
      if (lastDropEventId === eventId) {
        return;
      }
      lastDropEventId = eventId;
      setTimeout(() => {
        if (lastDropEventId === eventId) {
          lastDropEventId = null;
        }
      }, 0);
    }

    const dragData = getDragData(e);
    if (!dragData) {
      console.warn('No drag data found in drop event');
      return;
    }

    // 같은 위치면 무시
    if (isSameLocation(dragData, blockId, hourSlot)) {
      return;
    }

    try {
      // Optimistic UI: UI는 이미 dragData.taskData를 가지고 있으므로
      // 업데이트 호출만 하면 됨 (repository에서 낙관적 업데이트 처리)
      await onUpdate(dragData.taskId, {
        timeBlock: blockId,
        hourSlot: hourSlot,
      });
    } catch (error) {
      console.error('Failed to update task on drop:', error);
      // 에러 발생 시 UI는 자동으로 이전 상태로 롤백됨
      // (repository의 실패 처리에 의존)
    }
  };

  return {
    isDragOver,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
