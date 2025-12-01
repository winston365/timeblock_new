/**
 * Waifu Affection Handler
 *
 * @role 작업 완료 시 와이푸 호감도 증가를 담당
 * @responsibility 단일 책임: 와이푸 호감도만 업데이트
 * @dependencies
 *   - increaseAffectionFromTask: 작업 완료 시 호감도 증가 레포지토리 함수
 */

import type { TaskCompletionHandler, TaskCompletionContext } from '../types';
import { increaseAffectionFromTask } from '@/data/repositories/waifuRepository';

/**
 * 와이푸 호감도 핸들러
 *
 * @description 작업 완료 시 와이푸 호감도를 증가시킵니다.
 * - 작업 완료 시마다 호감도 증가
 * - 보유 XP 기반으로 호감도 재계산
 */
export class WaifuAffectionHandler implements TaskCompletionHandler {
  name = 'WaifuAffectionHandler';

  /**
   * 작업 완료 시 와이푸 호감도를 증가시킵니다.
   * @param context - 작업 완료 컨텍스트 (wasCompleted 포함)
   * @returns 빈 이벤트 배열 (상태 변경으로 자동 처리)
   */
  async handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameplay/gameState').GameStateEvent[]> {
    const { wasCompleted } = context;

    // 완료 -> 미완료 전환은 처리하지 않음
    if (wasCompleted) {
      return [];
    }

    // 와이푸 호감도 증가
    await increaseAffectionFromTask();

    // 와이푸는 별도 이벤트 없음 (상태 변경으로 자동 처리)
    return [];
  }
}
