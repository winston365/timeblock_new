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
 *   - dexieClient: IndexedDB 직접 조회
 */

import type { Task } from '@/shared/types/domain';
import { db } from '@/data/db/dexieClient';
import { 
  updateTask as updateDailyTask,
  deleteTask as deleteDailyTask,
  toggleTaskCompletion as toggleDailyTaskCompletion,
} from '@/data/repositories/dailyDataRepository';
import {
  updateInboxTask,
  deleteInboxTask,
  toggleInboxTaskCompletion,
} from '@/data/repositories/inboxRepository';
import { getLocalDate } from '@/shared/lib/utils';

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
  // 1. Inbox에서 먼저 찾기 (빠름)
  const inboxTask = await db.globalInbox.get(taskId);
  if (inboxTask) {
    return { location: 'inbox', task: inboxTask };
  }

  // 2. DailyData에서 찾기
  const targetDate = dateHint || getLocalDate();
  const dailyData = await db.dailyData.get(targetDate);
  
  if (dailyData) {
    const task = dailyData.tasks.find(t => t.id === taskId);
    if (task) {
      return { location: 'daily', task, date: targetDate };
    }
  }

  // 3. 다른 날짜의 DailyData에서 찾기 (최근 7일)
  const recentDates = getRecentDates(7);
  for (const date of recentDates) {
    if (date === targetDate) continue;
    
    const data = await db.dailyData.get(date);
    if (data) {
      const task = data.tasks.find(t => t.id === taskId);
      if (task) {
        return { location: 'daily', task, date };
      }
    }
  }

  // 4. completedInbox에서도 찾기
  const completedInboxTask = await db.completedInbox.get(taskId);
  if (completedInboxTask) {
    return { location: 'inbox', task: completedInboxTask };
  }

  return { location: 'not_found', task: null };
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
}

/**
 * 작업을 업데이트합니다. (저장소 자동 감지 + UI 실시간 반영)
 * 
 * @param taskId - 업데이트할 작업 ID
 * @param updates - 업데이트할 필드
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션 (skipStoreRefresh 등)
 * @returns 업데이트된 작업 또는 null
 */
export async function updateAnyTask(
  taskId: string, 
  updates: Partial<Task>,
  dateHint?: string,
  options?: UpdateAnyTaskOptions
): Promise<Task | null> {
  const { location, task, date } = await findTaskLocation(taskId, dateHint);

  if (location === 'not_found' || !task) {
    console.warn(`[UnifiedTaskService] Task not found: ${taskId}`);
    return null;
  }

  if (location === 'inbox') {
    await updateInboxTask(taskId, updates);
    if (!options?.skipStoreRefresh) {
      await refreshInboxStore();
    }
    return { ...task, ...updates };
  }

  if (location === 'daily' && date) {
    await updateDailyTask(taskId, updates, date);
    if (!options?.skipStoreRefresh) {
      await refreshDailyDataStore();
    }
    return { ...task, ...updates };
  }

  return null;
}

/**
 * 작업을 삭제합니다. (저장소 자동 감지 + UI 실시간 반영)
 * 
 * @param taskId - 삭제할 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션
 * @returns 삭제 성공 여부
 */
export async function deleteAnyTask(
  taskId: string, 
  dateHint?: string,
  options?: UpdateAnyTaskOptions
): Promise<boolean> {
  const { location, date } = await findTaskLocation(taskId, dateHint);

  if (location === 'not_found') {
    console.warn(`[UnifiedTaskService] Task not found for deletion: ${taskId}`);
    return false;
  }

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
}

/**
 * 작업 완료 상태를 토글합니다. (저장소 자동 감지 + UI 실시간 반영)
 * 
 * @param taskId - 토글할 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @param options - 추가 옵션
 * @returns 토글된 작업 또는 null
 */
export async function toggleAnyTaskCompletion(
  taskId: string, 
  dateHint?: string,
  options?: UpdateAnyTaskOptions
): Promise<Task | null> {
  const { location, date } = await findTaskLocation(taskId, dateHint);

  if (location === 'not_found') {
    console.warn(`[UnifiedTaskService] Task not found for toggle: ${taskId}`);
    return null;
  }

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
}

/**
 * 작업을 가져옵니다. (저장소 자동 감지)
 * 
 * @param taskId - 가져올 작업 ID
 * @param dateHint - 날짜 힌트 (성능 최적화)
 * @returns 작업 또는 null
 */
export async function getAnyTask(taskId: string, dateHint?: string): Promise<Task | null> {
  const { task } = await findTaskLocation(taskId, dateHint);
  return task;
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
  
  const [dailyData, inboxTasks] = await Promise.all([
    db.dailyData.get(targetDate),
    db.globalInbox.toArray(),
  ]);

  const dailyTasks = dailyData?.tasks || [];
  
  return [...dailyTasks, ...inboxTasks];
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
