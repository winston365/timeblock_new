/**
 * XP Reward Handler
 *
 * @role 작업 완료 시 XP 보상 지급을 담당
 * @responsibility 단일 책임: XP 계산 및 지급만 처리
 * @dependencies
 *   - calculateTaskXP: 작업 XP 계산 유틸리티
 *   - useGameStateStore: XP 지급을 위한 게임 상태 스토어
 */

import type { TaskCompletionHandler, TaskCompletionContext } from '../types';

import { calculateTaskXP } from '@/shared/lib/utils';

/**
 * XP 보상 핸들러
 *
 * @description 작업 완료 시 XP를 계산하고 지급합니다.
 * - 기본 XP: 10
 * - 난이도 배율: low(1x), medium(1.5x), high(2x)
 * - 타이머 보너스: +5 XP
 * - 준비 보너스: +1 XP per field
 */
export class XPRewardHandler implements TaskCompletionHandler {
  name = 'XPRewardHandler';

  /**
   * 작업 완료 시 XP를 계산하고 지급합니다.
   * @param context - 작업 완료 컨텍스트 (task, wasCompleted 포함)
   * @returns XP 획득 이벤트 배열 (0 XP인 경우 빈 배열)
   */
  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameplay/gameState').GameStateEvent[]> {
    const { task, wasCompleted } = context;

    // 완료 -> 미완료 전환은 처리하지 않음
    if (wasCompleted) {
      return [];
    }

    // XP 계산
    const xpAmount = calculateTaskXP(task);

    // XP 지급 (Store 사용)
    // skipEvents=true로 설정하여 Store에서의 중복 이벤트 처리 방지
    const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
    await useGameStateStore.getState().addXP(xpAmount, task.timeBlock || undefined, true);

    // 0 XP인 경우 이벤트를 반환하지 않음 (무의미한 토스트 방지)
    if (xpAmount === 0) {
      return [];
    }

    // XP 획득 이벤트 반환 (TaskCompletionService에서 처리)
    return [{
      type: 'xp_gained',
      amount: xpAmount,
      reason: 'task_complete'
    }];
  }
}
