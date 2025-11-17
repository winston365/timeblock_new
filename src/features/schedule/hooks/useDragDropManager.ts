/**
 * useDragDropManager - 통합 드래그 앤 드롭 관리 훅
 *
 * @role 드래그 앤 드롭 데이터 전달 및 검증 로직 중앙화
 * @benefits
 *   - 타입 안전성 확보 (구조화된 데이터 전달)
 *   - 데이터베이스 재조회 제거 (task 전체 객체 포함)
 *   - 소스 정보로 최적화 가능 (같은 위치 드롭 방지)
 */

import type { Task, TimeBlockId } from '@/shared/types/domain';

/**
 * 드래그 데이터 인터페이스
 */
export interface DragData {
  taskId: string;
  sourceBlockId: TimeBlockId;
  sourceHourSlot?: number;
  taskData: Task; // 전체 객체 포함 (조회 제거)
}

/**
 * 브라우저 호환성을 위해 text/plain만 사용
 * (커스텀 MIME 타입은 일부 브라우저에서 지원 안됨)
 *
 * JSON 문자열을 text/plain에 직접 저장하여 구조화된 데이터 전달
 */
const DRAG_DATA_KEY = 'text/plain';

/**
 * 통합 드래그 앤 드롭 관리 훅
 *
 * @returns {object} setDragData, getDragData 함수
 * @example
 * const { setDragData, getDragData } = useDragDropManager();
 *
 * // 드래그 시작 시
 * const handleDragStart = (e: React.DragEvent) => {
 *   setDragData({
 *     taskId: task.id,
 *     sourceBlockId: task.timeBlock,
 *     sourceHourSlot: task.hourSlot,
 *     taskData: task,
 *   }, e);
 * };
 *
 * // 드롭 시
 * const handleDrop = (e: React.DragEvent) => {
 *   const dragData = getDragData(e);
 *   if (dragData) {
 *     // dragData.taskData를 직접 사용 (DB 조회 불필요)
 *   }
 * };
 */
export const useDragDropManager = () => {
  /**
   * 드래그 데이터 설정
   *
   * @param data - 전달할 드래그 데이터
   * @param e - React 드래그 이벤트
   */
  const setDragData = (data: DragData, e: React.DragEvent) => {
    // JSON 직렬화하여 text/plain에 저장 (브라우저 호환성 최대)
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  };

  /**
   * 드래그 데이터 가져오기
   *
   * @param e - React 드래그 이벤트
   * @returns 파싱된 드래그 데이터 또는 null (파싱 실패 시)
   */
  const getDragData = (e: React.DragEvent): DragData | null => {
    try {
      const raw = e.dataTransfer.getData(DRAG_DATA_KEY);
      if (!raw) {
        return null;
      }

      // JSON 파싱 시도
      try {
        const parsed = JSON.parse(raw) as DragData;
        // 필수 필드 검증
        if (parsed.taskId && parsed.taskData) {
          return parsed;
        }
      } catch {
        // JSON이 아니면 null 반환 (구조화된 데이터 아님)
        return null;
      }

      return null;
    } catch (error) {
      console.error('Failed to parse drag data:', error);
      return null;
    }
  };

  /**
   * 드래그 데이터가 같은 위치인지 확인
   *
   * @param dragData - 드래그 데이터
   * @param targetBlockId - 목표 블록 ID
   * @param targetHourSlot - 목표 시간 슬롯 (optional)
   * @returns 같은 위치면 true
   */
  const isSameLocation = (
    dragData: DragData,
    targetBlockId: TimeBlockId,
    targetHourSlot?: number
  ): boolean => {
    if (dragData.sourceBlockId !== targetBlockId) {
      return false;
    }

    // hourSlot이 지정된 경우에만 비교
    if (targetHourSlot !== undefined && dragData.sourceHourSlot !== undefined) {
      return dragData.sourceHourSlot === targetHourSlot;
    }

    // hourSlot이 없으면 블록만 같으면 같은 위치
    return true;
  };

  return {
    setDragData,
    getDragData,
    isSameLocation,
  };
};
