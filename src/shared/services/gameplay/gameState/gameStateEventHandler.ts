/**
 * Game State Event Handler
 *
 * @role 게임 상태 이벤트를 받아 UI 업데이트를 수행
 * @responsibility
 *   - XP 획득 이벤트 → 토스트 메시지 표시
 *   - 퀘스트 완료 이벤트 → 알림 표시
 *
 * @benefits
 *   - Repository 계층과 UI 계층 분리
 *   - DIP(Dependency Inversion Principle) 준수
 *   - 이벤트 기반 확장 가능
 */

import { XP_REASON_MESSAGES, type GameStateEvent, type XPGainedEvent, type QuestCompletedEvent } from './types';

/**
 * 게임 상태 이벤트 핸들러
 *
 * @description 게임 상태 변경 이벤트를 받아 적절한 UI 업데이트를 수행합니다.
 *
 * @example
 * ```ts
 * const handler = new GameStateEventHandler();
 * const events = [
 *   { type: 'xp_gained', amount: 15, reason: 'task_complete' }
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
   * 퀘스트 완료 이벤트 처리
   * - 퀘스트 완료 알림 표시
   */
  private async handleQuestCompleted(event: QuestCompletedEvent): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const { toast } = await import('react-hot-toast');
      const { default: XPToast } = await import('@/shared/components/XPToast');
      const { useWaifuCompanionStore } = await import('@/shared/stores/waifuCompanionStore');
      const waifuStore = useWaifuCompanionStore.getState();

      waifuStore.show(`🎯 퀘스트 완료: ${event.questTitle}! (+${event.reward} XP)`);
      toast.custom((t) => XPToast({ xp: event.reward, message: `퀘스트 완료: ${event.questTitle}`, t }), {
        duration: 3000,
        position: 'top-right',
      });

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
