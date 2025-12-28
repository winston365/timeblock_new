/**
 * Unified Task Service
 *
 * @role DailyData와 GlobalInbox의 작업을 통합하여 관리하는 서비스
 * @responsibilities
 *   - Task는 timeBlock 값에 따라 두 저장소에 분리 저장됨
 *   - 이 서비스는 저장소를 추상화하여 단일 API 제공
 *   - 통합 검색 등에서 사용
 *   - Store도 함께 업데이트하여 UI 실시간 반영
 * @dependencies
 *   - dailyDataRepository: 날짜별 타임블록 작업
 *   - inboxRepository: 전역 인박스 작업
 *   - dailyDataStore: UI 상태 (dailyData)
 *   - inboxStore: UI 상태 (inbox)
 */

import type { Task } from '@/shared/types/domain';
import { 
  updateTask as updateDailyTask,
  deleteTask as deleteDailyTask,
  toggleTaskCompletion as toggleDailyTaskCompletion,
  loadDailyData,
} from '@/data/repositories/dailyDataRepository';
import {
  updateInboxTask,
  deleteInboxTask,
  toggleInboxTaskCompletion,
  getInboxTaskById,
  loadInboxTasks,
} from '@/data/repositories/inboxRepository';
import { getLocalDate } from '@/shared/lib/utils';
import { toStandardError } from '@/shared/lib/standardError';

// ============================================================================
// Core (Pure) Helpers
// ============================================================================

const findTaskInDailyData_core = (taskId: string, dailyData: { tasks: Task[] } | null | undefined): Task | null => {
  const tasks = dailyData?.tasks;
  if (!tasks) return null;
  return tasks.find(t => t.id === taskId) ?? null;
};

const mergeTaskUpdates_core = (task: Task, updates: Partial<Task>): Task => ({
  ...task,
  ...updates,
});

// ============================================================================
// Task Location Detection
// ============================================================================

export type TaskLocation = 'daily' | 'inbox' | 'not_found';

interface TaskLocationResult {
  location: TaskLocation;
  task: Task | null;
  date?: string; // daily인 경우 날짜
}

/**
 * 작업의 저장소 위치를 찾습니다.
 * 
 * @param taskId - 찾을 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화, 없으면 오늘 날짜 사용)
 * @returns TaskLocationResult
 */
export async function findTaskLocation(taskId: string, dateHint?: string): Promise<TaskLocationResult> {
  try {
    // 1. Inbox에서 먼저 찾기 (globalInbox + completedInbox)
    const inboxTask = await getInboxTaskById(taskId);
    if (inboxTask) {
      return { location: 'inbox', task: inboxTask };
    }

    // 2. DailyData에서 찾기
    const targetDate = dateHint || getLocalDate();
    const dailyData = await loadDailyData(targetDate);

    const taskInTarget = findTaskInDailyData_core(taskId, dailyData);
    if (taskInTarget) {
      return { location: 'daily', task: taskInTarget, date: targetDate };
    }

    // 3. 다른 날짜의 DailyData에서 찾기 (최근 7일)
    const recentDates = getRecentDates(7);
    for (const date of recentDates) {
      if (date === targetDate) continue;

      const data = await loadDailyData(date);
      const taskInRecent = findTaskInDailyData_core(taskId, data);
      if (taskInRecent) {
        return { location: 'daily', task: taskInRecent, date };
      }
    }

    return { location: 'not_found', task: null };
  } catch (error) {
    throw toStandardError({
      code: 'TASK_LOCATION_FIND_FAILED',
      error,
      context: { taskId, dateHint },
    });
  }
}

// ============================================================================
// Store Refresh Helpers (동적 import로 순환 의존성 방지)
// ============================================================================

async function refreshDailyDataStore(): Promise<void> {
  const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
  await useDailyDataStore.getState().refresh();
}

async function refreshInboxStore(): Promise<void> {
  const { useInboxStore } = await import('@/shared/stores/inboxStore');
  await useInboxStore.getState().refresh();
}

// ============================================================================
// Unified CRUD Operations
// ============================================================================

export interface UpdateAnyTaskOptions {
  /** Store 갱신 스킵 (배치 작업 시 마지막에만 갱신할 때 사용) */
  skipStoreRefresh?: boolean;
  /**
   * Optimistic Update 사용 여부
   * 
   * true: 스토어의 optimistic update API를 사용 (즉시 UI 반영 + 롤백 지원)
   * false (기본): 기존 방식 (repo write → store refresh)
   * 
   * @default false
   */
  optimistic?: boolean;
}

/**
 * 작업을 업데이트합니다. (저장소 자동 감지 + UI 실시간 반영)
 * 
 * @param taskId - 업데이트할 작업 ID
 * @param updates - 업데이트할 필드
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션 (skipStoreRefresh, optimistic 등)
 * @returns 업데이트된 작업 또는 null
 */
export async function updateAnyTask(
  taskId: string, 
  updates: Partial<Task>,
  dateHint?: string,
  options?: UpdateAnyTaskOptions
): Promise<Task | null> {
  try {
    const { location, task, date } = await findTaskLocation(taskId, dateHint);

    if (location === 'not_found' || !task) {
      console.warn(`[UnifiedTaskService] Task not found: ${taskId}`);
      return null;
    }

    // Optimistic 모드: 스토어 위임 (스토어가 optimistic update + rollback 처리)
    if (options?.optimistic) {
      return await updateAnyTaskOptimistic(taskId, updates, location, task, date);
    }

    // 기존 방식: repo write → store refresh
    if (location === 'inbox') {
      await updateInboxTask(taskId, updates);
      if (!options?.skipStoreRefresh) {
        await refreshInboxStore();
      }
      return mergeTaskUpdates_core(task, updates);
    }

    if (location === 'daily' && date) {
      await updateDailyTask(taskId, updates, date);
      if (!options?.skipStoreRefresh) {
        await refreshDailyDataStore();
      }
      return mergeTaskUpdates_core(task, updates);
    }

    return null;
  } catch (error) {
    throw toStandardError({
      code: 'TASK_UPDATE_FAILED',
      error,
      context: { taskId, updates, dateHint, options },
    });
  }
}

/**
 * Optimistic 모드로 작업 업데이트 (스토어 위임)
 * 
 * 스토어의 optimistic update API를 사용하여:
 * 1. UI 즉시 반영 (optimistic update)
 * 2. Dexie 커밋
 * 3. 실패 시 자동 롤백
 */
async function updateAnyTaskOptimistic(
  taskId: string,
  updates: Partial<Task>,
  location: TaskLocation,
  task: Task,
  date?: string
): Promise<Task | null> {
  if (location === 'inbox') {
    const { useInboxStore } = await import('@/shared/stores/inboxStore');
    await useInboxStore.getState().updateTask(taskId, updates);
    return mergeTaskUpdates_core(task, updates);
  }

  if (location === 'daily' && date) {
    const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
    await useDailyDataStore.getState().updateTask(taskId, updates);
    return mergeTaskUpdates_core(task, updates);
  }

  return null;
}

/**
 * 작업을 삭제합니다. (저장소 자동 감지 + UI 실시간 반영)
 * 
 * @param taskId - 삭제할 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션 (optimistic 등)
 * @returns 삭제 성공 여부
 */
export async function deleteAnyTask(
  taskId: string, 
  dateHint?: string,
  options?: UpdateAnyTaskOptions
): Promise<boolean> {
  try {
    const { location, date } = await findTaskLocation(taskId, dateHint);

    if (location === 'not_found') {
      console.warn(`[UnifiedTaskService] Task not found for deletion: ${taskId}`);
      return false;
    }

    // Optimistic 모드: 스토어 위임
    if (options?.optimistic) {
      return await deleteAnyTaskOptimistic(taskId, location);
    }

    // 기존 방식: repo write → store refresh
    if (location === 'inbox') {
      await deleteInboxTask(taskId);
      if (!options?.skipStoreRefresh) {
        await refreshInboxStore();
      }
      return true;
    }

    if (location === 'daily' && date) {
      await deleteDailyTask(taskId, date);
      if (!options?.skipStoreRefresh) {
        await refreshDailyDataStore();
      }
      return true;
    }

    return false;
  } catch (error) {
    throw toStandardError({
      code: 'TASK_DELETE_FAILED',
      error,
      context: { taskId, dateHint, options },
    });
  }
}

/**
 * Optimistic 모드로 작업 삭제 (스토어 위임)
 */
async function deleteAnyTaskOptimistic(
  taskId: string,
  location: TaskLocation
): Promise<boolean> {
  if (location === 'inbox') {
    const { useInboxStore } = await import('@/shared/stores/inboxStore');
    await useInboxStore.getState().deleteTask(taskId);
    return true;
  }

  if (location === 'daily') {
    const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
    await useDailyDataStore.getState().deleteTask(taskId);
    return true;
  }

  return false;
}

/**
 * 작업 완료 상태를 토글합니다. (저장소 자동 감지 + UI 실시간 반영)
 * 
 * @param taskId - 토글할 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션 (optimistic 등)
 * @returns 토글된 작업 또는 null
 */
export async function toggleAnyTaskCompletion(
  taskId: string, 
  dateHint?: string,
  options?: UpdateAnyTaskOptions
): Promise<Task | null> {
  try {
    const { location, task, date } = await findTaskLocation(taskId, dateHint);

    if (location === 'not_found') {
      console.warn(`[UnifiedTaskService] Task not found for toggle: ${taskId}`);
      return null;
    }

    // Optimistic 모드: 스토어 위임
    // 주의: 스토어의 toggleTaskCompletion은 void를 반환하므로,
    // 예상 결과를 직접 계산하여 반환
    if (options?.optimistic) {
      return await toggleAnyTaskCompletionOptimistic(taskId, location, task);
    }

    // 기존 방식: repo write → store refresh
    if (location === 'inbox') {
      const result = await toggleInboxTaskCompletion(taskId);
      if (!options?.skipStoreRefresh) {
        await refreshInboxStore();
      }
      return result;
    }

    if (location === 'daily' && date) {
      const result = await toggleDailyTaskCompletion(taskId, date);
      if (!options?.skipStoreRefresh) {
        await refreshDailyDataStore();
      }
      return result;
    }

    return null;
  } catch (error) {
    throw toStandardError({
      code: 'TASK_TOGGLE_COMPLETION_FAILED',
      error,
      context: { taskId, dateHint, options },
    });
  }
}

/**
 * Optimistic 모드로 작업 완료 토글 (스토어 위임)
 */
async function toggleAnyTaskCompletionOptimistic(
  taskId: string,
  location: TaskLocation,
  task: Task | null
): Promise<Task | null> {
  if (!task) return null;

  // 예상 결과 계산 (스토어가 실제 변경 처리)
  const expectedResult: Task = {
    ...task,
    completed: !task.completed,
    completedAt: !task.completed ? new Date().toISOString() : null,
  };

  if (location === 'inbox') {
    const { useInboxStore } = await import('@/shared/stores/inboxStore');
    await useInboxStore.getState().toggleTaskCompletion(taskId);
    return expectedResult;
  }

  if (location === 'daily') {
    const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
    await useDailyDataStore.getState().toggleTaskCompletion(taskId);
    return expectedResult;
  }

  return null;
}

/**
 * 작업을 가져옵니다. (저장소 자동 감지)
 * 
 * @param taskId - 가져올 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @returns 작업 또는 null
 */
export async function getAnyTask(taskId: string, dateHint?: string): Promise<Task | null> {
  try {
    const { task } = await findTaskLocation(taskId, dateHint);
    return task;
  } catch (error) {
    throw toStandardError({
      code: 'TASK_GET_FAILED',
      error,
      context: { taskId, dateHint },
    });
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * 모든 활성 작업을 가져옵니다. (DailyData + Inbox)
 * 
 * @param date - 날짜 (기본: 오늘)
 * @returns 모든 활성 작업 배열
 */
export async function getAllActiveTasks(date?: string): Promise<Task[]> {
  const targetDate = date || getLocalDate();

  try {
    const [dailyData, inboxTasks] = await Promise.all([
      loadDailyData(targetDate),
      loadInboxTasks(),
    ]);

    const dailyTasks = dailyData?.tasks || [];
    return [...dailyTasks, ...inboxTasks];
  } catch (error) {
    throw toStandardError({
      code: 'TASK_GET_ALL_ACTIVE_FAILED',
      error,
      context: { date: targetDate },
    });
  }
}

/**
 * 미완료 작업만 가져옵니다. (DailyData + Inbox)
 * 
 * @param date - 날짜 (기본: 오늘)
 * @returns 미완료 작업 배열
 */
export async function getUncompletedTasks(date?: string): Promise<Task[]> {
  const allTasks = await getAllActiveTasks(date);
  return allTasks.filter(t => !t.completed);
}

// ============================================================================
// Inbox ↔ Block 이동 (Optimistic Update)
// ============================================================================

export interface MoveTaskOptions {
  /** Optimistic Update 사용 (기본: true) */
  optimistic?: boolean;
}

/**
 * Inbox에서 TimeBlock으로 작업을 이동합니다. (낙관적 갱신)
 * 
 * UI가 즉시 반영되고, 실패 시 자동 롤백됩니다.
 * 
 * @param taskId - 이동할 작업 ID
 * @param timeBlock - 목표 타임블록 ID
 * @param options - 추가 옵션
 * @returns 성공 여부
 */
export async function moveInboxToBlock(
  taskId: string,
  timeBlock: string,
  options?: MoveTaskOptions
): Promise<boolean> {
  const { optimistic = true } = options || {};

  try {
    // dailyDataStore의 updateTask가 inbox→block 이동을 처리
    // (이미 optimistic update + rollback 지원)
    if (optimistic) {
      const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
      await useDailyDataStore.getState().updateTask(taskId, { timeBlock });
      return true;
    }

    // 비-optimistic 모드: inbox에서 task 가져와서 daily로 이동
    const { location, task } = await findTaskLocation(taskId);
    if (location !== 'inbox' || !task) {
      console.warn(`[UnifiedTaskService] Task not found in inbox: ${taskId}`);
      return false;
    }

    await updateInboxTask(taskId, { timeBlock });
    await refreshInboxStore();
    await refreshDailyDataStore();
    return true;
  } catch (error) {
    throw toStandardError({
      code: 'TASK_MOVE_INBOX_TO_BLOCK_FAILED',
      error,
      context: { taskId, timeBlock, options },
    });
  }
}

/**
 * TimeBlock에서 Inbox로 작업을 이동합니다. (낙관적 갱신)
 * 
 * UI가 즉시 반영되고, 실패 시 자동 롤백됩니다.
 * 
 * @param taskId - 이동할 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션
 * @returns 성공 여부
 */
export async function moveBlockToInbox(
  taskId: string,
  dateHint?: string,
  options?: MoveTaskOptions
): Promise<boolean> {
  const { optimistic = true } = options || {};

  try {
    if (optimistic) {
      // dailyDataStore의 updateTask가 block→inbox 이동을 처리
      const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
      await useDailyDataStore.getState().updateTask(taskId, { timeBlock: null });
      return true;
    }

    // 비-optimistic 모드
    const { location, date } = await findTaskLocation(taskId, dateHint);
    if (location !== 'daily' || !date) {
      console.warn(`[UnifiedTaskService] Task not found in daily: ${taskId}`);
      return false;
    }

    await updateDailyTask(taskId, { timeBlock: null }, date);
    await refreshDailyDataStore();
    await refreshInboxStore();
    return true;
  } catch (error) {
    throw toStandardError({
      code: 'TASK_MOVE_BLOCK_TO_INBOX_FAILED',
      error,
      context: { taskId, dateHint, options },
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  
  return dates;
}
