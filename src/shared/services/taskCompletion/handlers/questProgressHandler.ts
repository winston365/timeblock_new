/**
 * Quest Progress Handler
 *
 * @role 작업 완료 시 퀘스트 진행도 업데이트를 담당
 * @responsibility 단일 책임: 퀘스트 진행도만 업데이트
 */

import type { TaskCompletionHandler, TaskCompletionContext } from '../types';
import { updateQuestProgress } from '@/data/repositories/gameStateRepository';
import { calculateTaskXP } from '@/shared/lib/utils';

/**
 * 퀘스트 진행도 핸들러
 *
 * @description 작업 완료 시 관련 퀘스트를 업데이트합니다.
 * - complete_tasks: 작업 완료 횟수
 * - earn_xp: 획득 XP 총량
 */
export class QuestProgressHandler implements TaskCompletionHandler {
  name = 'QuestProgressHandler';

  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameState').GameStateEvent[]> {
    const { task, wasCompleted } = context;

    // 완료 -> 미완료 전환은 처리하지 않음
    if (wasCompleted) {
      return [];
    }

    // 작업 완료 퀘스트 업데이트
    await updateQuestProgress('complete_tasks', 1);

    // XP 획득 퀘스트 업데이트
    const xpAmount = calculateTaskXP(task);
    await updateQuestProgress('earn_xp', xpAmount);

    console.log(`[${this.name}] ✅ Updated quests: complete_tasks +1, earn_xp +${xpAmount}`);

    // 퀘스트는 별도 이벤트 없음 (UI 업데이트는 상태 변경으로 자동 처리)
    return [];
  }
}
