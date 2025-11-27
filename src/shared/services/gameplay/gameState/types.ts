/**
 * Game State Event Types
 *
 * @role 게임 상태 변경 이벤트 정의
 * @description Repository 계층에서 UI 계층으로 이벤트를 전달하기 위한 타입 정의
 *
 * @benefits
 *   - Dependency Inversion Principle 준수
 *   - Repository가 UI에 의존하지 않음
 *   - 테스트 용이성 향상
 *   - 이벤트 기반 확장 가능
 */

/**
 * XP 획득 사유
 */
export type XPGainReason =
  | 'task_complete'    // 작업 완료
  | 'block_lock'       // 블록 잠금
  | 'timer_bonus'      // 타이머 보너스
  | 'perfect_block'    // 완벽한 블록 완료
  | 'quest_complete'   // 퀘스트 완료
  | 'dont_do_check'    // 하지않기 체크리스트 완료
  | 'other';           // 기타

/**
 * XP 획득 이벤트
 */
export interface XPGainedEvent {
  type: 'xp_gained';
  amount: number;
  reason: XPGainReason;
  blockId?: string;
}

/**
 * 퀘스트 완료 이벤트
 */
export interface QuestCompletedEvent {
  type: 'quest_completed';
  questId: string;
  questTitle: string;
  reward: number;
}

/**
 * 게임 상태 이벤트 유니온 타입
 */
export type GameStateEvent = XPGainedEvent | QuestCompletedEvent;

/**
 * 게임 상태 변경 결과
 *
 * @description Repository 함수가 반환하는 결과 타입
 * - gameState: 변경된 게임 상태
 * - events: 발생한 이벤트 목록 (UI 업데이트용)
 */
export interface GameStateChangeResult {
  gameState: import('@/shared/types/domain').GameState;
  events: GameStateEvent[];
}

/**
 * XP 획득 사유에 따른 메시지 매핑
 */
export const XP_REASON_MESSAGES: Record<XPGainReason, string> = {
  task_complete: 'XP 획득!',
  block_lock: '계획 잠금!',
  timer_bonus: '⏱️ 타이머 보너스!',
  perfect_block: '완벽한 블록 완료!',
  quest_complete: '퀘스트 완료!',
  dont_do_check: '하지않기 실천!',
  other: 'XP 획득!',
};
