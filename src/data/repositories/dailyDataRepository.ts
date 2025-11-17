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
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/firebase/syncCore';
import { dailyDataStrategy } from '@/shared/services/firebase/strategies';
import {
  moveInboxTaskToBlock,
  moveTaskToInbox,
  deleteInboxTask,
  updateInboxTask,
  toggleInboxTaskCompletion,
} from './inboxRepository';

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
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원
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
      const goals = data.goals || [];

      addSyncLog('dexie', 'load', `DailyData loaded for ${date}`, { taskCount: tasks.length });
      // IndexedDB에 데이터가 있으면 반환
      return {
        tasks,
        goals,
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

    // 3. Firebase에서 조회
    if (isFirebaseInitialized()) {
      const firebaseData = await fetchFromFirebase<DailyData>(dailyDataStrategy, date);

      if (firebaseData) {
        // 데이터 유효성 검사
        const tasks = Array.isArray(firebaseData.tasks) ? firebaseData.tasks : [];
        const goals = Array.isArray(firebaseData.goals) ? firebaseData.goals : [];
        const timeBlockStates = firebaseData.timeBlockStates || {};

        const sanitizedData: DailyData = {
          tasks,
          goals,
          timeBlockStates,
          updatedAt: firebaseData.updatedAt || Date.now(),
        };

        // Firebase 데이터를 IndexedDB와 localStorage에 저장
        await saveDailyData(date, sanitizedData.tasks, sanitizedData.timeBlockStates);

        addSyncLog('firebase', 'load', `Loaded daily data for ${date} from Firebase`, { taskCount: tasks.length });
        return sanitizedData;
      }
    }

    // 4. 데이터가 없으면 초기 상태 반환
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

  // 기존 goals 유지
  const existing = await db.dailyData.get(date);
  const goals = existing?.goals || [];

  // Firebase는 undefined를 허용하지 않으므로, 모든 undefined 값을 적절한 기본값으로 변환
  const sanitizedTasks = tasks.map(task => {
    // ✅ hourSlot이 undefined이고 timeBlock이 존재하면, 블록의 첫 시간대로 설정
    let hourSlot = task.hourSlot;
    if (hourSlot === undefined && task.timeBlock) {
      const block = TIME_BLOCKS.find(b => b.id === task.timeBlock);
      hourSlot = block ? block.start : null;
    }

    return {
      ...task,
      preparation1: task.preparation1 ?? '',
      preparation2: task.preparation2 ?? '',
      preparation3: task.preparation3 ?? '',
      hourSlot: hourSlot !== undefined ? hourSlot : null,  // 최종 null fallback
    };
  });

  const data: DailyData = {
    tasks: sanitizedTasks,
    goals,
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
    goals: [],
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
 * Task 업데이트 (Global Inbox 지원)
 *
 * @param {string} taskId - 업데이트할 작업 ID
 * @param {Partial<Task>} updates - 업데이트할 필드
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - dailyData와 globalInbox 간 작업 이동 처리
 *   - timeBlock → null: dailyData에서 globalInbox로 이동
 *   - null → timeBlock: globalInbox에서 dailyData로 이동
 */
export async function updateTask(taskId: string, updates: Partial<Task>, date: string = getLocalDate()): Promise<void> {
  try {
    // 1. dailyData에서 찾기
    const dailyData = await loadDailyData(date);
    const taskIndex = dailyData.tasks.findIndex(t => t.id === taskId);

    if (taskIndex !== -1) {
      const task = dailyData.tasks[taskIndex];

      // timeBlock → inbox 이동 (타임블록에서 인박스로)
      if (updates.timeBlock === null && task.timeBlock !== null) {
        addSyncLog('dexie', 'save', `Moving task ${taskId} from timeblock to inbox`);

        // dailyData에서 제거
        dailyData.tasks.splice(taskIndex, 1);
        await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);

        // globalInbox로 이동 (updates 적용)
        const movedTask: Task = { ...task, ...updates };
        await moveTaskToInbox(movedTask);
        return;
      }

      // 일반 업데이트 (타임블록 내 이동 또는 속성 변경)
      dailyData.tasks[taskIndex] = {
        ...task,
        ...updates,
      };
      await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
      return;
    }

    // 2. globalInbox에서 찾기
    const inboxTask = await db.globalInbox.get(taskId);

    if (inboxTask) {
      // inbox → timeBlock 이동 (인박스에서 타임블록으로)
      if (updates.timeBlock !== null) {
        addSyncLog('dexie', 'save', `Moving task ${taskId} from inbox to timeblock`);

        // globalInbox에서 제거
        await moveInboxTaskToBlock(taskId);

        // dailyData에 추가 (updates 적용)
        const movedTask: Task = { ...inboxTask, ...updates };

        // ✅ hourSlot이 없으면 블록의 첫 시간대로 설정 (UI 표시 보장)
        if (!movedTask.hourSlot && movedTask.timeBlock) {
          const block = TIME_BLOCKS.find(b => b.id === movedTask.timeBlock);
          if (block) {
            movedTask.hourSlot = block.start;
          }
        }

        const todayData = await loadDailyData(date);
        todayData.tasks.push(movedTask);
        await saveDailyData(date, todayData.tasks, todayData.timeBlockStates);
        return;
      }

      // 인박스 내 업데이트
      await updateInboxTask(taskId, updates);
      return;
    }

    // 3. 어디에도 없으면 에러
    throw new Error(`Task not found: ${taskId}`);
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
}

/**
 * Task 삭제 (Global Inbox 지원)
 *
 * @param {string} taskId - 삭제할 작업 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 데이터 로드 또는 저장 실패 시
 * @sideEffects
 *   - dailyData와 globalInbox 모두 검색하여 삭제
 */
export async function deleteTask(taskId: string, date: string = getLocalDate()): Promise<void> {
  try {
    // 1. dailyData에서 삭제 시도
    const dailyData = await loadDailyData(date);
    const taskExists = dailyData.tasks.some(t => t.id === taskId);

    if (taskExists) {
      dailyData.tasks = dailyData.tasks.filter(t => t.id !== taskId);
      await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
      return;
    }

    // 2. globalInbox에서 삭제 시도
    const inboxTask = await db.globalInbox.get(taskId);

    if (inboxTask) {
      await deleteInboxTask(taskId);
      return;
    }

    // 3. 어디에도 없으면 에러
    throw new Error(`Task not found: ${taskId}`);
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

/**
 * Task 완료 토글 (Global Inbox 지원)
 *
 * @param {string} taskId - 토글할 작업 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task>} 토글된 작업 객체
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - dailyData와 globalInbox 모두 검색하여 토글
 *   - 작업의 completed 및 completedAt 필드 변경
 */
export async function toggleTaskCompletion(taskId: string, date: string = getLocalDate()): Promise<Task> {
  try {
    // 1. dailyData에서 토글 시도
    const dailyData = await loadDailyData(date);
    const task = dailyData.tasks.find(t => t.id === taskId);

    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;

      await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
      return task;
    }

    // 2. globalInbox에서 토글 시도
    const inboxTask = await db.globalInbox.get(taskId);

    if (inboxTask) {
      return await toggleInboxTaskCompletion(taskId);
    }

    // 3. 어디에도 없으면 에러
    throw new Error(`Task not found: ${taskId}`);
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
 * @throws {Error} 블록 상태가 존재하지 않거나, 빈 블록을 잠그려 할 때, 또는 저장 실패 시
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

    // 잠금하려는 경우: 블록에 작업이 있는지 검증
    if (!blockState.isLocked) {
      const blockTasks = dailyData.tasks.filter(task => task.timeBlock === blockId);

      if (blockTasks.length === 0) {
        throw new Error('빈 블록은 잠글 수 없습니다. 작업을 먼저 추가해주세요.');
      }
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
 * 인박스 작업 가져오기 (Global Inbox)
 *
 * @deprecated 이제 globalInbox 테이블을 사용합니다. loadInboxTasks()를 직접 사용하세요.
 * @param {string} [_date] - 날짜 (사용되지 않음)
 * @returns {Promise<Task[]>} 전역 인박스 작업 배열
 * @throws 없음
 * @sideEffects
 *   - loadInboxTasks 호출 (globalInbox 테이블)
 */
export async function getInboxTasks(_date: string = getLocalDate()): Promise<Task[]> {
  // Global inbox를 사용하므로 date 파라미터는 무시됨
  const { loadInboxTasks } = await import('./inboxRepository');
  return loadInboxTasks();
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

/**
 * 최근 N일의 완료된 작업 가져오기
 *
 * @param {number} [days=7] - 조회할 일수 (기본값: 7일)
 * @returns {Promise<Task[]>} 완료된 작업 배열 (최근 순으로 정렬)
 * @throws 없음
 * @sideEffects
 *   - getRecentDailyData 호출
 *   - Global Inbox에서 완료된 작업도 포함
 */
export async function getRecentCompletedTasks(days: number = 7): Promise<Task[]> {
  try {
    const recentData = await getRecentDailyData(days);
    const allCompletedTasks: Task[] = [];

    // 모든 날짜의 완료된 작업 수집 (dailyData에서)
    recentData.forEach(dayData => {
      const completedTasks = dayData.tasks.filter(task => task.completed);
      allCompletedTasks.push(...completedTasks);
    });

    // Global Inbox에서 완료된 작업도 포함
    try {
      const { loadInboxTasks } = await import('./inboxRepository');
      const inboxTasks = await loadInboxTasks();
      const completedInboxTasks = inboxTasks.filter(task => task.completed);

      // 최근 N일 이내에 완료된 인박스 작업만 포함
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentCompletedInboxTasks = completedInboxTasks.filter(task => {
        if (!task.completedAt) return false;
        return new Date(task.completedAt) >= cutoffDate;
      });

      allCompletedTasks.push(...recentCompletedInboxTasks);
    } catch (inboxError) {
      console.warn('Failed to load completed inbox tasks:', inboxError);
      // 인박스 로드 실패는 무시하고 dailyData 작업만 반환
    }

    // completedAt 기준으로 최근 순으로 정렬
    return allCompletedTasks.sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
  } catch (error) {
    console.error('Failed to get recent completed tasks:', error);
    return [];
  }
}

/**
 * 최근 N일의 미완료 인박스 작업 가져오기
 *
 * @deprecated Global Inbox 도입으로 더 이상 필요하지 않습니다. loadInboxTasks()를 사용하세요.
 * @param {number} [_days=7] - 조회할 일수 (기본값: 7일, 사용되지 않음)
 * @returns {Promise<Task[]>} 미완료 인박스 작업 배열 (최근 순으로 정렬)
 * @throws 없음
 * @sideEffects
 *   - 이제 globalInbox 테이블에서 직접 조회 (날짜 독립적)
 */
export async function getRecentUncompletedInboxTasks(_days: number = 7): Promise<Task[]> {
  try {
    // Global inbox를 사용하므로 날짜 범위 검색은 불필요
    const { loadInboxTasks } = await import('./inboxRepository');
    const allInboxTasks = await loadInboxTasks();

    // 미완료 작업만 필터링
    return allInboxTasks.filter(task => !task.completed);
  } catch (error) {
    console.error('Failed to get uncompleted inbox tasks:', error);
    return [];
  }
}
