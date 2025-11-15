/**
 * Conflict Resolver - Pure Logic
 *
 * @role Firebase 동기화 시 발생하는 데이터 충돌을 해결하는 순수 함수들을 제공합니다.
 *       Last-Write-Wins 및 Delta-based Merge 전략을 구현합니다.
 * @input SyncData<T> (로컬 및 원격 데이터, 타임스탬프, 디바이스 ID 포함)
 * @output SyncData<T> (충돌 해결된 데이터)
 * @external_dependencies
 *   - 없음: 순수 함수만 포함, 외부 의존성 없음
 */

import type { GameState } from '@/shared/types/domain';

// ============================================================================
// Types
// ============================================================================

export interface SyncData<T> {
  data: T;
  updatedAt: number;
  deviceId: string;
}

// ============================================================================
// Pure Functions - 충돌 해결 알고리즘
// ============================================================================

/**
 * Last-Write-Wins (LWW) 충돌 해결 알고리즘을 적용합니다.
 * 타임스탬프가 더 큰 데이터를 선택합니다.
 *
 * @param {SyncData<T>} local - 로컬 동기화 데이터
 * @param {SyncData<T>} remote - 원격 동기화 데이터
 * @returns {SyncData<T>} 더 최신 데이터 (타임스탬프 기준)
 * @throws 없음
 * @sideEffects
 *   - 콘솔에 충돌 해결 로그 출력
 */
export function resolveConflictLWW<T>(
  local: SyncData<T>,
  remote: SyncData<T>
): SyncData<T> {

  if (local.updatedAt >= remote.updatedAt) {
    return local;
  } else {
    return remote;
  }
}

/**
 * GameState Delta-based Merge 알고리즘을 적용합니다.
 * XP, Quest 등 누적 필드는 최대값 사용, 히스토리는 병합합니다.
 *
 * @param {SyncData<GameState>} local - 로컬 게임 상태 데이터
 * @param {SyncData<GameState>} remote - 원격 게임 상태 데이터
 * @returns {SyncData<GameState>} 병합된 게임 상태 (누적 필드는 최대값, 히스토리는 병합)
 * @throws 없음
 * @sideEffects
 *   - 콘솔에 병합 로그 출력
 */
export function mergeGameState(
  local: SyncData<GameState>,
  remote: SyncData<GameState>
): SyncData<GameState> {

  // 누적 필드: 최대값 사용
  const mergedTotalXP = Math.max(local.data.totalXP, remote.data.totalXP);
  const mergedDailyXP = Math.max(local.data.dailyXP, remote.data.dailyXP);
  const mergedAvailableXP = Math.max(local.data.availableXP, remote.data.availableXP);
  const mergedLevel = Math.max(local.data.level, remote.data.level);

  // dailyQuests 병합: 각 퀘스트별로 progress 최대값 사용
  const localQuests = Array.isArray(local.data.dailyQuests) ? local.data.dailyQuests : [];
  const remoteQuests = Array.isArray(remote.data.dailyQuests) ? remote.data.dailyQuests : [];

  const mergedQuests = [...localQuests];
  for (const remoteQuest of remoteQuests) {
    const localQuestIndex = mergedQuests.findIndex(q => q.id === remoteQuest.id);
    if (localQuestIndex >= 0) {
      mergedQuests[localQuestIndex] = {
        ...mergedQuests[localQuestIndex],
        progress: Math.max(mergedQuests[localQuestIndex].progress, remoteQuest.progress),
        completed: mergedQuests[localQuestIndex].completed || remoteQuest.completed,
      };
    } else {
      mergedQuests.push(remoteQuest);
    }
  }

  // xpHistory 병합: 날짜별 최대값
  const mergedXPHistory = mergeXPHistory(local.data.xpHistory || [], remote.data.xpHistory || []);

  // timeBlockXPHistory 병합
  const mergedTimeBlockXPHistory = mergeTimeBlockXPHistory(
    local.data.timeBlockXPHistory || [],
    remote.data.timeBlockXPHistory || []
  );

  // completedTasksHistory 병합
  const mergedCompletedTasksHistory = mergeCompletedTasksHistory(
    local.data.completedTasksHistory || [],
    remote.data.completedTasksHistory || []
  );


  // 더 최신 타임스탬프 사용
  const useLocal = local.updatedAt >= remote.updatedAt;
  const baseData = useLocal ? local.data : remote.data;

  return {
    data: {
      ...baseData,
      level: mergedLevel,
      totalXP: mergedTotalXP,
      dailyXP: mergedDailyXP,
      availableXP: mergedAvailableXP,
      dailyQuests: mergedQuests,
      xpHistory: mergedXPHistory,
      timeBlockXPHistory: mergedTimeBlockXPHistory,
      completedTasksHistory: mergedCompletedTasksHistory,
    },
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    deviceId: useLocal ? local.deviceId : remote.deviceId,
  };
}

// ============================================================================
// Helper Functions - Pure
// ============================================================================

function mergeXPHistory(
  local: Array<{ date: string; xp: number }>,
  remote: Array<{ date: string; xp: number }>
): Array<{ date: string; xp: number }> {
  const merged = new Map<string, number>();

  // 날짜별 최대 XP 사용
  [...local, ...remote].forEach(item => {
    const existing = merged.get(item.date) || 0;
    merged.set(item.date, Math.max(existing, item.xp));
  });

  return Array.from(merged.entries())
    .map(([date, xp]) => ({ date, xp }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7); // 최근 7일만 유지
}

function mergeTimeBlockXPHistory(
  local: Array<{ date: string; blocks: Record<string, number> }>,
  remote: Array<{ date: string; blocks: Record<string, number> }>
): Array<{ date: string; blocks: Record<string, number> }> {
  const merged = new Map<string, Record<string, number>>();

  // 날짜별 블록 XP 병합
  [...local, ...remote].forEach(item => {
    const existing = merged.get(item.date) || {};
    const mergedBlocks = { ...existing };

    Object.entries(item.blocks).forEach(([blockId, xp]) => {
      mergedBlocks[blockId] = Math.max(mergedBlocks[blockId] || 0, xp);
    });

    merged.set(item.date, mergedBlocks);
  });

  return Array.from(merged.entries())
    .map(([date, blocks]) => ({ date, blocks }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5); // 최근 5일만 유지
}

function mergeCompletedTasksHistory<T>(local: T[], remote: T[]): T[] {
  // 중복 제거 (간단히 합치고 최근 50개만)
  const merged = [...local, ...remote];
  return merged.slice(0, 50);
}
