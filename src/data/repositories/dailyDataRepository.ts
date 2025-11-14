/**
 * DailyData 저장소
 * 일일 데이터(작업, 블록 상태) CRUD 관리
 */

import { db } from '../db/dexieClient';
import type { DailyData, Task, TimeBlockStates, TimeBlockState } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate, saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { STORAGE_KEYS } from '@/shared/lib/constants';
import { addSyncLog } from '@/shared/services/syncLogger';

// ============================================================================
// DailyData CRUD
// ============================================================================

/**
 * 특정 날짜의 DailyData 로드
 */
export async function loadDailyData(date: string = getLocalDate()): Promise<DailyData> {
  try {
    // 1. IndexedDB에서 먼저 조회
    const data = await db.dailyData.get(date);

    if (data) {
      addSyncLog('dexie', 'load', `DailyData loaded for ${date}`, { taskCount: data.tasks.length });
      // IndexedDB에 데이터가 있으면 반환
      return {
        tasks: data.tasks,
        timeBlockStates: data.timeBlockStates,
        updatedAt: data.updatedAt,
      };
    }

    // 2. localStorage에서 조회 (IndexedDB 실패 시)
    const localData = getFromStorage<DailyData | null>(`${STORAGE_KEYS.DAILY_PLANS}${date}`, null);

    if (localData) {
      // localStorage 데이터를 IndexedDB에 저장
      await saveDailyData(date, localData.tasks, localData.timeBlockStates);
      return localData;
    }

    // 3. 데이터가 없으면 초기 상태 반환
    addSyncLog('dexie', 'load', `No data found for ${date}, creating empty data`);
    return createEmptyDailyData();
  } catch (error) {
    console.error(`Failed to load daily data for ${date}:`, error);
    addSyncLog('dexie', 'error', `Failed to load daily data for ${date}`, undefined, error as Error);
    return createEmptyDailyData();
  }
}

/**
 * DailyData 저장
 */
export async function saveDailyData(
  date: string = getLocalDate(),
  tasks: Task[],
  timeBlockStates: TimeBlockStates
): Promise<void> {
  const updatedAt = Date.now();

  const data: DailyData = {
    tasks,
    timeBlockStates,
    updatedAt,
  };

  try {
    // 1. IndexedDB에 저장
    await db.dailyData.put({
      date,
      ...data,
    });

    // 2. localStorage에도 저장 (빠른 접근용)
    saveToStorage(`${STORAGE_KEYS.DAILY_PLANS}${date}`, data);

    addSyncLog('dexie', 'save', `DailyData saved for ${date}`, { taskCount: tasks.length });
    console.log(`✅ Daily data saved for ${date}`);
  } catch (error) {
    console.error(`Failed to save daily data for ${date}:`, error);
    addSyncLog('dexie', 'error', `Failed to save daily data for ${date}`, undefined, error as Error);
    throw error;
  }
}

/**
 * 빈 DailyData 생성
 */
export function createEmptyDailyData(): DailyData {
  const timeBlockStates: TimeBlockStates = {};

  // 모든 블록의 초기 상태 생성
  TIME_BLOCKS.forEach(block => {
    timeBlockStates[block.id] = {
      isLocked: false,
      isPerfect: false,
      isFailed: false,
    };
  });

  return {
    tasks: [],
    timeBlockStates,
    updatedAt: Date.now(),
  };
}

/**
 * 특정 날짜의 DailyData 삭제
 */
export async function deleteDailyData(date: string): Promise<void> {
  try {
    await db.dailyData.delete(date);
    localStorage.removeItem(`${STORAGE_KEYS.DAILY_PLANS}${date}`);
    console.log(`🗑️ Daily data deleted for ${date}`);
  } catch (error) {
    console.error(`Failed to delete daily data for ${date}:`, error);
    throw error;
  }
}

// ============================================================================
// Task CRUD
// ============================================================================

/**
 * Task 추가
 */
export async function addTask(task: Task, date: string = getLocalDate()): Promise<void> {
  try {
    const dailyData = await loadDailyData(date);
    dailyData.tasks.push(task);
    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
  } catch (error) {
    console.error('Failed to add task:', error);
    throw error;
  }
}

/**
 * Task 업데이트
 */
export async function updateTask(taskId: string, updates: Partial<Task>, date: string = getLocalDate()): Promise<void> {
  try {
    const dailyData = await loadDailyData(date);
    const taskIndex = dailyData.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      throw new Error(`Task not found: ${taskId}`);
    }

    dailyData.tasks[taskIndex] = {
      ...dailyData.tasks[taskIndex],
      ...updates,
    };

    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
}

/**
 * Task 삭제
 */
export async function deleteTask(taskId: string, date: string = getLocalDate()): Promise<void> {
  try {
    const dailyData = await loadDailyData(date);
    dailyData.tasks = dailyData.tasks.filter(t => t.id !== taskId);
    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

/**
 * Task 완료 토글
 */
export async function toggleTaskCompletion(taskId: string, date: string = getLocalDate()): Promise<Task> {
  try {
    const dailyData = await loadDailyData(date);
    const task = dailyData.tasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);

    return task;
  } catch (error) {
    console.error('Failed to toggle task completion:', error);
    throw error;
  }
}

// ============================================================================
// TimeBlockState CRUD
// ============================================================================

/**
 * 블록 상태 업데이트
 */
export async function updateBlockState(
  blockId: string,
  updates: Partial<TimeBlockState>,
  date: string = getLocalDate()
): Promise<void> {
  try {
    const dailyData = await loadDailyData(date);

    if (!dailyData.timeBlockStates[blockId]) {
      dailyData.timeBlockStates[blockId] = {
        isLocked: false,
        isPerfect: false,
        isFailed: false,
      };
    }

    dailyData.timeBlockStates[blockId] = {
      ...dailyData.timeBlockStates[blockId],
      ...updates,
    };

    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
  } catch (error) {
    console.error('Failed to update block state:', error);
    throw error;
  }
}

/**
 * 블록 잠금 토글
 */
export async function toggleBlockLock(blockId: string, date: string = getLocalDate()): Promise<boolean> {
  try {
    const dailyData = await loadDailyData(date);
    const blockState = dailyData.timeBlockStates[blockId];

    if (!blockState) {
      throw new Error(`Block state not found: ${blockId}`);
    }

    blockState.isLocked = !blockState.isLocked;

    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);

    return blockState.isLocked;
  } catch (error) {
    console.error('Failed to toggle block lock:', error);
    throw error;
  }
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * 인박스 작업 가져오기
 */
export async function getInboxTasks(date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => !task.timeBlock);
}

/**
 * 완료된 작업 가져오기
 */
export async function getCompletedTasks(date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => task.completed);
}

/**
 * 특정 블록의 작업 가져오기
 */
export async function getBlockTasks(blockId: string, date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => task.timeBlock === blockId);
}

/**
 * 최근 N일의 데이터 가져오기
 */
export async function getRecentDailyData(days: number): Promise<Array<DailyData & { date: string }>> {
  try {
    const dates: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(getLocalDate(date));
    }

    const dataPromises = dates.map(async date => {
      const data = await loadDailyData(date);
      return { date, ...data };
    });

    return await Promise.all(dataPromises);
  } catch (error) {
    console.error('Failed to get recent daily data:', error);
    return [];
  }
}
