/**
 * Block Completion Handler
 *
 * @role 작업 완료 시 블록 완성 체크 및 보너스 지급을 담당
 * @responsibility 단일 책임: 블록 완성 로직만 처리
 */

import type { TaskCompletionHandler, TaskCompletionContext } from '../types';
import { addXP, updateQuestProgress } from '@/data/repositories/gameStateRepository';
import { updateBlockState } from '@/data/repositories/dailyDataRepository';

/**
 * 블록 완성 핸들러
 *
 * @description 작업 완료 시 블록 완성 여부를 체크하고 보너스를 지급합니다.
 * - 잠금된 블록의 모든 작업이 완료되면 +40 XP 보너스
 * - perfect_blocks 퀘스트 업데이트
 * - 블록 상태를 isPerfect: true로 변경
 */
export class BlockCompletionHandler implements TaskCompletionHandler {
  name = 'BlockCompletionHandler';

  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameState').GameStateEvent[]> {
    const { task, wasCompleted, date, blockState, blockTasks } = context;

    // 완료 -> 미완료 전환은 처리하지 않음
    if (wasCompleted) {
      return [];
    }

    // 블록이 없으면 처리하지 않음
    if (!task.timeBlock || !blockState || !blockTasks) {
      return [];
    }

    // 블록이 잠기지 않았으면 보너스 없음
    if (!blockState.isLocked) {
      return [];
    }

    // 모든 작업이 완료되었는지 체크
    const allCompleted = blockTasks.length > 0 && blockTasks.every(t => t.completed);

    if (!allCompleted) {
      return [];
    }

    // 🎉 완벽한 블록 달성!
    const PERFECT_BLOCK_BONUS = 40;

    // 보너스 XP 지급 (사유: 완벽한 블록)
    const result = await addXP(PERFECT_BLOCK_BONUS, task.timeBlock, 'perfect_block');

    // 블록 상태 업데이트
    await updateBlockState(
      task.timeBlock,
      { isPerfect: true },
      date
    );

    // 퀘스트 업데이트
    await updateQuestProgress('perfect_blocks', 1);

    console.log(`[${this.name}] 🎉 Perfect block achieved: ${task.timeBlock} (+${PERFECT_BLOCK_BONUS} XP)`);

    // 이벤트 반환 (UI 처리는 상위 서비스에서)
    return result.events;
  }

  /**
   * 완벽한 블록 달성 여부 반환 (외부에서 메시지 생성용)
   */
  isPerfectBlockAchieved(context: TaskCompletionContext): boolean {
    const { task, wasCompleted, blockState, blockTasks } = context;

    if (wasCompleted || !task.timeBlock || !blockState || !blockTasks) {
      return false;
    }

    if (!blockState.isLocked) {
      return false;
    }

    return blockTasks.length > 0 && blockTasks.every(t => t.completed);
  }
}
