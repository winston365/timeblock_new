/**
 * timeBlockVisibility.ts
 *
 * @role 타임블록 표시 정책 유틸리티
 * @description 현재 시간 기준으로 타임블록의 가시성을 결정하는 순수 함수들
 *
 * 사용처: ScheduleView (리스트 뷰), 추후 TimelineView 확장 가능
 */

import { TIME_BLOCKS } from '@/shared/types/domain';

type TimeBlock = (typeof TIME_BLOCKS)[number];

/**
 * 표시 정책 모드
 */
export type VisibilityMode =
  /** 모든 블록 표시 */
  | 'all'
  /** 과거 블록만 숨김 (기존 동작) */
  | 'hide-past'
  /** 미래 블록만 숨김 (현재까지: 과거+현재) */
  | 'hide-future'
  /** 현재 블록만 표시 (집중 모드) */
  | 'current-only';

/**
 * 주어진 시간(hour)에 해당하는 현재 타임블록을 반환
 *
 * @param hour 현재 시간 (0-23)
 * @returns 해당 시간대의 타임블록 또는 null (블록 범위 외)
 *
 * @example
 * getCurrentBlock(10) // { id: '8-11', label: '08:00 - 11:00', start: 8, end: 11 }
 * getCurrentBlock(4)  // null (05:00 이전)
 */
export function getCurrentBlock(hour: number): TimeBlock | null {
  return TIME_BLOCKS.find((b) => hour >= b.start && hour < b.end) ?? null;
}

/**
 * 블록이 현재 시간 기준으로 과거인지 판별
 *
 * @param block 타임블록
 * @param currentHour 현재 시간 (0-23)
 */
export function isBlockPast(block: TimeBlock, currentHour: number): boolean {
  return currentHour >= block.end;
}

/**
 * 블록이 현재 시간 기준으로 미래인지 판별
 *
 * @param block 타임블록
 * @param currentHour 현재 시간 (0-23)
 */
export function isBlockFuture(block: TimeBlock, currentHour: number): boolean {
  return currentHour < block.start;
}

/**
 * 블록이 현재 진행 중인지 판별
 *
 * @param block 타임블록
 * @param currentHour 현재 시간 (0-23)
 */
export function isBlockCurrent(block: TimeBlock, currentHour: number): boolean {
  return currentHour >= block.start && currentHour < block.end;
}

/**
 * 표시 정책에 따라 블록이 보여야 하는지 판별
 *
 * @param block 타임블록
 * @param currentHour 현재 시간 (0-23)
 * @param mode 표시 정책 모드
 */
export function shouldShowBlock(
  block: TimeBlock,
  currentHour: number,
  mode: VisibilityMode,
): boolean {
  switch (mode) {
    case 'all':
      return true;
    case 'hide-past':
      return !isBlockPast(block, currentHour);
    case 'hide-future':
      return !isBlockFuture(block, currentHour);
    case 'current-only':
      return isBlockCurrent(block, currentHour);
    default:
      return true;
  }
}

/**
 * 정책에 따라 보여야 할 블록들만 필터링
 *
 * @param currentHour 현재 시간 (0-23)
 * @param mode 표시 정책 모드
 * @returns 필터링된 블록 배열
 *
 * @example
 * // 현재 시간 10시, 현재 블록만 표시
 * getVisibleBlocks(10, 'current-only')
 * // => [{ id: '8-11', ... }]
 */
export function getVisibleBlocks(
  currentHour: number,
  mode: VisibilityMode,
): TimeBlock[] {
  return TIME_BLOCKS.filter((block) => shouldShowBlock(block, currentHour, mode));
}
