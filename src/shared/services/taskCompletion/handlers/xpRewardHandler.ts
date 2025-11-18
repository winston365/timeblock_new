/**
 * XP Reward Handler
 *
 * @role 작업 완료 시 XP 보상 지급을 담당
 * @responsibility 단일 책임: XP 계산 및 지급만 처리
 */

import type { TaskCompletionHandler, TaskCompletionContext } from '../types';
import { addXP } from '@/data/repositories/gameStateRepository';
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

  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameState').GameStateEvent[]> {
    const { task, wasCompleted } = context;

    console.log(`[${this.name}] 🎮 Starting XP reward...`, {
      taskId: task.id,
      taskText: task.text,
      wasCompleted,
      completed: task.completed
    });

    // 완료 -> 미완료 전환은 처리하지 않음
    if (wasCompleted) {
      console.log(`[${this.name}] ⏭️ Skipping (wasCompleted=true)`);
      return [];
    }

    // XP 계산
    const xpAmount = calculateTaskXP(task);

    console.log(`[${this.name}] 💰 Calculated XP: ${xpAmount}`);

    // XP가 0이면 경고
    if (xpAmount === 0) {
      console.warn(`[${this.name}] ⚠️ XP is 0! Check task duration.`);
    }

    // XP 지급 (블록 ID 포함, 사유: 작업 완료)
    const result = await addXP(xpAmount, task.timeBlock || undefined, 'task_complete');

    console.log(`[${this.name}] ✅ Granted ${xpAmount} XP for task: ${task.text}`, {
      gameState: result.gameState,
      events: result.events
    });

    // 이벤트 반환 (UI 처리는 상위 서비스에서)
    return result.events;
  }
}
