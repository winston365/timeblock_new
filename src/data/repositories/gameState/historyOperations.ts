/**
 * History Operations
 *
 * @fileoverview 히스토리 데이터 관리 순수 함수 모음
 *
 * @role XP 히스토리, 완료 작업 히스토리 관리
 * @responsibilities
 *   - 일일 XP 히스토리 추가 및 조회 (addToXPHistory, getXPHistoryFromState)
 *   - 블록별 XP 히스토리 추가 및 조회 (addToBlockXPHistory, getBlockXPHistoryFromState)
 *   - 완료 작업 히스토리 관리 (addToCompletedTasksHistory)
 *   - 히스토리 데이터 크기 제한 (최근 N개 유지)
 *
 * @dependencies
 *   - @/shared/types/domain: GameState, Task 타입
 */

import type { GameState, Task } from '@/shared/types/domain';

/**
 * XP 히스토리에 일일 데이터 추가
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {string} date - 기록할 날짜
 * @param {number} xp - 해당 일의 XP
 * @returns {GameState} 업데이트된 게임 상태
 */
export function addToXPHistory(gameState: GameState, date: string, xp: number): GameState {
  if (xp <= 0) return gameState;

  const xpHistory = Array.isArray(gameState.xpHistory) ? [...gameState.xpHistory] : [];
  xpHistory.push({ date, xp });

  // 최근 7일만 유지
  const trimmedHistory = xpHistory.length > 7 ? xpHistory.slice(-7) : xpHistory;

  return {
    ...gameState,
    xpHistory: trimmedHistory,
  };
}

/**
 * 블록별 XP 히스토리에 추가
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {string} date - 기록할 날짜
 * @param {Record<string, number>} blocks - 블록별 XP 맵
 * @returns {GameState} 업데이트된 게임 상태
 */
export function addToBlockXPHistory(
  gameState: GameState,
  date: string,
  blocks: Record<string, number>
): GameState {
  if (Object.keys(blocks).length === 0) return gameState;

  const timeBlockXPHistory = Array.isArray(gameState.timeBlockXPHistory)
    ? [...gameState.timeBlockXPHistory]
    : [];

  timeBlockXPHistory.push({ date, blocks: { ...blocks } });

  // 최근 5일만 유지
  const trimmedHistory = timeBlockXPHistory.length > 5 ? timeBlockXPHistory.slice(-5) : timeBlockXPHistory;

  return {
    ...gameState,
    timeBlockXPHistory: trimmedHistory,
  };
}

/**
 * 완료 작업 히스토리에 추가
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {Task} task - 완료된 작업
 * @returns {GameState} 업데이트된 게임 상태
 */
export function addToCompletedTasksHistory(gameState: GameState, task: Task): GameState {
  const completedTasksHistory = Array.isArray(gameState.completedTasksHistory)
    ? [...gameState.completedTasksHistory]
    : [];

  completedTasksHistory.unshift(task);

  // 최근 50개만 유지
  const trimmedHistory = completedTasksHistory.length > 50
    ? completedTasksHistory.slice(0, 50)
    : completedTasksHistory;

  return {
    ...gameState,
    completedTasksHistory: trimmedHistory,
  };
}

/**
 * XP 히스토리 조회
 *
 * @param {GameState} gameState - 게임 상태
 * @param {number} [days=7] - 조회할 일수
 * @returns {Array<{ date: string; xp: number }>} 날짜별 XP 배열
 */
export function getXPHistoryFromState(
  gameState: GameState,
  days: number = 7
): Array<{ date: string; xp: number }> {
  const history = Array.isArray(gameState.xpHistory) ? gameState.xpHistory : [];
  return history.slice(-days);
}

/**
 * 블록별 XP 히스토리 조회
 *
 * @param {GameState} gameState - 게임 상태
 * @param {number} [days=5] - 조회할 일수
 * @returns {Array<{ date: string; blocks: Record<string, number> }>} 날짜별 블록 XP 배열
 */
export function getBlockXPHistoryFromState(
  gameState: GameState,
  days: number = 5
): Array<{ date: string; blocks: Record<string, number> }> {
  const history = Array.isArray(gameState.timeBlockXPHistory) ? gameState.timeBlockXPHistory : [];
  return history.slice(-days);
}
