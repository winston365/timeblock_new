/**
 * @file types.ts
 * @role 작업 완료 처리를 위한 타입 정의
 * @responsibilities 작업 완료 시 발생하는 부수효과들을 처리하기 위한 인터페이스 및 타입 제공
 * @key-dependencies Task, TimeBlockState (도메인 타입)
 */

import type { Task, TimeBlockState } from '@/shared/types/domain';

/**
 * 작업 완료 컨텍스트
 * - 완료 처리에 필요한 모든 정보를 담은 객체
 */
export interface TaskCompletionContext {
  /** 완료된 작업 */
  task: Task;
  /** 완료 전 상태 (취소 시 true) */
  wasCompleted: boolean;
  /** 현재 날짜 (YYYY-MM-DD) */
  date: string;
  /** 블록 상태 (해당 블록이 있는 경우) */
  blockState?: TimeBlockState;
  /** 해당 블록의 모든 작업들 */
  blockTasks?: Task[];
}

/**
 * 작업 완료 처리 결과
 */
export interface TaskCompletionResult {
  /** 성공 여부 */
  success: boolean;
  /** XP 획득량 */
  xpGained: number;
  /** 블록 보너스 XP (있는 경우) */
  blockBonusXP?: number;
  /** 완벽한 블록 달성 여부 */
  isPerfectBlock?: boolean;
  /** 와이푸 메시지 */
  waifuMessage?: string;
  /** 에러 (실패 시) */
  error?: Error;
}

/**
 * 작업 완료 핸들러 인터페이스
 * - 각 부수효과 처리를 담당하는 핸들러의 공통 인터페이스
 */
export interface TaskCompletionHandler {
  /** 핸들러 이름 (디버깅용) */
  name: string;
  /** 핸들러 실행 - 게임 상태 이벤트 배열 반환 */
  handle(context: TaskCompletionContext): Promise<import('@/shared/services/gameplay/gameState').GameStateEvent[]>;
}
