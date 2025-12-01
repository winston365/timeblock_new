/**
 * Gamification Utilities
 *
 * @fileoverview 게임화 시스템의 핵심 계산 로직을 제공하는 유틸리티 모듈
 *
 * @role XP 계산, 퀘스트 목표/보상 계산, 호감도 증가량 계산 등 게임화 관련 모든 계산 로직 제공
 * @responsibilities
 *   - 작업 완료 시 XP 계산 (저항도 반영)
 *   - 블록 완벽 완료/실패 판정
 *   - 퀘스트 목표값 및 보상 생성
 *   - 호감도 증가량 계산
 *   - XP 히스토리 업데이트
 * @dependencies
 *   - @/shared/types/domain: Task, Resistance 타입
 */

import type { Task, Resistance } from '@/shared/types/domain';

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
 * 작업 완료 시 기본 XP를 계산합니다.
 *
 * 계산식: baseXP = adjustedDuration * 0.5 * resistanceMultiplier
 *
 * @param task - 완료된 작업 객체
 * @returns 반올림된 기본 XP 값
 *
 * @example
 * ```ts
 * const xp = calculateTaskBaseXP(completedTask);
 * // adjustedDuration=30, resistance='high' → 30 * 0.5 * 1.5 = 23 XP
 * ```
 */
export function calculateTaskBaseXP(task: Task): number {
  const resistanceMultiplier = RESISTANCE_XP_MULTIPLIERS[task.resistance] || 1.0;
  const baseXP = task.adjustedDuration * 0.5 * resistanceMultiplier;
  return Math.round(baseXP);
}

/**
 * 블록 완벽 완료 여부를 확인합니다.
 *
 * 블록 내 모든 작업이 완료되었는지 검사합니다.
 * 작업이 없는 블록은 완벽 완료로 간주하지 않습니다.
 *
 * @param tasks - 전체 작업 목록
 * @param blockId - 확인할 타임블록 ID
 * @returns 블록 내 모든 작업이 완료되었으면 true, 아니면 false
 */
export function isBlockPerfect(tasks: Task[], blockId: string): boolean {
  const tasksInBlock = tasks.filter((taskItem) => taskItem.timeBlock === blockId);
  if (tasksInBlock.length === 0) return false;
  return tasksInBlock.every((taskItem) => taskItem.completed);
}

/**
 * 블록 실패 여부를 확인합니다.
 *
 * 블록이 잠겨있고 미완료 작업이 있는 경우 실패로 판정합니다.
 *
 * @param tasks - 전체 작업 목록
 * @param blockId - 확인할 타임블록 ID
 * @param isLocked - 블록 잠금 여부
 * @returns 블록이 잠겨있고 미완료 작업이 있으면 true, 아니면 false
 */
export function isBlockFailed(tasks: Task[], blockId: string, isLocked: boolean): boolean {
  if (!isLocked) return false;
  const tasksInBlock = tasks.filter((taskItem) => taskItem.timeBlock === blockId);
  return tasksInBlock.some((taskItem) => !taskItem.completed);
}

/**
 * 일일 퀘스트 타입에 따른 목표값을 생성합니다.
 *
 * @param questType - 퀘스트 타입 ('complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks')
 * @returns 해당 퀘스트 타입의 목표값
 */
export function generateQuestTarget(questType: string): number {
  switch (questType) {
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
 * 일일 퀘스트 타입에 따른 보상 XP를 계산합니다.
 *
 * @param questType - 퀘스트 타입 ('complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks')
 * @returns 해당 퀘스트 타입의 보상 XP
 */
export function calculateQuestReward(questType: string): number {
  switch (questType) {
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
 * 작업 완료 시 호감도 증가량을 계산합니다.
 *
 * 기본 +2, 저항도가 높을수록 추가 호감도가 부여됩니다.
 * - high: +2 추가 (총 4)
 * - medium: +1 추가 (총 3)
 * - low: 추가 없음 (총 2)
 *
 * @param task - 완료된 작업 객체
 * @returns 호감도 증가량 (2~4)
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
 * XP 히스토리를 업데이트합니다.
 *
 * 해당 날짜의 XP를 누적하거나 새 날짜를 추가합니다.
 * 최근 7일간의 히스토리만 유지합니다.
 *
 * @param history - 기존 XP 히스토리 배열
 * @param date - 날짜 문자열 (YYYY-MM-DD 형식)
 * @param xpToAdd - 추가할 XP 값
 * @returns 업데이트된 히스토리 배열 (최근 7일)
 */
export function updateXPHistory(
  history: Array<{ date: string; xp: number }>,
  date: string,
  xpToAdd: number
): Array<{ date: string; xp: number }> {
  const existingEntry = history.find((historyEntry) => historyEntry.date === date);

  if (existingEntry) {
    // 기존 날짜 업데이트
    return history.map((historyEntry) => (historyEntry.date === date ? { ...historyEntry, xp: historyEntry.xp + xpToAdd } : historyEntry));
  } else {
    // 새 날짜 추가 (최근 7일만 유지)
    const newHistory = [...history, { date, xp: xpToAdd }];
    return newHistory.slice(-7);
  }
}

/**
 * 타임블록별 XP 히스토리를 업데이트합니다.
 *
 * 해당 날짜와 블록의 XP를 누적하거나 새 항목을 추가합니다.
 * 최근 5일간의 히스토리만 유지합니다.
 *
 * @param history - 기존 블록별 XP 히스토리 배열
 * @param date - 날짜 문자열 (YYYY-MM-DD 형식)
 * @param blockId - 타임블록 ID
 * @param xpToAdd - 추가할 XP 값
 * @returns 업데이트된 히스토리 배열 (최근 5일)
 */
export function updateTimeBlockXPHistory(
  history: Array<{ date: string; blocks: Record<string, number> }>,
  date: string,
  blockId: string,
  xpToAdd: number
): Array<{ date: string; blocks: Record<string, number> }> {
  const existingEntry = history.find((historyEntry) => historyEntry.date === date);

  if (existingEntry) {
    // 기존 날짜 업데이트
    return history.map((historyEntry) =>
      historyEntry.date === date
        ? {
            ...historyEntry,
            blocks: {
              ...historyEntry.blocks,
              [blockId]: (historyEntry.blocks[blockId] || 0) + xpToAdd,
            },
          }
        : historyEntry
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
