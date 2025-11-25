/**
 * DailyData Repository - Core CRUD Operations
 * 
 * @role 일일 데이터(DailyData) 생성, 조회, 저장, 삭제
 */

import { db } from '../../db/dexieClient';
import type { DailyData, Task, TimeBlockStates } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { dailyDataStrategy } from '@/shared/services/sync/firebase/strategies';
import { normalizeTimeBlockStates } from './types';

// ============================================================================
// DailyData CRUD
// ============================================================================

/**
 * 빈 DailyData 생성
 *
 * @returns {DailyData} 모든 블록이 초기 상태로 설정된 빈 데이터
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
    hourSlotTags: {},
    updatedAt: Date.now(),
  };
}

/**
 * 특정 날짜의 DailyData 로드
 *
 * @param {string} [date] - 조회할 날짜 (기본값: 오늘)
 * @returns {Promise<DailyData>} 일일 데이터 객체 (없으면 빈 데이터)
 */
export async function loadDailyData(date: string = getLocalDate()): Promise<DailyData> {
  try {
    // 1. IndexedDB에서 먼저 조회
    const data = await db.dailyData.get(date);

    if (data) {
      const { states: normalizedStates, mutated } = normalizeTimeBlockStates(data);

      // 데이터 유효성 검사
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const timeBlockStates = normalizedStates || {};
      const goals = data.goals || [];
      const hourSlotTags = data.hourSlotTags || {};
      const timeBlockDontDoStatus = data.timeBlockDontDoStatus || {};

      if (mutated) {
        await db.dailyData.put({
          ...data,
          timeBlockStates,
        });
      }

      addSyncLog('dexie', 'load', `DailyData loaded for ${date}`, { taskCount: tasks.length });
      // IndexedDB에 데이터가 있으면 반환
      return {
        tasks,
        goals,
        timeBlockStates,
        hourSlotTags,
        timeBlockDontDoStatus,
        updatedAt: data.updatedAt,
      };
    }

    // 2. Firebase에서 조회 (IndexedDB 실패 시)
    if (isFirebaseInitialized()) {
      const firebaseData = await fetchFromFirebase<DailyData>(dailyDataStrategy, date);

      if (firebaseData) {
        // 데이터 유효성 검사
        const tasks = Array.isArray(firebaseData.tasks) ? firebaseData.tasks : [];
        const goals = Array.isArray(firebaseData.goals) ? firebaseData.goals : [];
        const { states: normalizedStates } = normalizeTimeBlockStates(firebaseData);
        const timeBlockStates = normalizedStates || {};
        const hourSlotTags = firebaseData.hourSlotTags || {};
        const timeBlockDontDoStatus = firebaseData.timeBlockDontDoStatus || {};

        const sanitizedData: DailyData = {
          tasks: tasks.map(task => ({
            ...task,
            timeBlock: task.timeBlock ?? null, // Firebase에서 null이 삭제되어 undefined로 올 경우 null로 복원
          })),
          goals,
          timeBlockStates,
          hourSlotTags,
          timeBlockDontDoStatus,
          updatedAt: firebaseData.updatedAt || Date.now(),
        };

        // Firebase 데이터를 IndexedDB에 저장
        await saveDailyData(date, sanitizedData.tasks, sanitizedData.timeBlockStates, hourSlotTags, timeBlockDontDoStatus);

        addSyncLog('firebase', 'load', `Loaded daily data for ${date} from Firebase`, { taskCount: tasks.length });
        return sanitizedData;
      }
    }

    // 4. 데이터가 없으면 초기 상태 반환
    addSyncLog('dexie', 'load', `No data found for ${date}, creating empty data`);

    // ✅ 오늘 날짜의 데이터가 처음 생성되는 경우라면, 목표 진행률 초기화
    if (date === getLocalDate()) {
      console.log('[DailyDataRepository] New day detected, resetting goal progress...');
      // 순환 참조 방지를 위해 동적 import 사용
      const { resetDailyGoalProgress } = await import('../globalGoalRepository');
      await resetDailyGoalProgress();
    }

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
 */
export async function saveDailyData(
  date: string = getLocalDate(),
  tasks: Task[],
  timeBlockStates: TimeBlockStates,
  hourSlotTags?: Record<number, string | null>,
  timeBlockDontDoStatus?: Record<string, Record<string, boolean>>
): Promise<void> {
  const updatedAt = Date.now();

  // 기존 goals 유지
  const existing = await db.dailyData.get(date);
  const goals = existing?.goals || [];
  const resolvedHourSlotTags = hourSlotTags ?? existing?.hourSlotTags ?? {};
  const resolvedDontDoStatus = timeBlockDontDoStatus ?? existing?.timeBlockDontDoStatus ?? {};

  // Firebase는 undefined를 허용하지 않으므로, 모든 undefined 값을 적절한 기본값으로 변환
  const sanitizedTasks = tasks.map(task => {
    // ✅ hourSlot이 undefined이고 timeBlock이 존재하면, 블록의 첫 시간대로 설정
    let hourSlot = task.hourSlot;
    if (hourSlot === undefined && task.timeBlock) {
      const block = TIME_BLOCKS.find(b => b.id === task.timeBlock);
      hourSlot = block ? block.start : undefined;
    }

    return {
      ...task,
      // 로컬 데이터 무결성을 위한 최소한의 보정
      hourSlot: hourSlot !== undefined && hourSlot !== null ? hourSlot : undefined,
    };
  });

  const data: DailyData = {
    tasks: sanitizedTasks,
    goals,
    timeBlockStates,
    hourSlotTags: resolvedHourSlotTags,
    timeBlockDontDoStatus: resolvedDontDoStatus,
    updatedAt,
  };

  try {
    // 1. IndexedDB에 저장
    await db.dailyData.put({
      date,
      ...data,
    });

    addSyncLog('dexie', 'save', `DailyData saved for ${date}`, {
      taskCount: sanitizedTasks.length,
      completedTasks: sanitizedTasks.filter(t => t.completed).length
    });


  } catch (error) {
    console.error(`Failed to save daily data for ${date}:`, error);
    addSyncLog('dexie', 'error', `Failed to save daily data for ${date}`, undefined, error as Error);
    throw error;
  }
}

/**
 * 특정 날짜의 DailyData 삭제
 *
 * @param {string} date - 삭제할 날짜
 */
export async function deleteDailyData(date: string): Promise<void> {
  try {
    await db.dailyData.delete(date);
  } catch (error) {
    console.error(`Failed to delete daily data for ${date}:`, error);
    throw error;
  }
}
