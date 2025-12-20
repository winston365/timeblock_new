/**
 * Task Filter Utilities
 *
 * @fileoverview Task 배열 필터링을 위한 공통 유틸리티
 *
 * @role Task 필터링 패턴 표준화
 * @responsibilities
 *   - 완료/미완료 작업 필터링
 *   - 타임블록별 작업 필터링
 *   - 인박스 작업 필터링
 * @dependencies
 *   - domain types: Task, TimeBlockId
 */

import type { Task, TimeBlockId } from '@/shared/types/domain';

// ============================================================================
// 완료 상태 필터
// ============================================================================

/**
 * 완료된 작업만 필터링
 *
 * @param tasks - Task 배열
 * @returns 완료된 작업 배열
 *
 * @example
 * const completed = filterCompletedTasks(dailyData.tasks);
 */
export function filterCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.completed);
}

/**
 * 미완료된 작업만 필터링
 *
 * @param tasks - Task 배열
 * @returns 미완료된 작업 배열
 *
 * @example
 * const pending = filterPendingTasks(dailyData.tasks);
 */
export function filterPendingTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.completed);
}

/**
 * 완료된 작업 개수 반환
 *
 * @param tasks - Task 배열
 * @returns 완료된 작업 수
 *
 * @example
 * const count = getCompletedCount(dailyData.tasks);
 */
export function getCompletedCount(tasks: Task[]): number {
  return tasks.filter(t => t.completed).length;
}

// ============================================================================
// 타임블록 필터
// ============================================================================

/**
 * 특정 타임블록의 작업만 필터링
 *
 * @param tasks - Task 배열
 * @param blockId - 타임블록 ID
 * @returns 해당 블록에 할당된 작업 배열
 *
 * @example
 * const blockTasks = filterByBlock(dailyData.tasks, 'morning');
 */
export function filterByBlock(tasks: Task[], blockId: TimeBlockId | string): Task[] {
  return tasks.filter(t => t.timeBlock === blockId);
}

/**
 * 특정 타임블록의 완료된 작업만 필터링
 *
 * @param tasks - Task 배열
 * @param blockId - 타임블록 ID
 * @returns 해당 블록에서 완료된 작업 배열
 *
 * @example
 * const completed = filterCompletedByBlock(dailyData.tasks, 'morning');
 */
export function filterCompletedByBlock(tasks: Task[], blockId: TimeBlockId | string): Task[] {
  return tasks.filter(t => t.timeBlock === blockId && t.completed);
}

/**
 * 특정 타임블록의 미완료된 작업만 필터링
 *
 * @param tasks - Task 배열
 * @param blockId - 타임블록 ID
 * @returns 해당 블록에서 미완료된 작업 배열
 *
 * @example
 * const incomplete = filterIncompleteByBlock(dailyData.tasks, 'morning');
 */
export function filterIncompleteByBlock(tasks: Task[], blockId: TimeBlockId | string): Task[] {
  return tasks.filter(t => t.timeBlock === blockId && !t.completed);
}

// ============================================================================
// 인박스 필터
// ============================================================================

/**
 * 인박스 작업만 필터링 (timeBlock === null)
 *
 * @param tasks - Task 배열
 * @returns 인박스에 있는 작업 배열
 *
 * @example
 * const inboxTasks = filterInboxTasks(tasks);
 */
export function filterInboxTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.timeBlock === null);
}

/**
 * 스케줄된 작업만 필터링 (timeBlock !== null)
 *
 * @param tasks - Task 배열
 * @returns 타임블록에 할당된 작업 배열
 *
 * @example
 * const scheduled = filterScheduledTasks(tasks);
 */
export function filterScheduledTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.timeBlock !== null);
}

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * Task 배열에서 텍스트만 추출
 *
 * @param tasks - Task 배열
 * @param maxLength - 각 텍스트의 최대 길이 (기본값: 무제한)
 * @returns 작업 텍스트 배열
 *
 * @example
 * const texts = extractTaskTexts(tasks, 25);
 */
export function extractTaskTexts(tasks: Task[], maxLength?: number): string[] {
  return tasks.map(t => 
    maxLength && t.text.length > maxLength 
      ? t.text.slice(0, maxLength) + '...' 
      : t.text
  );
}

/**
 * Task ID로 작업 찾기
 *
 * @param tasks - Task 배열
 * @param taskId - 찾을 Task ID
 * @returns Task 객체 또는 undefined
 *
 * @example
 * const task = findTaskById(tasks, 'task-123');
 */
export function findTaskById(tasks: Task[], taskId: string): Task | undefined {
  return tasks.find(t => t.id === taskId);
}

/**
 * Task ID로 작업 찾기 (존재하지 않으면 에러)
 *
 * @param tasks - Task 배열
 * @param taskId - 찾을 Task ID
 * @returns Task 객체
 * @throws Task를 찾지 못한 경우
 *
 * @example
 * const task = findTaskByIdOrThrow(tasks, 'task-123');
 */
export function findTaskByIdOrThrow(tasks: Task[], taskId: string): Task {
  const task = findTaskById(tasks, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}
