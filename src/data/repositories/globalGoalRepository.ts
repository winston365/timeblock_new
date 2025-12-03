/**
 * Global Goal Repository
 *
 * @role 전역 목표 관리 (날짜 독립적)
 * @input DailyGoal CRUD 연산
 * @output 전역 목표 목록, 추가/수정/삭제 함수
 * @dependencies
 *   - IndexedDB: globalGoals 테이블
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: DailyGoal 타입
 */

import { db } from '../db/dexieClient';
import type { DailyGoal } from '@/shared/types/domain';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { globalGoalStrategy } from '@/shared/services/sync/firebase/strategies';
import { generateId, getLocalDate } from '@/shared/lib/utils';

// ============================================================================
// Global Goal CRUD
// ============================================================================

/**
 * 전역 목표 목록 로드
 *
 * @returns {Promise<DailyGoal[]>} 목표 배열 (order 순으로 정렬)
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원 (초기 로드 시에만)
 */
export async function loadGlobalGoals(): Promise<DailyGoal[]> {
  try {
    // 1. IndexedDB에서 조회
    const loadedGoals = await db.globalGoals.orderBy('order').toArray();

    if (loadedGoals.length > 0) {
      addSyncLog('dexie', 'load', `Loaded ${loadedGoals.length} global goals`);
      return loadedGoals;
    }

    // 2. Firebase에서 조회 (초기 로드 또는 IndexedDB가 비어있을 때만)
    // 주의: 페이지 새로고침 시 일시적으로 IndexedDB가 비어 보일 수 있으므로
    // Firebase 데이터가 실제로 더 최신인지 확인하지 않고 복원할 경우 데이터 손실 가능
    if (isFirebaseInitialized()) {
      const firebaseGoals = await fetchFromFirebase<DailyGoal[]>(globalGoalStrategy);

      if (firebaseGoals && firebaseGoals.length > 0) {
        // IndexedDB가 완전히 비어있을 때만 Firebase 데이터로 복원
        // (Store가 메모리에 데이터를 유지하므로, 실제 데이터 손실 시에만 이 경로 실행됨)
        await db.globalGoals.bulkPut(firebaseGoals);
        addSyncLog('firebase', 'load', `Restored ${firebaseGoals.length} goals from Firebase`);
        return firebaseGoals;
      }
    }

    // 3. 데이터가 없으면 빈 배열 반환
    return [];
  } catch (error) {
    console.error('Failed to load global goals:', error);
    addSyncLog('dexie', 'error', 'Failed to load global goals', undefined, error as Error);
    return [];
  }
}

/**
 * 목표 추가
 *
 * @param {Omit<DailyGoal, 'id' | 'createdAt' | 'updatedAt' | 'plannedMinutes' | 'completedMinutes' | 'order'>} data - 목표 데이터
 * @returns {Promise<DailyGoal>} 생성된 목표
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 목표 저장
 *   - Firebase에 동기화
 */
export async function addGlobalGoal(
  data: Omit<DailyGoal, 'id' | 'createdAt' | 'updatedAt' | 'plannedMinutes' | 'completedMinutes' | 'order'>
): Promise<DailyGoal> {
  try {
    const goals = await loadGlobalGoals();

    const newGoal: DailyGoal = {
      ...data,
      id: generateId('goal'),
      plannedMinutes: 0,
      completedMinutes: 0,
      order: goals.length, // 마지막 순서
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // IndexedDB에 저장
    await db.globalGoals.put(newGoal);

    addSyncLog('dexie', 'save', `Added global goal: ${newGoal.title}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allGoals = await db.globalGoals.toArray();
      await syncToFirebase(globalGoalStrategy, allGoals);
    }

    return newGoal;
  } catch (error) {
    console.error('Failed to add global goal:', error);
    throw error;
  }
}

/**
 * 목표 업데이트
 *
 * @param {string} goalId - 업데이트할 목표 ID
 * @param {Partial<DailyGoal>} updates - 업데이트할 필드
 * @returns {Promise<DailyGoal>} 업데이트된 목표
 * @throws {Error} 목표가 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 목표 업데이트
 *   - Firebase에 동기화
 */
export async function updateGlobalGoal(goalId: string, updates: Partial<DailyGoal>): Promise<DailyGoal> {
  try {
    const goal = await db.globalGoals.get(goalId);

    if (!goal) {
      throw new Error(`Global goal not found: ${goalId}`);
    }

    // 업데이트 적용
    const updatedGoal: DailyGoal = {
      ...goal,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // IndexedDB에 저장
    await db.globalGoals.put(updatedGoal);

    addSyncLog('dexie', 'save', `Updated global goal: ${goal.title}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allGoals = await db.globalGoals.toArray();
      await syncToFirebase(globalGoalStrategy, allGoals);
    }

    return updatedGoal;
  } catch (error) {
    console.error('Failed to update global goal:', error);
    throw error;
  }
}

/**
 * 목표 삭제
 *
 * @param {string} goalId - 삭제할 목표 ID
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 목표 삭제
 *   - Firebase에 동기화
 *   - 연결된 작업들의 goalId를 null로 설정
 */
export async function deleteGlobalGoal(goalId: string): Promise<void> {
  try {
    await db.globalGoals.delete(goalId);

    addSyncLog('dexie', 'save', `Deleted global goal: ${goalId}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allGoals = await db.globalGoals.toArray();
      await syncToFirebase(globalGoalStrategy, allGoals);
    }

    // 모든 dailyData에서 연결된 작업들의 goalId를 null로 설정
    const allDailyData = await db.dailyData.toArray();
    for (const dayData of allDailyData) {
      const updatedTasks = dayData.tasks.map(task =>
        task.goalId === goalId ? { ...task, goalId: null } : task
      );

      if (updatedTasks.some((task, index) => task.goalId !== dayData.tasks[index].goalId)) {
        await db.dailyData.update(dayData.date, { tasks: updatedTasks });
      }
    }

    // globalInbox에서도 연결된 작업들의 goalId를 null로 설정
    const inboxTasks = await db.globalInbox.toArray();
    for (const task of inboxTasks) {
      if (task.goalId === goalId) {
        await db.globalInbox.update(task.id, { goalId: null });
      }
    }
  } catch (error) {
    console.error('Failed to delete global goal:', error);
    throw error;
  }
}

/**
 * 목표의 계획/달성 시간 재계산
 *
 * @description 할일 추가/수정/삭제/완료 시 호출
 *              ScheduleView에 있는 작업만 계산 (인박스 제외)
 * @param {string} goalId - 목표 ID
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<DailyGoal>} 재계산된 목표
 */
export async function recalculateGlobalGoalProgress(goalId: string, date: string): Promise<DailyGoal> {
  const today = getLocalDate();
  const existingGoal = await db.globalGoals.get(goalId);

  if (!existingGoal) {
    throw new Error(`Global goal not found: ${goalId}`);
  }

  // 목표 진행도는 "오늘" 작업만 기준으로 계산한다.
  if (date !== today) {
    return existingGoal;
  }

  const dailyData = await db.dailyData.get(today);

  // 오늘 데이터가 없으면 0으로 초기화
  if (!dailyData) {
    return updateGlobalGoal(goalId, { plannedMinutes: 0, completedMinutes: 0 });
  }

  // 해당 날짜의 연결된 작업들 (ScheduleView에 배치된 작업만 = timeBlock이 있는 작업만)
  const linkedTasks = dailyData.tasks.filter(task => 
    task.goalId === goalId && task.timeBlock !== null
  );

  // 계획한 시간 = 스케줄에 배치된 연결된 할일의 adjustedDuration 합계
  const plannedMinutes = linkedTasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 달성한 시간 = 완료된 할일의 actualDuration (없으면 adjustedDuration) 합계
  const completedMinutes = linkedTasks
    .filter(task => {
      if (!task.completed || !task.completedAt) return false;
      return getLocalDate(new Date(task.completedAt)) === today;
    })
    .reduce((sum, task) => sum + (task.actualDuration || task.adjustedDuration), 0);

  return updateGlobalGoal(goalId, { plannedMinutes, completedMinutes });
}

/**
 * 목표 순서 재정렬
 *
 * @param {DailyGoal[]} goals - 새로운 순서의 목표 배열
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 목표 순서 업데이트
 *   - Firebase에 동기화
 */
export async function reorderGlobalGoals(goals: DailyGoal[]): Promise<void> {
  try {
    // order 값 업데이트
    const updatedGoals = goals.map((goal, index) => ({
      ...goal,
      order: index,
      updatedAt: new Date().toISOString(),
    }));

    // IndexedDB에 일괄 저장
    await db.globalGoals.bulkPut(updatedGoals);

    addSyncLog('dexie', 'save', `Reordered ${updatedGoals.length} global goals`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      await syncToFirebase(globalGoalStrategy, updatedGoals);
    }
  } catch (error) {
    console.error('Failed to reorder global goals:', error);
    throw error;
  }
}

/**
 * 매일 목표 진행률 초기화
 *
 * @description 매일 자정에 호출되어 plannedMinutes와 completedMinutes를 0으로 초기화
 * @returns {Promise<void>}
 * @sideEffects
 *   - IndexedDB에서 모든 목표의 진행률 초기화
 *   - Firebase에 동기화
 */
export async function resetDailyGoalProgress(): Promise<void> {
  try {
    const goals = await loadGlobalGoals();

    const resetGoals = goals.map(goal => ({
      ...goal,
      plannedMinutes: 0,
      completedMinutes: 0,
      updatedAt: new Date().toISOString(),
    }));

    // IndexedDB에 일괄 저장
    await db.globalGoals.bulkPut(resetGoals);

    addSyncLog('dexie', 'save', `Reset progress for ${resetGoals.length} global goals`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      await syncToFirebase(globalGoalStrategy, resetGoals);
    }

    console.log(`✅ Reset progress for ${resetGoals.length} global goals`);
  } catch (error) {
    console.error('Failed to reset daily goal progress:', error);
    throw error;
  }
}
