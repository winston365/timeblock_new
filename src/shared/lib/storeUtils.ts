/**
 * Store 유틸리티 함수
 *
 * @role Zustand 스토어에서 공통으로 사용되는 패턴들을 추상화하여 중복 제거
 * @input Store 상태, 업데이트 함수, 롤백 데이터
 * @output 표준화된 상태 업데이트 객체
 * @dependencies domain types
 */

import type { DailyData, Task, TimeBlockId } from '../types/domain';
import { TIME_BLOCKS } from '../types/domain';

// ============================================================================
// Firebase Sanitization
// ============================================================================

/**
 * Firebase는 undefined를 허용하지 않으므로 제거
 *
 * @param obj - 정리할 객체
 * @returns undefined가 제거된 객체
 */
export function sanitizeForFirebase<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const key in obj) {
    if (obj[key] !== undefined) {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}

// ============================================================================
// TimeBlock & HourSlot 계산
// ============================================================================

/**
 * TimeBlock에서 기본 hourSlot 계산
 *
 * @param timeBlock - 타임블록 ID
 * @returns 블록의 시작 시간 (hourSlot) 또는 null
 */
export function calculateDefaultHourSlot(timeBlock: TimeBlockId): number | null {
  if (timeBlock === null) return null;

  const block = TIME_BLOCKS.find(b => b.id === timeBlock);
  return block ? block.start : null;
}

/**
 * Task 업데이트 시 hourSlot 자동 계산 (Firebase undefined 처리 포함)
 *
 * @param updates - Task 업데이트 객체
 * @returns hourSlot이 보정된 업데이트 객체
 */
export function sanitizeTaskUpdates(updates: Partial<Task>): Partial<Task> {
  const sanitized = { ...updates };

  // hourSlot이 undefined인 경우 처리
  if ('hourSlot' in sanitized && sanitized.hourSlot === undefined) {
    if (sanitized.timeBlock) {
      // timeBlock이 있으면 블록의 첫 시간대로 설정
      sanitized.hourSlot = calculateDefaultHourSlot(sanitized.timeBlock) as any;
    } else {
      // inbox로 이동하는 경우 null
      sanitized.hourSlot = null as any;
    }
  }

  return sanitized;
}

// ============================================================================
// DailyData 업데이트 헬퍼
// ============================================================================

/**
 * DailyData 객체를 updatedAt과 함께 생성
 *
 * @param dailyData - 기존 DailyData
 * @param updates - 업데이트할 필드
 * @returns 새로운 DailyData 객체
 */
export function createUpdatedDailyData(
  dailyData: DailyData,
  updates: Partial<DailyData>
): DailyData {
  return {
    ...dailyData,
    ...updates,
    updatedAt: Date.now(),
  };
}

/**
 * Optimistic Update용 Task 배열 업데이트
 *
 * @param tasks - 기존 Task 배열
 * @param taskId - 업데이트할 Task ID
 * @param updates - 업데이트 내용
 * @returns 새로운 Task 배열
 */
export function updateTaskInArray(
  tasks: Task[],
  taskId: string,
  updates: Partial<Task>
): Task[] {
  return tasks.map(task =>
    task.id === taskId ? { ...task, ...updates } : task
  );
}

/**
 * Optimistic Update용 Task 추가
 *
 * @param tasks - 기존 Task 배열
 * @param newTask - 추가할 Task
 * @returns 새로운 Task 배열
 */
export function addTaskToArray(tasks: Task[], newTask: Task): Task[] {
  return [...tasks, newTask];
}

/**
 * Optimistic Update용 Task 삭제
 *
 * @param tasks - 기존 Task 배열
 * @param taskId - 삭제할 Task ID
 * @returns 새로운 Task 배열
 */
export function removeTaskFromArray(tasks: Task[], taskId: string): Task[] {
  return tasks.filter(task => task.id !== taskId);
}

// ============================================================================
// Optimistic Update 패턴
// ============================================================================

/**
 * Optimistic Update를 위한 DailyData 상태 객체 생성
 *
 * @param dailyData - 기존 DailyData
 * @param tasks - 새로운 Task 배열
 * @returns Optimistic Update용 상태 객체
 */
export function createOptimisticTaskUpdate(
  dailyData: DailyData,
  tasks: Task[]
): { dailyData: DailyData } {
  return {
    dailyData: createUpdatedDailyData(dailyData, { tasks }),
  };
}

/**
 * Optimistic Update를 위한 블록 상태 업데이트 객체 생성
 *
 * @param dailyData - 기존 DailyData
 * @param blockId - 블록 ID
 * @param updates - 블록 상태 업데이트
 * @returns Optimistic Update용 상태 객체
 */
export function createOptimisticBlockUpdate(
  dailyData: DailyData,
  blockId: string,
  updates: Partial<DailyData['timeBlockStates'][string]>
): { dailyData: DailyData } {
  const currentBlockState = dailyData.timeBlockStates[blockId] || {
    isLocked: false,
    isPerfect: false,
    isFailed: false,
  };

  return {
    dailyData: createUpdatedDailyData(dailyData, {
      timeBlockStates: {
        ...dailyData.timeBlockStates,
        [blockId]: { ...currentBlockState, ...updates },
      },
    }),
  };
}

// ============================================================================
// Rollback 패턴
// ============================================================================

/**
 * 롤백을 위한 에러 상태 객체 생성
 *
 * @param dailyData - 기존 DailyData
 * @param originalTasks - 원본 Task 배열
 * @param error - 에러 객체
 * @returns 롤백용 상태 객체
 */
export function createRollbackState(
  dailyData: DailyData,
  originalTasks: Task[],
  error: Error
): {
  dailyData: DailyData;
  error: Error;
} {
  return {
    dailyData: createUpdatedDailyData(dailyData, { tasks: originalTasks }),
    error,
  };
}

/**
 * 블록 상태 롤백을 위한 에러 상태 객체 생성
 *
 * @param dailyData - 기존 DailyData
 * @param originalBlockStates - 원본 블록 상태
 * @param error - 에러 객체
 * @returns 롤백용 상태 객체
 */
export function createBlockRollbackState(
  dailyData: DailyData,
  originalBlockStates: DailyData['timeBlockStates'],
  error: Error
): {
  dailyData: DailyData;
  error: Error;
} {
  return {
    dailyData: createUpdatedDailyData(dailyData, {
      timeBlockStates: originalBlockStates,
    }),
    error,
  };
}

/**
 * Task와 블록 상태 모두 롤백
 *
 * @param dailyData - 기존 DailyData
 * @param originalTasks - 원본 Task 배열
 * @param originalBlockStates - 원본 블록 상태
 * @param error - 에러 객체
 * @returns 롤백용 상태 객체
 */
export function createFullRollbackState(
  dailyData: DailyData,
  originalTasks: Task[],
  originalBlockStates: DailyData['timeBlockStates'],
  error: Error
): {
  dailyData: DailyData;
  error: Error;
} {
  return {
    dailyData: createUpdatedDailyData(dailyData, {
      tasks: originalTasks,
      timeBlockStates: originalBlockStates,
    }),
    error,
  };
}

// ============================================================================
// 유효성 검사
// ============================================================================

/**
 * DailyData가 존재하는지 검사
 *
 * @param dailyData - 검사할 DailyData
 * @param errorMessage - 에러 메시지 (선택)
 * @throws DailyData가 null인 경우 에러
 */
export function assertDailyDataExists(
  dailyData: DailyData | null,
  errorMessage = '[Store] No dailyData available'
): asserts dailyData is DailyData {
  if (!dailyData) {
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Task를 찾고 존재하지 않으면 에러
 *
 * @param tasks - Task 배열
 * @param taskId - Task ID
 * @returns Task 객체
 * @throws Task를 찾지 못한 경우
 */
export function findTaskOrThrow(tasks: Task[], taskId: string): Task {
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}
