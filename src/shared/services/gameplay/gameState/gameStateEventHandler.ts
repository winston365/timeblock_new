/**
 * Game State Event Handler
 *
 * @role 게임 상태 이벤트를 받아 UI 업데이트를 수행
 * @responsibility
 *   - XP 획득 이벤트 → 토스트 메시지 표시
 *   - 레벨업 이벤트 → 와이푸 축하 메시지 표시
 *   - 퀘스트 완료 이벤트 → 알림 표시
 *
 * @benefits
 *   - Repository 계층과 UI 계층 분리
 *   - DIP(Dependency Inversion Principle) 준수
 *   - 이벤트 기반 확장 가능
 */

import type { GameStateEvent, XPGainedEvent, LevelUpEvent, QuestCompletedEvent } from './types';
import { XP_REASON_MESSAGES } from './types';

/**
 * 게임 상태 이벤트 핸들러
 *
 * @description 게임 상태 변경 이벤트를 받아 적절한 UI 업데이트를 수행합니다.
 *
 * @example
 * ```ts
 * const handler = new GameStateEventHandler();
 * const events = [
 *   { type: 'xp_gained', amount: 15, reason: 'task_complete' },
 *   { type: 'level_up', previousLevel: 5, newLevel: 6, totalXP: 500 }
 * ];
 * await handler.handleEvents(events);
 * ```
 */
export class GameStateEventHandler {
  name = 'GameStateEventHandler';

  /**
   * 이벤트 배열 처리
   */
  async handleEvents(events: GameStateEvent[]): Promise<void> {
    for (const event of events) {
      await this.handleEvent(event);
    }
  }

  /**
   * 단일 이벤트 처리
   */
  async handleEvent(event: GameStateEvent): Promise<void> {
    switch (event.type) {
      case 'xp_gained':
        await this.handleXPGained(event);
        break;
      case 'level_up':
        await this.handleLevelUp(event);
        break;
      case 'quest_completed':
        await this.handleQuestCompleted(event);
        break;
      default:
        console.warn(`[${this.name}] Unknown event type:`, event);
    }
  }

  /**
   * XP 획득 이벤트 처리
   * - XP 토스트 메시지 표시
   */
  private async handleXPGained(event: XPGainedEvent): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const { toast } = await import('react-hot-toast');
      const { default: XPToast } = await import('@/shared/components/XPToast');
      const message = XP_REASON_MESSAGES[event.reason] || 'XP 획득!';

      toast.custom((t) => XPToast({ xp: event.amount, message, t }), {
        duration: 3000,
        position: 'top-right',
      });

      console.log(`[${this.name}] 🎁 XP Toast: ${event.amount} (${event.reason})`);
    } catch (error) {
      console.error(`[${this.name}] ❌ Failed to show XP toast:`, error);
    }
  }

  /**
   * 레벨업 이벤트 처리
   * - 와이푸 축하 메시지 표시
   */
  private async handleLevelUp(event: LevelUpEvent): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const { useWaifuCompanionStore } = await import('@/shared/stores/waifuCompanionStore');
      const waifuStore = useWaifuCompanionStore.getState();

      waifuStore.show(`축하해! 레벨 ${event.newLevel}로 올랐어! 🎊✨`);

      console.log(`[${this.name}] 🎉 Level Up: ${event.previousLevel} → ${event.newLevel}`);
    } catch (error) {
      console.error(`[${this.name}] ❌ Failed to show level up message:`, error);
    }
  }

  /**
   * 퀘스트 완료 이벤트 처리
   * - 퀘스트 완료 알림 표시
   */
  private async handleQuestCompleted(event: QuestCompletedEvent): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const { useWaifuCompanionStore } = await import('@/shared/stores/waifuCompanionStore');
      const waifuStore = useWaifuCompanionStore.getState();

      waifuStore.show(`🎯 퀘스트 완료: ${event.questTitle}! (+${event.reward} XP)`);

      console.log(`[${this.name}] ✅ Quest Completed: ${event.questId}`);
    } catch (error) {
      console.error(`[${this.name}] ❌ Failed to show quest completion:`, error);
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
export const gameStateEventHandler = new GameStateEventHandler();
