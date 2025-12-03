/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Store 유틸리티 함수
 *
 * @fileoverview Zustand 스토어에서 공통으로 사용되는 패턴들을 추상화한 유틸리티 모듈
 *
 * @role 스토어 상태 업데이트 및 롤백 패턴 표준화
 * @responsibilities
 *   - Firebase 호환성을 위한 데이터 정제 (undefined 제거)
 *   - TimeBlock/HourSlot 자동 계산
 *   - DailyData 업데이트 헬퍼 제공
 *   - Optimistic Update 패턴 지원
 *   - 롤백 상태 생성
 *   - 유효성 검사 어설션
 *   - 비동기 액션 래퍼 (로딩/에러 상태 관리)
 *
 * @dependencies
 *   - domain types: DailyData, Task, TimeBlockId, TIME_BLOCKS
 */

import type { DailyData, Task, TimeBlockId } from '../types/domain';
import { TIME_BLOCKS } from '../types/domain';

// ============================================================================
// 비동기 액션 래퍼 (Async Action Wrapper)
// ============================================================================

/**
 * Store 비동기 상태 인터페이스
 * 모든 Store에서 공통으로 사용되는 로딩/에러 상태
 */
export interface AsyncStoreState {
  loading: boolean;
  error: Error | null;
}

/**
 * 비동기 액션 옵션 인터페이스
 */
export interface AsyncActionOptions {
  /** 에러 로깅 시 사용할 접두사 (예: 'GoalStore') */
  errorPrefix?: string;
  /** 에러 발생 시 다시 throw 여부 (기본값: true) */
  rethrow?: boolean;
  /** 로딩 상태 설정 여부 (기본값: true) */
  setLoading?: boolean;
}

/**
 * Store 비동기 액션 래퍼
 *
 * 반복되는 try-catch, loading/error 상태 관리 패턴을 추상화합니다.
 *
 * @template T - 액션 함수의 반환 타입
 * @param set - Zustand set 함수
 * @param actionFn - 실행할 비동기 액션 함수
 * @param options - 옵션 (errorPrefix, rethrow, setLoading)
 * @returns 액션 실행 결과 또는 undefined (에러 시)
 *
 * @example
 * // 기존 패턴
 * loadData: async () => {
 *   set({ loading: true, error: null });
 *   try {
 *     const data = await loadFromRepo();
 *     set({ data, loading: false });
 *   } catch (error) {
 *     set({ error: error as Error, loading: false });
 *     console.error('GoalStore: Failed to load', error);
 *     throw error;
 *   }
 * }
 *
 * // 새 패턴
 * loadData: async () => {
 *   return withAsyncAction(set, async () => {
 *     const data = await loadFromRepo();
 *     set({ data });
 *     return data;
 *   }, { errorPrefix: 'GoalStore' });
 * }
 */
export async function withAsyncAction<T>(
  set: (state: Partial<AsyncStoreState & Record<string, any>>) => void,
  actionFn: () => Promise<T>,
  options: AsyncActionOptions = {}
): Promise<T | undefined> {
  const { errorPrefix, rethrow = true, setLoading = true } = options;

  if (setLoading) {
    set({ loading: true, error: null });
  }

  try {
    const result = await actionFn();
    if (setLoading) {
      set({ loading: false });
    }
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    set({ error: err, loading: false });

    if (errorPrefix) {
      console.error(`${errorPrefix}: Failed -`, error);
    } else {
      console.error('Store action failed:', error);
    }

    if (rethrow) {
      throw err;
    }
    return undefined;
  }
}

/**
 * Store 비동기 액션 래퍼 (에러 throw 없음)
 *
 * 에러가 발생해도 throw하지 않고 undefined를 반환합니다.
 * 비핵심 기능 (예: 카테고리 로드)에 적합합니다.
 *
 * @template T - 액션 함수의 반환 타입
 * @param set - Zustand set 함수
 * @param actionFn - 실행할 비동기 액션 함수
 * @param errorPrefix - 에러 로깅 시 사용할 접두사
 * @returns 액션 실행 결과 또는 undefined (에러 시)
 */
export async function withAsyncActionSafe<T>(
  set: (state: Partial<AsyncStoreState & Record<string, any>>) => void,
  actionFn: () => Promise<T>,
  errorPrefix?: string
): Promise<T | undefined> {
  return withAsyncAction(set, actionFn, { errorPrefix, rethrow: false });
}

/**
 * 로딩 상태 없이 비동기 액션 실행
 *
 * 백그라운드 작업 (예: 진행률 재계산)에 적합합니다.
 *
 * @template T - 액션 함수의 반환 타입
 * @param set - Zustand set 함수
 * @param actionFn - 실행할 비동기 액션 함수
 * @param errorPrefix - 에러 로깅 시 사용할 접두사
 * @returns 액션 실행 결과 또는 undefined (에러 시)
 */
export async function withBackgroundAction<T>(
  set: (state: Partial<AsyncStoreState & Record<string, any>>) => void,
  actionFn: () => Promise<T>,
  errorPrefix?: string
): Promise<T | undefined> {
  return withAsyncAction(set, actionFn, { errorPrefix, rethrow: false, setLoading: false });
}

// ============================================================================
// Firebase Sanitization
// ============================================================================

/**
 * Firebase는 undefined를 허용하지 않으므로 제거
 *
 * @deprecated 이 함수 대신 `@/shared/utils/firebaseSanitizer`의 `sanitizeForFirebase`를 사용하세요.
 *             해당 버전은 재귀적으로 중첩 객체를 처리하고, Firebase 키 검증도 수행합니다.
 * @see src/shared/utils/firebaseSanitizer.ts
 */
export { sanitizeForFirebase } from '@/shared/utils/firebaseSanitizer';

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
