/**
 * DailyData Repository
 *
 * @role 일일 작업 데이터 및 타임블록 상태 관리
 * @input DailyData 객체, Task 객체, TimeBlockState 객체, 날짜 문자열
 * @output DailyData 객체, Task 배열, TimeBlockState 객체
 * @external_dependencies
 *   - IndexedDB (db.dailyData): 메인 저장소
 *   - localStorage (STORAGE_KEYS.DAILY_PLANS): 백업 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: DailyData, Task, TimeBlockStates 타입
 */

import { db } from '../db/dexieClient';
import type { DailyData, Task, TimeBlockStates, TimeBlockState } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate, saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { STORAGE_KEYS } from '@/shared/lib/constants';
import { addSyncLog } from '@/shared/services/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/firebaseService';
import { syncToFirebase } from '@/shared/services/firebase/syncCore';
import { dailyDataStrategy } from '@/shared/services/firebase/strategies';

// ============================================================================
// DailyData CRUD
// ============================================================================

/**
 * 특정 날짜의 DailyData 로드
 *
 * @param {string} [date] - 조회할 날짜 (기본값: 오늘)
 * @returns {Promise<DailyData>} 일일 데이터 객체 (없으면 빈 데이터)
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - localStorage 폴백 시 IndexedDB에 데이터 복원
 *   - syncLogger에 로그 기록
 */
export async function loadDailyData(date: string = getLocalDate()): Promise<DailyData> {
  try {
    // 1. IndexedDB에서 먼저 조회
    const data = await db.dailyData.get(date);

    if (data) {
      // 데이터 유효성 검사
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const timeBlockStates = data.timeBlockStates || {};

      addSyncLog('dexie', 'load', `DailyData loaded for ${date}`, { taskCount: tasks.length });
      // IndexedDB에 데이터가 있으면 반환
      return {
        tasks,
        timeBlockStates,
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
 *
 * @param {string} [date] - 저장할 날짜 (기본값: 오늘)
 * @param {Task[]} tasks - 작업 배열
 * @param {TimeBlockStates} timeBlockStates - 블록 상태 객체
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 데이터 저장
 *   - localStorage에 백업
 *   - Firebase에 비동기 동기화
 *   - syncLogger에 로그 기록
 */
export async function saveDailyData(
  date: string = getLocalDate(),
  tasks: Task[],
  timeBlockStates: TimeBlockStates
): Promise<void> {
  const updatedAt = Date.now();

  // Firebase는 undefined를 허용하지 않으므로, 모든 undefined 값을 빈 문자열로 변환
  const sanitizedTasks = tasks.map(task => ({
    ...task,
    preparation1: task.preparation1 ?? '',
    preparation2: task.preparation2 ?? '',
    preparation3: task.preparation3 ?? '',
  }));

  const data: DailyData = {
    tasks: sanitizedTasks,
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

    addSyncLog('dexie', 'save', `DailyData saved for ${date}`, {
      taskCount: sanitizedTasks.length,
      completedTasks: sanitizedTasks.filter(t => t.completed).length
    });

    // 3. Firebase에 동기화 (비동기, 실패해도 로컬은 성공)
    if (isFirebaseInitialized()) {
      syncToFirebase(dailyDataStrategy, data, date).catch(err => {
        console.error('Firebase sync failed, but local save succeeded:', err);
      });
    }
  } catch (error) {
    console.error(`Failed to save daily data for ${date}:`, error);
    addSyncLog('dexie', 'error', `Failed to save daily data for ${date}`, undefined, error as Error);
    throw error;
  }
}

/**
 * 빈 DailyData 생성
 *
 * @returns {DailyData} 모든 블록이 초기 상태로 설정된 빈 데이터
 * @throws 없음
 * @sideEffects 없음 (순수 함수)
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
 *
 * @param {string} date - 삭제할 날짜
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 삭제 실패 시
 * @sideEffects
 *   - IndexedDB에서 데이터 삭제
 *   - localStorage에서 데이터 삭제
 */
export async function deleteDailyData(date: string): Promise<void> {
  try {
    await db.dailyData.delete(date);
    localStorage.removeItem(`${STORAGE_KEYS.DAILY_PLANS}${date}`);
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
 *
 * @param {Task} task - 추가할 작업 객체
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 데이터 로드 또는 저장 실패 시
 * @sideEffects
 *   - loadDailyData 및 saveDailyData 호출
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
 *
 * @param {string} taskId - 업데이트할 작업 ID
 * @param {Partial<Task>} updates - 업데이트할 필드
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - loadDailyData 및 saveDailyData 호출
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
 *
 * @param {string} taskId - 삭제할 작업 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 데이터 로드 또는 저장 실패 시
 * @sideEffects
 *   - loadDailyData 및 saveDailyData 호출
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
 *
 * @param {string} taskId - 토글할 작업 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task>} 토글된 작업 객체
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - 작업의 completed 및 completedAt 필드 변경
 *   - loadDailyData 및 saveDailyData 호출
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
 *
 * @param {string} blockId - 블록 ID
 * @param {Partial<TimeBlockState>} updates - 업데이트할 상태 필드
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 데이터 로드 또는 저장 실패 시
 * @sideEffects
 *   - 블록 상태가 없으면 초기화 후 업데이트
 *   - loadDailyData 및 saveDailyData 호출
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
 *
 * @param {string} blockId - 블록 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<boolean>} 토글 후 잠금 상태
 * @throws {Error} 블록 상태가 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - 블록의 isLocked 상태 토글
 *   - loadDailyData 및 saveDailyData 호출
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
 *
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task[]>} 타임블록이 할당되지 않은 작업 배열
 * @throws 없음
 * @sideEffects
 *   - loadDailyData 호출
 */
export async function getInboxTasks(date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => !task.timeBlock);
}

/**
 * 완료된 작업 가져오기
 *
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task[]>} 완료된 작업 배열
 * @throws 없음
 * @sideEffects
 *   - loadDailyData 호출
 */
export async function getCompletedTasks(date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => task.completed);
}

/**
 * 특정 블록의 작업 가져오기
 *
 * @param {string} blockId - 블록 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task[]>} 해당 블록에 할당된 작업 배열
 * @throws 없음
 * @sideEffects
 *   - loadDailyData 호출
 */
export async function getBlockTasks(blockId: string, date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => task.timeBlock === blockId);
}

/**
 * 최근 N일의 데이터 가져오기
 *
 * @param {number} days - 조회할 일수
 * @returns {Promise<Array<DailyData & { date: string }>>} 날짜 포함 일일 데이터 배열
 * @throws 없음
 * @sideEffects
 *   - loadDailyData를 days 횟수만큼 호출
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
