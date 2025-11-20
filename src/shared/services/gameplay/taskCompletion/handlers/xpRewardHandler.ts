/**
 * XP Reward Handler
 *
 * @role 작업 완료 시 XP 보상 지급을 담당
 * @responsibility 단일 책임: XP 계산 및 지급만 처리
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

  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameplay/gameState').GameStateEvent[]> {
    const { task, wasCompleted } = context;

    // 완료 -> 미완료 전환은 처리하지 않음
    if (wasCompleted) {
      return [];
    }

    // XP 계산
    const xpAmount = calculateTaskXP(task);

    // XP 지급 (Store 사용)
    // Store 내부에서 addXPToRepo 호출 -> State 업데이트 -> 이벤트 처리(Toast)까지 수행됨
    const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
    await useGameStateStore.getState().addXP(xpAmount, task.timeBlock || undefined);

    console.log(`[${this.name}] ✅ Granted ${xpAmount} XP for task: ${task.text}`);

    // Store에서 이미 이벤트를 처리했으므로 빈 배열 반환 (중복 처리 방지)
    return [];
  }
}
