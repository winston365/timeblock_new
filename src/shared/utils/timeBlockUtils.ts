/**
 * TimeBlock Utilities
 *
 * @fileoverview 타임블록 관련 공통 유틸리티
 *
 * @role 타임블록 조회 최적화 및 패턴 표준화
 * @responsibilities
 *   - Map 캐시를 사용한 O(1) 조회
 *   - 타임블록 라벨/시간 조회 헬퍼
 *   - 현재 시간대 기반 블록 식별
 * @dependencies
 *   - domain types: TIME_BLOCKS, TimeBlockId
 */

import { TIME_BLOCKS, type TimeBlockId } from '@/shared/types/domain';

// ============================================================================
// Types
// ============================================================================

/**
 * 타임블록 데이터
 */
export type TimeBlock = typeof TIME_BLOCKS[number];

// ============================================================================
// Map Cache (O(1) 조회)
// ============================================================================

/**
 * 타임블록 ID로 인덱싱된 Map 캐시
 * Array.find()의 O(n) 대신 O(1) 조회 제공
 */
const blockMap = new Map<string, TimeBlock>(
  TIME_BLOCKS.map(block => [block.id, block])
);

const FALLBACK_BLOCK_DURATION_MINUTES = 3 * 60;

const LEGACY_TIME_BLOCK_ID_TO_CANONICAL: Readonly<Record<string, string>> = {
  '5-8': 'dawn',
  '8-11': 'morning',
  '11-14': 'noon',
  '14-17': 'afternoon',
  '17-20': 'evening',
  '20-23': 'night',
} as const;

function normalizeTimeBlockId(blockId: string): string {
  return LEGACY_TIME_BLOCK_ID_TO_CANONICAL[blockId] ?? blockId;
}

// ============================================================================
// 조회 헬퍼
// ============================================================================

/**
 * ID로 타임블록 조회 (O(1))
 *
 * @param blockId - 타임블록 ID (예: '8-11')
 * @returns TimeBlock 객체 또는 undefined
 *
 * @example
 * const block = getBlockById('8-11');
 * // { id: '8-11', label: '08:00 - 11:00', start: 8, end: 11 }
 */
export function getBlockById(blockId: TimeBlockId | string | null): TimeBlock | undefined {
  if (!blockId) return undefined;
  return blockMap.get(normalizeTimeBlockId(blockId));
}

/**
 * ID로 타임블록 라벨 조회
 *
 * @param blockId - 타임블록 ID
 * @param fallback - 찾지 못했을 때 반환할 값 (기본값: blockId 자체)
 * @returns 타임블록 라벨 또는 fallback
 *
 * @example
 * const label = getBlockLabel('8-11'); // '08:00 - 11:00'
 * const label = getBlockLabel('invalid'); // 'invalid'
 */
export function getBlockLabel(blockId: TimeBlockId | string | null, fallback?: string): string {
  if (!blockId) return fallback ?? '';
  const normalized = normalizeTimeBlockId(blockId);
  const block = blockMap.get(normalized);
  return block?.label ?? fallback ?? normalized;
}

/**
 * ID로 타임블록 시작 시간 조회
 *
 * @param blockId - 타임블록 ID
 * @returns 시작 시간 (0-23) 또는 null
 *
 * @example
 * const start = getBlockStart('8-11'); // 8
 */
export function getBlockStart(blockId: TimeBlockId | string | null): number | null {
  if (!blockId) return null;
  const block = blockMap.get(normalizeTimeBlockId(blockId));
  return block?.start ?? null;
}

/**
 * ID로 타임블록 종료 시간 조회
 *
 * @param blockId - 타임블록 ID
 * @returns 종료 시간 (0-23) 또는 null
 *
 * @example
 * const end = getBlockEnd('8-11'); // 11
 */
export function getBlockEnd(blockId: TimeBlockId | string | null): number | null {
  if (!blockId) return null;
  const block = blockMap.get(normalizeTimeBlockId(blockId));
  return block?.end ?? null;
}

/**
 * 특정 시간(hour)이 속한 타임블록 ID 반환
 *
 * @param hour - 시간 (0-23)
 * @returns 타임블록 ID 또는 null (05:00-23:00 외의 시간)
 *
 * @example
 * const blockId = getBlockIdFromHour(9); // 'morning'
 * const blockId = getBlockIdFromHour(2); // null (새벽)
 */
export function getBlockIdFromHour(hour: number): TimeBlockId {
  for (const block of TIME_BLOCKS) {
    if (hour >= block.start && hour < block.end) {
      return block.id as TimeBlockId;
    }
  }
  return null;
}

/**
 * 특정 hourSlot이 속한 타임블록 ID 반환
 * - invalid/undefined면 null
 */
export function getBlockIdFromHourSlot(hourSlot?: number | null): TimeBlockId {
  if (hourSlot === null || hourSlot === undefined) return null;
  if (typeof hourSlot !== 'number' || !Number.isFinite(hourSlot) || !Number.isInteger(hourSlot)) return null;
  if (hourSlot < 0 || hourSlot > 23) return null;
  return getBlockIdFromHour(hourSlot);
}

/**
 * 특정 시간이 속한 타임블록 객체 반환
 */
export function getBlockForHour(hour: number): TimeBlock | undefined {
  const blockId = getBlockIdFromHour(hour);
  return getBlockById(blockId);
}

/**
 * hourSlot을 TIME_BLOCKS 기준 "블록 시작 시각"으로 정규화
 * - 블록 밖이면 undefined
 */
export function normalizeHourSlotToBlockStart(hourSlot?: number | null): number | undefined {
  const blockId = getBlockIdFromHourSlot(hourSlot);
  const block = getBlockById(blockId);
  return block?.start;
}

/**
 * 작업을 TIME_BLOCKS 기준으로 분류할 때의 "효과적 timeBlock"을 계산
 * - timeBlock이 있으면 우선
 * - 없으면 hourSlot로 유추
 */
export function getEffectiveTimeBlockIdForTask(task?: { timeBlock: TimeBlockId; hourSlot?: number | null }): TimeBlockId {
  const explicit = task?.timeBlock ?? null;
  if (explicit) return normalizeTimeBlockId(explicit) as TimeBlockId;
  return getBlockIdFromHourSlot(task?.hourSlot);
}

/**
 * 현재 시간이 속한 타임블록 조회
 *
 * @returns 현재 타임블록 객체 또는 undefined
 *
 * @example
 * const currentBlock = getCurrentBlock();
 * // 오전 9시라면: { id: 'morning', label: '08:00 - 11:00', start: 8, end: 11 }
 */
export function getCurrentBlock(): TimeBlock | undefined {
  const currentBlockId = getBlockIdFromHour(new Date().getHours());
  return currentBlockId ? getBlockById(currentBlockId) : undefined;
}

/**
 * 현재 타임블록 ID 반환
 *
 * @returns 타임블록 ID 또는 null
 *
 * @example
 * const currentBlockId = getCurrentBlockId(); // 'morning'
 */
export function getCurrentBlockId(): TimeBlockId {
  return getBlockIdFromHour(new Date().getHours());
}

/**
 * 타임블록의 총 시간(분) 계산
 *
 * @param blockId - 타임블록 ID
 * @returns 분 단위 총 시간 (기본값: 180분 = 3시간)
 *
 * @example
 * const minutes = getBlockDurationMinutes('morning'); // 180
 */
export function getBlockDurationMinutes(blockId: TimeBlockId | string | null): number {
  const block = getBlockById(blockId);
  if (!block) return FALLBACK_BLOCK_DURATION_MINUTES;
  return (block.end - block.start) * 60;
}

/**
 * 타임블록의 기본 hourSlot 계산
 *
 * @param blockId - 타임블록 ID
 * @returns 블록의 시작 시간 또는 null
 *
 * @example
 * const hourSlot = getDefaultHourSlot('morning'); // 8
 */
export function getDefaultHourSlot(blockId: TimeBlockId | string | null): number | null {
  return getBlockStart(blockId);
}
