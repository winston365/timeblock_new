/**
 * Game State Service - Public API
 *
 * @description 게임 상태 이벤트 시스템 export
 */

export { gameStateEventHandler, GameStateEventHandler } from './gameStateEventHandler';
export type {
  GameStateEvent,
  XPGainedEvent,
  LevelUpEvent,
  QuestCompletedEvent,
  GameStateChangeResult,
  XPGainReason,
} from './types';
export { XP_REASON_MESSAGES } from './types';
