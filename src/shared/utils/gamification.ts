/**
 * 게임화 시스템 유틸리티
 * XP 계산, 레벨업 체크, 보상 계산 등
 */

import type { Task, Resistance, GameState } from '@/shared/types/domain';

/**
 * 저항도별 XP 배율
 */
export const RESISTANCE_XP_MULTIPLIERS: Record<Resistance, number> = {
  low: 1.0,    // 🟢 쉬움
  medium: 1.2, // 🟡 보통
  high: 1.5,   // 🔴 어려움
};

/**
 * 블록 잠금 비용
 */
export const BLOCK_LOCK_COST = 15;

/**
 * 블록 완벽 완료 보상
 */
export const PERFECT_BLOCK_REWARD = 40;

/**
 * 블록 잠금 해제 페널티
 */
export const BLOCK_UNLOCK_PENALTY = 40;

/**
 * 작업 완료 시 기본 XP 계산
 * baseXP = adjustedDuration * 0.5 * resistanceMultiplier
 */
export function calculateTaskBaseXP(task: Task): number {
  const resistanceMultiplier = RESISTANCE_XP_MULTIPLIERS[task.resistance] || 1.0;
  const baseXP = task.adjustedDuration * 0.5 * resistanceMultiplier;
  return Math.round(baseXP);
}

/**
 * 레벨 보너스 계산
 * 5레벨마다 +5 XP
 */
export function calculateLevelBonus(level: number): number {
  return Math.floor(level / 5) * 5;
}

/**
 * 작업 완료 시 총 XP 계산
 * totalXP = baseXP + levelBonus
 */
export function calculateTaskTotalXP(task: Task, level: number): number {
  const baseXP = calculateTaskBaseXP(task);
  const levelBonus = calculateLevelBonus(level);
  return baseXP + levelBonus;
}

/**
 * 레벨업에 필요한 XP 계산
 * requiredXP = level * 100
 */
export function calculateRequiredXP(level: number): number {
  return level * 100;
}

/**
 * 레벨업 체크 및 새 레벨 계산
 * @returns 새 레벨 (레벨업이 없으면 현재 레벨 반환)
 */
export function checkLevelUp(currentXP: number, currentLevel: number): number {
  let newLevel = currentLevel;
  let remainingXP = currentXP;

  while (remainingXP >= calculateRequiredXP(newLevel)) {
    remainingXP -= calculateRequiredXP(newLevel);
    newLevel++;
  }

  return newLevel;
}

/**
 * 블록 완벽 완료 체크
 * 블록 내 모든 작업이 완료되었는지 확인
 */
export function isBlockPerfect(tasks: Task[], blockId: string): boolean {
  const blockTasks = tasks.filter((t) => t.timeBlock === blockId);
  if (blockTasks.length === 0) return false;
  return blockTasks.every((t) => t.completed);
}

/**
 * 블록 실패 체크
 * 블록이 잠겨있고 미완료 작업이 있는지 확인
 */
export function isBlockFailed(tasks: Task[], blockId: string, isLocked: boolean): boolean {
  if (!isLocked) return false;
  const blockTasks = tasks.filter((t) => t.timeBlock === blockId);
  return blockTasks.some((t) => !t.completed);
}

/**
 * 일일 퀘스트 타입별 목표값 생성
 */
export function generateQuestTarget(type: string): number {
  switch (type) {
    case 'complete_tasks':
      return 5; // 5개 작업 완료
    case 'earn_xp':
      return 100; // 100 XP 획득
    case 'lock_blocks':
      return 3; // 3개 블록 잠금
    case 'perfect_blocks':
      return 2; // 2개 완벽 블록
    default:
      return 1;
  }
}

/**
 * 일일 퀘스트 보상 계산
 */
export function calculateQuestReward(type: string): number {
  switch (type) {
    case 'complete_tasks':
      return 50;
    case 'earn_xp':
      return 30;
    case 'lock_blocks':
      return 40;
    case 'perfect_blocks':
      return 60;
    default:
      return 20;
  }
}

/**
 * 작업 완료 시 호감도 증가량 계산
 */
export function calculateAffectionIncrease(task: Task): number {
  // 기본 +2
  let increase = 2;

  // 저항도가 높을수록 추가 호감도
  if (task.resistance === 'high') {
    increase += 2;
  } else if (task.resistance === 'medium') {
    increase += 1;
  }

  return increase;
}

/**
 * XP 히스토리 업데이트 헬퍼
 */
export function updateXPHistory(
  history: Array<{ date: string; xp: number }>,
  date: string,
  xpToAdd: number
): Array<{ date: string; xp: number }> {
  const existing = history.find((h) => h.date === date);

  if (existing) {
    // 기존 날짜 업데이트
    return history.map((h) => (h.date === date ? { ...h, xp: h.xp + xpToAdd } : h));
  } else {
    // 새 날짜 추가 (최근 7일만 유지)
    const newHistory = [...history, { date, xp: xpToAdd }];
    return newHistory.slice(-7);
  }
}

/**
 * 블록별 XP 히스토리 업데이트 헬퍼
 */
export function updateTimeBlockXPHistory(
  history: Array<{ date: string; blocks: Record<string, number> }>,
  date: string,
  blockId: string,
  xpToAdd: number
): Array<{ date: string; blocks: Record<string, number> }> {
  const existing = history.find((h) => h.date === date);

  if (existing) {
    // 기존 날짜 업데이트
    return history.map((h) =>
      h.date === date
        ? {
            ...h,
            blocks: {
              ...h.blocks,
              [blockId]: (h.blocks[blockId] || 0) + xpToAdd,
            },
          }
        : h
    );
  } else {
    // 새 날짜 추가 (최근 5일만 유지)
    const newHistory = [
      ...history,
      {
        date,
        blocks: { [blockId]: xpToAdd },
      },
    ];
    return newHistory.slice(-5);
  }
}
