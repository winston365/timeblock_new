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

import type { DailyGoal } from '@/shared/types/domain';
import { db } from '@/data/db/dexieClient';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/firebase/syncCore';
import { dailyGoalStrategy } from '@/shared/services/firebase/strategies';
import { generateId } from '@/shared/lib/utils';

/**
 * 일일 목표 로드 (날짜별)
 *
 * @description
 *   1. IndexedDB에서 로드
 *   2. localStorage 폴백
 *   3. Firebase 폴백
 *   4. 빈 배열 반환
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

    // 2. localStorage 폴백
    const cached = localStorage.getItem(`goals_${date}`);
    if (cached) {
      const goals = JSON.parse(cached);
      // IndexedDB에 저장
      if (dailyData) {
        await db.dailyData.update(date, { goals });
      } else {
        await db.dailyData.put({
          date,
          tasks: [],
          goals,
          timeBlockStates: {},
          updatedAt: Date.now(),
        });
      }
      return goals;
    }

    // 3. Firebase 폴백
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

    return [];
  } catch (error) {
    console.error('Failed to load daily goals:', error);
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

  // localStorage 백업
  localStorage.setItem(`goals_${date}`, JSON.stringify(updatedGoals));

  // Firebase 동기화
  await syncToFirebase(dailyGoalStrategy, updatedGoals, date);

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
  const index = goals.findIndex(g => g.id === goalId);

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

  // localStorage 백업
  localStorage.setItem(`goals_${date}`, JSON.stringify(updatedGoals));

  // Firebase 동기화
  await syncToFirebase(dailyGoalStrategy, updatedGoals, date);

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
  const updatedGoals = goals.filter(g => g.id !== goalId);

  // 연결된 할일들의 goalId를 null로 설정
  const dailyData = await db.dailyData.get(date);
  if (dailyData) {
    const updatedTasks = dailyData.tasks.map(t =>
      t.goalId === goalId ? { ...t, goalId: null } : t
    );

    await db.dailyData.update(date, {
      goals: updatedGoals,
      tasks: updatedTasks,
      updatedAt: Date.now(),
    });
  }

  // localStorage 백업
  localStorage.setItem(`goals_${date}`, JSON.stringify(updatedGoals));

  // Firebase 동기화
  await syncToFirebase(dailyGoalStrategy, updatedGoals, date);
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

  const linkedTasks = dailyData.tasks.filter(t => t.goalId === goalId);

  // 계획한 시간 = 모든 연결된 할일의 adjustedDuration 합계
  const plannedMinutes = linkedTasks.reduce((sum, t) => sum + t.adjustedDuration, 0);

  // 달성한 시간 = 완료된 할일의 actualDuration (없으면 adjustedDuration) 합계
  const completedMinutes = linkedTasks
    .filter(t => t.completed)
    .reduce((sum, t) => sum + (t.actualDuration || t.adjustedDuration), 0);

  return updateGoal(date, goalId, { plannedMinutes, completedMinutes });
}
