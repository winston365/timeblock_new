/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file taskCompletionService.ts
 * @role 작업 완료 시 발생하는 모든 부수효과를 통합 관리하는 서비스
 * @responsibilities
 *   - 작업 완료 시 필요한 모든 핸들러를 순차적으로 실행
 *   - 각 핸들러의 실행 결과를 집계하여 반환
 *   - 에러 처리 및 로깅
 * @key-dependencies
 *   - XPRewardHandler: XP 지급
 *   - QuestProgressHandler: 퀘스트 업데이트
 *   - WaifuAffectionHandler: 와이푸 호감도 변경
 *   - BlockCompletionHandler: 퍼펙트 블록 판정
 */

import type {
  TaskCompletionContext,
  TaskCompletionResult,
  TaskCompletionHandler,
} from './types';
import { XPRewardHandler } from './handlers/xpRewardHandler';
import { QuestProgressHandler } from './handlers/questProgressHandler';
import { WaifuAffectionHandler } from './handlers/waifuAffectionHandler';
import { BlockCompletionHandler } from './handlers/blockCompletionHandler';
import { calculateTaskXP } from '@/shared/lib/utils';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

/**
 * 작업 완료 서비스
 *
 * @description 작업 완료 시 필요한 모든 처리를 수행하는 통합 서비스
 *
 * @example
 * ```ts
 * const service = new TaskCompletionService();
 * const result = await service.handleTaskCompletion({
 *   task: completedTask,
 *   wasCompleted: false,
 *   date: '2025-01-17',
 *   blockState,
 *   blockTasks,
 * });
 *
 * if (result.success) {
 *   console.log(`XP gained: ${result.xpGained}`);
 *   if (result.waifuMessage) {
 *     showWaifuMessage(result.waifuMessage);
 *   }
 * }
 * ```
 */
export class TaskCompletionService {
  private handlers: TaskCompletionHandler[];
  private blockHandler: BlockCompletionHandler;

  constructor() {
    // 핸들러 초기화 (실행 순서 중요)
    this.blockHandler = new BlockCompletionHandler();
    this.handlers = [
      new XPRewardHandler(),           // 1. XP 지급
      new QuestProgressHandler(),      // 2. 퀘스트 업데이트
      new WaifuAffectionHandler(),     // 3. 와이푸 호감도 증가
      this.blockHandler,               // 4. 블록 완성 체크 (마지막)
    ];
  }

  /**
   * 작업 완료 처리
   *
   * @param context 작업 완료 컨텍스트
   * @returns 처리 결과 (XP, 메시지 등)
   */
  async handleTaskCompletion(
    context: TaskCompletionContext
  ): Promise<TaskCompletionResult> {
    const { task, wasCompleted } = context;

    try {
      // 완료 -> 미완료 전환은 처리하지 않음
      if (wasCompleted) {
        return {
          success: true,
          xpGained: 0,
        };
      }

      // 모든 핸들러 순차 실행하고 이벤트 수집
      const allEvents: import('@/shared/services/gameplay/gameState').GameStateEvent[] = [];
      for (const handler of this.handlers) {
        const events = await handler.handle(context);
        allEvents.push(...events);
      }

      // 결과 집계
      const xpGained = calculateTaskXP(task);
      const isPerfectBlock = this.blockHandler.isPerfectBlockAchieved(context);

      // 와이푸 메시지 생성
      const waifuMessage = this.generateWaifuMessage(
        task,
        xpGained,
        isPerfectBlock
      );

      // 와이푸 메시지 표시 (작업 완료 메시지만)
      if (waifuMessage) {
        const waifuStore = useWaifuCompanionStore.getState();
        waifuStore.show(waifuMessage);
      }

      // 수집된 게임 상태 이벤트 처리 (XP 토스트 등)
      if (allEvents.length > 0) {
        const { gameStateEventHandler } = await import('@/shared/services/gameplay/gameState');
        await gameStateEventHandler.handleEvents(allEvents);
      }

      const result: TaskCompletionResult = {
        success: true,
        xpGained,
        blockBonusXP: isPerfectBlock ? 40 : undefined,
        isPerfectBlock,
        waifuMessage,
      };

      return result;
    } catch (error) {
      console.error(`[TaskCompletionService] ❌ Error processing task completion:`, error);
      return {
        success: false,
        xpGained: 0,
        error: error as Error,
      };
    }
  }

  /**
   * 와이푸 메시지 생성
   *
   * @private
   */
  private generateWaifuMessage(
    task: any,
    xpGained: number,
    isPerfectBlock: boolean
  ): string {
    if (isPerfectBlock && task.timeBlock) {
      return `완벽해! ${task.timeBlock} 블록 완성! 🎉 (+40XP 보너스!)`;
    }

    return `좋아! "${task.text}" 완료했구나! (+${xpGained}XP)`;
  }
}

/**
 * 싱글톤 인스턴스
 * - 앱 전체에서 하나의 인스턴스만 사용
 */
export const taskCompletionService = new TaskCompletionService();
