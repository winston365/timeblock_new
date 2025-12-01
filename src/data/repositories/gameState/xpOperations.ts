/**
 * XP Operations
 *
 * @fileoverview XP(경험치) 관련 순수 함수 모음
 *
 * @role XP 획득, 소비, 계산 로직
 * @responsibilities
 *   - XP 추가/차감 처리 (processAddXP)
 *   - XP 소비 처리 및 잔액 검증 (processSpendXP)
 *   - 블록별 XP 기록 관리
 *   - XP 관련 이벤트 생성
 *
 * @dependencies
 *   - @/shared/lib/utils: getBlockIdFromHour (시간→블록ID 변환)
 *   - @/shared/services/gameplay/gameState: XPGainReason, GameStateEvent 타입
 */

import type { GameState } from '@/shared/types/domain';
import { getBlockIdFromHour } from '@/shared/lib/utils';
import type { XPGainReason, GameStateEvent } from '@/shared/services/gameplay/gameState';

/**
 * XP 추가 처리 (순수 함수)
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {number} amount - 추가할 XP 양
 * @param {string} [blockId] - 블록 ID (블록별 XP 기록용, 선택)
 * @param {XPGainReason} [reason='other'] - XP 획득 사유
 * @returns {{ updatedState: GameState, events: GameStateEvent[] }} 업데이트된 상태 및 이벤트
 */
export function processAddXP(
  gameState: GameState,
  amount: number,
  blockId?: string,
  reason: XPGainReason = 'other'
): { updatedState: GameState; events: GameStateEvent[] } {
  const now = new Date();
  const blockFromTime = getBlockIdFromHour(now.getHours());

  // XP 차감 시 음수 방지
  const newTotalXP = Math.max(0, gameState.totalXP + amount);
  const newDailyXP = Math.max(0, gameState.dailyXP + amount);
  const newAvailableXP = Math.max(0, gameState.availableXP + amount);

  const updatedState = {
    ...gameState,
    totalXP: newTotalXP,
    dailyXP: newDailyXP,
    availableXP: newAvailableXP,
  };

  // 블록별 XP 기록
  const blockKey = blockFromTime || blockId;
  if (blockKey) {
    const currentBlockXP = updatedState.timeBlockXP[blockKey] || 0;
    updatedState.timeBlockXP = {
      ...updatedState.timeBlockXP,
      [blockKey]: Math.max(0, currentBlockXP + amount),
    };
  }

  // 이벤트 생성
  const events: GameStateEvent[] = [];

  if (amount > 0) {
    events.push({
      type: 'xp_gained',
      amount,
      reason,
      blockId: blockKey,
    });
  } else if (amount < 0) {
    // NOTE: xp_deducted 타입이 GameStateEvent에 정의되지 않아 any 캐스팅 필요
    events.push({
      type: 'xp_deducted',
      amount: Math.abs(amount),
      reason,
      blockId: blockKey,
    } as unknown as GameStateEvent);
  }

  return { updatedState, events };
}

/**
 * XP 소비 처리 (순수 함수)
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {number} amount - 소비할 XP 양
 * @returns {{ success: boolean, updatedState?: GameState, error?: string }} 결과
 */
export function processSpendXP(
  gameState: GameState,
  amount: number
): { success: boolean; updatedState?: GameState; error?: string } {
  if (gameState.availableXP < amount) {
    return { success: false, error: 'Not enough XP' };
  }

  return {
    success: true,
    updatedState: {
      ...gameState,
      availableXP: gameState.availableXP - amount,
    },
  };
}
