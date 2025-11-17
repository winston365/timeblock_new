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
 * 커스텀 MIME 타입 (표준 text/plain 대신 구조화된 데이터 전달)
 * 브라우저 간 호환성을 위해 application/json 대신 커스텀 타입 사용
 */
const DRAG_DATA_KEY = 'application/x-timeblock-task';

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
    // JSON 직렬화로 구조화된 데이터 전달
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';

    // 폴백: 일부 브라우저는 커스텀 MIME 타입을 지원하지 않을 수 있음
    // text/plain도 설정하여 브라우저 호환성 보장
    e.dataTransfer.setData('text/plain', data.taskId);
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
      if (raw) {
        return JSON.parse(raw) as DragData;
      }

      // 폴백: 커스텀 타입이 없으면 text/plain에서 taskId만 가져오기
      // (이전 버전과의 호환성을 위해)
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) {
        // taskData가 없으면 null 반환 (구조화된 데이터 없음)
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
