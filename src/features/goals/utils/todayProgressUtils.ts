/**
 * todayProgressUtils.ts
 *
 * @file 오늘 진행량 계산 유틸리티
 * @description
 *   - 각 목표별 "오늘 몇 단위 했는지" 계산
 *   - 하루 시작 시점의 진행량을 기록하고, 현재 진행량과 비교
 */

import { getSystemState, setSystemState } from '@/data/repositories/systemRepository';
import { formatLocalYyyyMmDd } from './weekUtils';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 목표별 오늘 시작 시점 진행량 기록
 */
export interface TodayProgressSnapshot {
  /** 기록 날짜 (YYYY-MM-DD) */
  date: string;
  /** 목표 ID → 시작 시점 진행량 */
  snapshots: Record<string, number>;
}

// systemState 키 (defaults.ts에 추가 필요하면 별도 처리)
const SYSTEM_KEY_TODAY_PROGRESS = 'goalsTodayProgressSnapshot';

// ============================================================================
// 오늘 진행량 스냅샷 관리
// ============================================================================

/**
 * 오늘 시작 시점 진행량 스냅샷 조회
 */
export async function getTodayProgressSnapshot(): Promise<TodayProgressSnapshot | null> {
  try {
    const snapshot = await getSystemState<TodayProgressSnapshot>(SYSTEM_KEY_TODAY_PROGRESS);
    return snapshot ?? null;
  } catch (error) {
    console.error('[todayProgressUtils] Failed to get snapshot:', error);
    return null;
  }
}

/**
 * 오늘 시작 시점 진행량 스냅샷 저장
 */
export async function setTodayProgressSnapshot(snapshot: TodayProgressSnapshot | null): Promise<void> {
  try {
    await setSystemState(SYSTEM_KEY_TODAY_PROGRESS, snapshot);
  } catch (error) {
    console.error('[todayProgressUtils] Failed to set snapshot:', error);
  }
}

/**
 * 특정 목표의 오늘 시작 시점 진행량 가져오기
 * @param goalId - 목표 ID
 * @param currentProgress - 현재 진행량 (스냅샷 없으면 이 값을 시작점으로 기록)
 * @returns 오늘 시작 시점 진행량
 */
export async function getGoalTodayStartProgress(
  goalId: string,
  currentProgress: number
): Promise<number> {
  const today = formatLocalYyyyMmDd(new Date());
  const snapshot = await getTodayProgressSnapshot();

  // 스냅샷이 없거나 날짜가 다르면 새로 생성
  if (!snapshot || snapshot.date !== today) {
    const newSnapshot: TodayProgressSnapshot = {
      date: today,
      snapshots: { [goalId]: currentProgress },
    };
    await setTodayProgressSnapshot(newSnapshot);
    return currentProgress;
  }

  // 해당 목표의 스냅샷이 없으면 현재 값을 기록
  if (snapshot.snapshots[goalId] === undefined) {
    snapshot.snapshots[goalId] = currentProgress;
    await setTodayProgressSnapshot(snapshot);
    return currentProgress;
  }

  return snapshot.snapshots[goalId];
}

/**
 * 모든 목표의 오늘 시작 시점 진행량 초기화/업데이트
 * @param goals - 목표 배열 (id, currentProgress 필요)
 */
export async function initializeTodayProgressSnapshots(
  goals: Array<{ id: string; currentProgress: number }>
): Promise<void> {
  const today = formatLocalYyyyMmDd(new Date());
  const snapshot = await getTodayProgressSnapshot();

  // 오늘 날짜의 스냅샷이 이미 있으면 새 목표만 추가
  if (snapshot && snapshot.date === today) {
    let updated = false;
    for (const goal of goals) {
      if (snapshot.snapshots[goal.id] === undefined) {
        snapshot.snapshots[goal.id] = goal.currentProgress;
        updated = true;
      }
    }
    if (updated) {
      await setTodayProgressSnapshot(snapshot);
    }
    return;
  }

  // 새 날짜: 모든 목표의 현재 진행량을 스냅샷으로 저장
  const newSnapshot: TodayProgressSnapshot = {
    date: today,
    snapshots: Object.fromEntries(goals.map((g) => [g.id, g.currentProgress])),
  };
  await setTodayProgressSnapshot(newSnapshot);
}

/**
 * 오늘 진행량 계산 (현재 - 시작 시점)
 * @param goalId - 목표 ID
 * @param currentProgress - 현재 진행량
 * @returns 오늘 진행량 (음수일 수 있음)
 */
export async function calculateTodayProgress(
  goalId: string,
  currentProgress: number
): Promise<number> {
  const startProgress = await getGoalTodayStartProgress(goalId, currentProgress);
  return currentProgress - startProgress;
}

/**
 * 동기 버전: 스냅샷이 이미 로드된 상태에서 오늘 진행량 계산
 * @param snapshot - 미리 로드된 스냅샷
 * @param goalId - 목표 ID
 * @param currentProgress - 현재 진행량
 * @returns 오늘 진행량 (스냅샷 없으면 0)
 */
export function calculateTodayProgressSync(
  snapshot: TodayProgressSnapshot | null,
  goalId: string,
  currentProgress: number
): number {
  const today = formatLocalYyyyMmDd(new Date());

  // 스냅샷이 없거나 오늘 날짜가 아니면 0
  if (!snapshot || snapshot.date !== today) {
    return 0;
  }

  const startProgress = snapshot.snapshots[goalId];
  if (startProgress === undefined) {
    return 0;
  }

  return currentProgress - startProgress;
}
