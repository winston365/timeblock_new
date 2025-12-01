/**
 * Daily Goal Repository
 *
 * @role 일일 목표 데이터 관리 (CRUD, Firebase 동기화, 시간 재계산)
 * @input DailyGoal 도메인 객체
 * @output 로컬 IndexedDB + Firebase 동기화된 목표 데이터
 * @external_dependencies
 *   - dexieClient: IndexedDB 접근
 *   - syncCore: Firebase 동기화
 *   - dailyGoalStrategy: 동기화 전략
 */

import type { DailyGoal, DailyData } from '@/shared/types/domain';
import { db } from '@/data/db/dexieClient';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { dailyGoalStrategy, dailyDataStrategy } from '@/shared/services/sync/firebase/strategies';
import { generateId } from '@/shared/lib/utils';

/**
 * 일일 목표 로드 (날짜별)
 *
 * @description
 *   1. IndexedDB에서 로드
 *   2. localStorage 폴백
 *   3. Firebase 폴백
 *   4. 이전 날짜의 목표 복사 (진행률은 0으로 초기화)
 *   5. 빈 배열 반환
 *
 * @param date - 날짜 (YYYY-MM-DD)
 * @returns 목표 배열
 */
export async function loadDailyGoals(date: string): Promise<DailyGoal[]> {
  try {
    // 1. IndexedDB에서 로드
    const dailyData = await db.dailyData.get(date);
    if (dailyData?.goals && dailyData.goals.length > 0) {
      return dailyData.goals;
    }

    // 2. Firebase 폴백
    const firebaseGoals = await fetchFromFirebase<DailyGoal[]>(dailyGoalStrategy, date);
    if (firebaseGoals && firebaseGoals.length > 0) {
      // IndexedDB에 저장
      if (dailyData) {
        await db.dailyData.update(date, { goals: firebaseGoals });
      } else {
        await db.dailyData.put({
          date,
          tasks: [],
          goals: firebaseGoals,
          timeBlockStates: {},
          updatedAt: Date.now(),
        });
      }
      return firebaseGoals;
    }

    // 4. 이전 날짜의 목표 복사 (진행률 초기화)
    const previousGoals = await copyGoalsFromPreviousDay(date);
    if (previousGoals.length > 0) {
      return previousGoals;
    }

    return [];
  } catch (error) {
    console.error('Failed to load daily goals:', error);
    return [];
  }
}

/**
 * 이전 날짜의 목표를 복사 (진행률 초기화)
 *
 * @description
 *   - 최근 7일 이내의 목표를 찾아서 복사
 *   - plannedMinutes와 completedMinutes는 0으로 초기화
 *   - title, targetMinutes, color, icon은 유지
 *
 * @param date - 목표를 복사할 대상 날짜
 * @returns 복사된 목표 배열
 */
async function copyGoalsFromPreviousDay(date: string): Promise<DailyGoal[]> {
  try {
    const targetDate = new Date(date);

    // 최근 7일 이내에서 목표가 있는 날짜 찾기
    for (let i = 1; i <= 7; i++) {
      const previousDate = new Date(targetDate);
      previousDate.setDate(previousDate.getDate() - i);
      const previousDateStr = previousDate.toISOString().split('T')[0];

      const previousDailyData = await db.dailyData.get(previousDateStr);
      if (previousDailyData?.goals && previousDailyData.goals.length > 0) {
        // 목표 복사 (진행률만 0으로 초기화)
        const copiedGoals: DailyGoal[] = previousDailyData.goals.map(goal => ({
          ...goal,
          id: generateId('goal'), // 새로운 ID 생성
          plannedMinutes: 0,
          completedMinutes: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        // 새 날짜에 저장
        const existingDailyData = await db.dailyData.get(date);
        if (existingDailyData) {
          await db.dailyData.update(date, {
            goals: copiedGoals,
            updatedAt: Date.now()
          });
        } else {
          await db.dailyData.put({
            date,
            tasks: [],
            goals: copiedGoals,
            timeBlockStates: {},
            updatedAt: Date.now(),
          });
        }

        // Firebase에 동기화
        const dataToSync: DailyData = {
          tasks: existingDailyData?.tasks || [],
          goals: copiedGoals,
          timeBlockStates: existingDailyData?.timeBlockStates || {},
          updatedAt: Date.now(),
        };
        await syncToFirebase(dailyDataStrategy, dataToSync, date);

        return copiedGoals;
      }
    }

    return [];
  } catch (error) {
    console.error('Failed to copy goals from previous day:', error);
    return [];
  }
}

/**
 * 목표 생성
 *
 * @param date - 날짜 (YYYY-MM-DD)
 * @param data - 목표 데이터 (title, targetMinutes, color, icon)
 * @returns 생성된 목표
 */
export async function createGoal(
  date: string,
  data: Omit<DailyGoal, 'id' | 'createdAt' | 'updatedAt' | 'plannedMinutes' | 'completedMinutes' | 'order'>
): Promise<DailyGoal> {
  const goals = await loadDailyGoals(date);

  const newGoal: DailyGoal = {
    ...data,
    id: generateId('goal'),
    plannedMinutes: 0,
    completedMinutes: 0,
    order: goals.length, // 마지막 순서
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedGoals = [...goals, newGoal];

  // IndexedDB 저장
  const dailyData = await db.dailyData.get(date);
  if (dailyData) {
    await db.dailyData.update(date, { goals: updatedGoals, updatedAt: Date.now() });
  } else {
    await db.dailyData.put({
      date,
      tasks: [],
      goals: updatedGoals,
      timeBlockStates: {},
      updatedAt: Date.now(),
    });
  }

  // Firebase 동기화 (전체 DailyData를 동기화하여 일관성 보장)
  const latestData = await db.dailyData.get(date);
  if (latestData) {
    const dataToSync: DailyData = {
      tasks: latestData.tasks,
      goals: updatedGoals,
      timeBlockStates: latestData.timeBlockStates,
      updatedAt: Date.now(),
    };
    await syncToFirebase(dailyDataStrategy, dataToSync, date);
  }

  return newGoal;
}

/**
 * 목표 수정
 *
 * @param date - 날짜 (YYYY-MM-DD)
 * @param goalId - 목표 ID
 * @param updates - 수정할 필드
 * @returns 수정된 목표
 */
export async function updateGoal(
  date: string,
  goalId: string,
  updates: Partial<DailyGoal>
): Promise<DailyGoal> {
  const goals = await loadDailyGoals(date);
  const index = goals.findIndex(goal => goal.id === goalId);

  if (index === -1) {
    throw new Error(`Goal not found: ${goalId}`);
  }

  const updatedGoal = {
    ...goals[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const updatedGoals = [...goals];
  updatedGoals[index] = updatedGoal;

  // IndexedDB 저장
  await db.dailyData.update(date, { goals: updatedGoals, updatedAt: Date.now() });

  // Firebase 동기화 (전체 DailyData를 동기화하여 일관성 보장)
  const latestData = await db.dailyData.get(date);
  if (latestData) {
    const dataToSync: DailyData = {
      tasks: latestData.tasks,
      goals: updatedGoals,
      timeBlockStates: latestData.timeBlockStates,
      updatedAt: Date.now(),
    };
    await syncToFirebase(dailyDataStrategy, dataToSync, date);
  }

  return updatedGoal;
}

/**
 * 목표 삭제
 *
 * @param date - 날짜 (YYYY-MM-DD)
 * @param goalId - 목표 ID
 */
export async function deleteGoal(date: string, goalId: string): Promise<void> {
  const goals = await loadDailyGoals(date);
  const updatedGoals = goals.filter(goal => goal.id !== goalId);

  // 연결된 할일들의 goalId를 null로 설정
  const dailyData = await db.dailyData.get(date);
  if (dailyData) {
    const updatedTasks = dailyData.tasks.map(task =>
      task.goalId === goalId ? { ...task, goalId: null } : task
    );

    await db.dailyData.update(date, {
      goals: updatedGoals,
      tasks: updatedTasks,
      updatedAt: Date.now(),
    });
  }

  // Firebase 동기화 (전체 DailyData를 동기화하여 일관성 보장)
  const latestData = await db.dailyData.get(date);
  if (latestData) {
    const dataToSync: DailyData = {
      tasks: latestData.tasks,
      goals: updatedGoals,
      timeBlockStates: latestData.timeBlockStates,
      updatedAt: Date.now(),
    };
    await syncToFirebase(dailyDataStrategy, dataToSync, date);
  }
}

/**
 * 목표의 계획/달성 시간 재계산
 *
 * @description 할일 추가/수정/삭제/완료 시 호출
 * @param date - 날짜 (YYYY-MM-DD)
 * @param goalId - 목표 ID
 * @returns 재계산된 목표
 */
export async function recalculateGoalProgress(date: string, goalId: string): Promise<DailyGoal> {
  const dailyData = await db.dailyData.get(date);
  if (!dailyData) {
    throw new Error(`DailyData not found for date: ${date}`);
  }

  const linkedTasks = dailyData.tasks.filter(task => task.goalId === goalId);

  // 계획한 시간 = 모든 연결된 할일의 adjustedDuration 합계
  const plannedMinutes = linkedTasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

  // 달성한 시간 = 완료된 할일의 actualDuration (없으면 adjustedDuration) 합계
  const completedMinutes = linkedTasks
    .filter(task => task.completed)
    .reduce((sum, task) => sum + (task.actualDuration || task.adjustedDuration), 0);

  return updateGoal(date, goalId, { plannedMinutes, completedMinutes });
}
