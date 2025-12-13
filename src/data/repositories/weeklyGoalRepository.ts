/**
 * Weekly Goal Repository
 *
 * @role 장기목표(주간목표) 관리
 * @input WeeklyGoal CRUD 연산
 * @output 주간목표 목록, 추가/수정/삭제/진행도 업데이트 함수
 * @dependencies
 *   - IndexedDB: weeklyGoals 테이블
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: WeeklyGoal 타입
 */

import { db } from '../db/dexieClient';
import type { WeeklyGoal, WeeklyGoalHistory } from '@/shared/types/domain';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { withFirebaseSync, withFirebaseFetch } from '@/shared/utils/firebaseGuard';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { weeklyGoalStrategy } from '@/shared/services/sync/firebase/strategies';
import { generateId } from '@/shared/lib/utils';

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 현재 주의 월요일 날짜를 가져옴 (YYYY-MM-DD)
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일요일, 1=월요일, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 조정
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return formatLocalYyyyMmDd(d);
}

/**
 * 로컬 기준 날짜 문자열 (YYYY-MM-DD)
 */
function formatLocalYyyyMmDd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeDayIndex(dayIndex: number): number {
  if (!Number.isFinite(dayIndex)) return 0;
  return Math.min(6, Math.max(0, Math.floor(dayIndex)));
}

/**
 * 오늘이 주의 몇 번째 날인지 (월요일=0, 일요일=6)
 */
export function getDayOfWeekIndex(date: Date = new Date()): number {
  const day = date.getDay(); // 0=일요일, 1=월요일
  return day === 0 ? 6 : day - 1; // 월요일=0으로 변환
}

/**
 * 오늘까지 해야 하는 목표량 계산 (진행 일수 기준)
 */
export function getTodayTarget(target: number, dayIndex: number = getDayOfWeekIndex()): number {
  if (target <= 0) return 0;
  // dayIndex: 0=월요일, 1=화요일, ..., 6=일요일
  // 예: 화요일(1)이면 2/7 만큼 해야함
  const normalizedDayIndex = normalizeDayIndex(dayIndex);
  const completedDays = normalizedDayIndex + 1;
  return Math.ceil((target / 7) * completedDays);
}

/**
 * 남은 일수 계산 (오늘 포함)
 */
export function getRemainingDays(dayIndex: number = getDayOfWeekIndex()): number {
  const normalizedDayIndex = normalizeDayIndex(dayIndex);
  return 7 - normalizedDayIndex;
}

/**
 * 오늘의 목표량 계산 (남은량 / 남은일수)
 */
export function getDailyTargetForToday(target: number, currentProgress: number, dayIndex: number = getDayOfWeekIndex()): number {
  if (target <= 0) return 0;
  const remaining = Math.max(0, target - currentProgress);
  if (remaining === 0) return 0;
  const normalizedDayIndex = normalizeDayIndex(dayIndex);
  const remainingDays = getRemainingDays(normalizedDayIndex);
  if (remainingDays <= 0) return remaining;
  return Math.ceil(remaining / remainingDays);
}

function normalizeWeeklyGoal(goal: WeeklyGoal, fallbackOrder: number, currentWeekStart: string): WeeklyGoal {
  const safeHistory = Array.isArray(goal.history) ? goal.history : [];

  return {
    ...goal,
    title: typeof goal.title === 'string' ? goal.title : '',
    unit: typeof goal.unit === 'string' ? goal.unit : '',
    target: typeof goal.target === 'number' && Number.isFinite(goal.target) ? goal.target : 0,
    currentProgress:
      typeof goal.currentProgress === 'number' && Number.isFinite(goal.currentProgress)
        ? goal.currentProgress
        : 0,
    order: typeof goal.order === 'number' && Number.isFinite(goal.order) ? goal.order : fallbackOrder,
    weekStartDate: typeof goal.weekStartDate === 'string' && goal.weekStartDate ? goal.weekStartDate : currentWeekStart,
    history: safeHistory,
  };
}

// ============================================================================
// Weekly Goal CRUD
// ============================================================================

/**
 * 주간목표 목록 로드 (주간 초기화 확인 포함)
 *
 * @returns {Promise<WeeklyGoal[]>} 목표 배열 (order 순으로 정렬)
 */
export async function loadWeeklyGoals(): Promise<WeeklyGoal[]> {
  try {
    // 1. IndexedDB에서 조회
    let loadedGoals = await db.weeklyGoals.orderBy('order').toArray();

    if (loadedGoals.length === 0) {
      // 2. Firebase에서 조회 (IndexedDB가 비어있을 때만)
      const firebaseGoals = await withFirebaseFetch(
        () => fetchFromFirebase<WeeklyGoal[]>(weeklyGoalStrategy),
        null
      );

      if (firebaseGoals && firebaseGoals.length > 0) {
        await db.weeklyGoals.bulkPut(firebaseGoals);
        addSyncLog('firebase', 'load', `Restored ${firebaseGoals.length} weekly goals from Firebase`);
        loadedGoals = firebaseGoals;
      }
    }

    // 3. 데이터 정규화 + 주간 초기화 체크 및 수행
    const currentWeekStart = getWeekStartDate();
    loadedGoals = loadedGoals.map((g, index) => normalizeWeeklyGoal(g, index, currentWeekStart));
    const goalsNeedingReset = loadedGoals.filter(g => g.weekStartDate !== currentWeekStart);

    if (goalsNeedingReset.length > 0) {
      loadedGoals = await resetWeeklyGoals(loadedGoals, currentWeekStart);
    }

    addSyncLog('dexie', 'load', `Loaded ${loadedGoals.length} weekly goals`);
    return loadedGoals;
  } catch (error) {
    console.error('Failed to load weekly goals:', error);
    addSyncLog('dexie', 'error', 'Failed to load weekly goals', undefined, error as Error);
    return [];
  }
}

/**
 * 새 주 시작 시 목표들 초기화
 */
async function resetWeeklyGoals(goals: WeeklyGoal[], newWeekStart: string): Promise<WeeklyGoal[]> {

  const resetGoals = goals.map(goal => {
    // 기존 주간 기록을 히스토리에 저장
    const history: WeeklyGoalHistory = {
      weekStartDate: goal.weekStartDate,
      target: goal.target,
      finalProgress: goal.currentProgress,
      completed: goal.currentProgress >= goal.target,
      dailyProgress: [], // 일별 진행 기록은 별도 관리 필요 시 추가
    };

    return {
      ...goal,
      currentProgress: 0,
      weekStartDate: newWeekStart,
      history: [...(goal.history || []).slice(-4), history], // 최근 5주 기록만 유지
      updatedAt: new Date().toISOString(),
    };
  });

  // IndexedDB에 저장
  await db.weeklyGoals.bulkPut(resetGoals);
  addSyncLog('dexie', 'save', `Reset ${resetGoals.length} weekly goals for new week: ${newWeekStart}`);

  // Firebase 동기화
  withFirebaseSync(async () => {
    await syncToFirebase(weeklyGoalStrategy, resetGoals);
  }, 'WeeklyGoal:weeklyReset');

  console.log(`✅ Weekly goals reset for new week starting ${newWeekStart}`);
  return resetGoals;
}

/**
 * 주간목표 추가
 */
export async function addWeeklyGoal(
  data: Omit<WeeklyGoal, 'id' | 'createdAt' | 'updatedAt' | 'currentProgress' | 'weekStartDate' | 'history' | 'order'>
): Promise<WeeklyGoal> {
  try {
    const goals = await loadWeeklyGoals();
    const currentWeekStart = getWeekStartDate();

    const newGoal: WeeklyGoal = {
      ...data,
      id: generateId('wgoal'),
      currentProgress: 0,
      weekStartDate: currentWeekStart,
      history: [],
      order: goals.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.weeklyGoals.put(newGoal);
    addSyncLog('dexie', 'save', `Added weekly goal: ${newGoal.title}`);

    // Firebase 동기화
    withFirebaseSync(async () => {
      const allGoals = await db.weeklyGoals.toArray();
      await syncToFirebase(weeklyGoalStrategy, allGoals);
    }, 'WeeklyGoal:add');

    return newGoal;
  } catch (error) {
    console.error('Failed to add weekly goal:', error);
    throw error;
  }
}

/**
 * 주간목표 업데이트
 */
export async function updateWeeklyGoal(goalId: string, updates: Partial<WeeklyGoal>): Promise<WeeklyGoal> {
  try {
    const goal = await db.weeklyGoals.get(goalId);

    if (!goal) {
      throw new Error(`Weekly goal not found: ${goalId}`);
    }

    const updatedGoal: WeeklyGoal = {
      ...goal,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.weeklyGoals.put(updatedGoal);
    addSyncLog('dexie', 'save', `Updated weekly goal: ${goal.title}`);

    // Firebase 동기화
    withFirebaseSync(async () => {
      const allGoals = await db.weeklyGoals.toArray();
      await syncToFirebase(weeklyGoalStrategy, allGoals);
    }, 'WeeklyGoal:update');

    return updatedGoal;
  } catch (error) {
    console.error('Failed to update weekly goal:', error);
    throw error;
  }
}

/**
 * 주간목표 삭제
 */
export async function deleteWeeklyGoal(goalId: string): Promise<void> {
  try {
    await db.weeklyGoals.delete(goalId);
    addSyncLog('dexie', 'save', `Deleted weekly goal: ${goalId}`);

    // Firebase 동기화
    withFirebaseSync(async () => {
      const allGoals = await db.weeklyGoals.toArray();
      await syncToFirebase(weeklyGoalStrategy, allGoals);
    }, 'WeeklyGoal:delete');
  } catch (error) {
    console.error('Failed to delete weekly goal:', error);
    throw error;
  }
}

/**
 * 진행도 업데이트 (증감)
 */
export async function updateWeeklyGoalProgress(
  goalId: string,
  delta: number
): Promise<WeeklyGoal> {
  try {
    const goal = await db.weeklyGoals.get(goalId);

    if (!goal) {
      throw new Error(`Weekly goal not found: ${goalId}`);
    }

    const newProgress = Math.max(0, goal.currentProgress + delta);

    return updateWeeklyGoal(goalId, { currentProgress: newProgress });
  } catch (error) {
    console.error('Failed to update weekly goal progress:', error);
    throw error;
  }
}

/**
 * 진행도 직접 설정
 */
export async function setWeeklyGoalProgress(
  goalId: string,
  progress: number
): Promise<WeeklyGoal> {
  return updateWeeklyGoal(goalId, { currentProgress: Math.max(0, progress) });
}

/**
 * 목표 순서 재정렬
 */
export async function reorderWeeklyGoals(goals: WeeklyGoal[]): Promise<void> {
  try {
    const updatedGoals = goals.map((goal, index) => ({
      ...goal,
      order: index,
      updatedAt: new Date().toISOString(),
    }));

    await db.weeklyGoals.bulkPut(updatedGoals);
    addSyncLog('dexie', 'save', `Reordered ${updatedGoals.length} weekly goals`);

    // Firebase 동기화
    withFirebaseSync(
      () => syncToFirebase(weeklyGoalStrategy, updatedGoals),
      'WeeklyGoal:reorder'
    );
  } catch (error) {
    console.error('Failed to reorder weekly goals:', error);
    throw error;
  }
}
