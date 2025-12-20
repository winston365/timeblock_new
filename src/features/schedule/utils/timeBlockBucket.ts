import type { TimeBlockId } from '@/shared/types/domain';
import { getBlockById, getBlockIdFromHour, getBlockIdFromHourSlot } from '@/shared/utils/timeBlockUtils';

export const MAX_TASKS_PER_BLOCK = 3;
// Backward compatibility (기존 import 정리 전까지 유지)
export const MAX_TASKS_PER_BUCKET = MAX_TASKS_PER_BLOCK;

export function isBucketAtCapacity(taskCount: number, maxPerBucket: number = MAX_TASKS_PER_BLOCK): boolean {
  return taskCount >= maxPerBucket;
}

function isValidHour(hour: number): boolean {
  return Number.isFinite(hour) && Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * TIME_BLOCKS 기준으로 hourSlot이 "유효한 타임블록 범위"에 속하는지 검증한다.
 * - 타임블록 밖(야간/other)이면 undefined
 * - 저장 값(hourSlot)을 블록 시작 시각으로 강제 스냅하지 않는다.
 */
export function normalizeDropTargetHourSlot(hourSlot?: number | null): number | undefined {
  if (hourSlot === null || hourSlot === undefined) return undefined;
  if (typeof hourSlot !== 'number' || !Number.isFinite(hourSlot) || !Number.isInteger(hourSlot)) return undefined;
  if (!isValidHour(hourSlot)) return undefined;

  const blockId = getBlockIdFromHourSlot(hourSlot);
  return blockId ? hourSlot : undefined;
}

/**
 * 특정 타임블록 안으로 hourSlot을 안전하게 "클램프"한다.
 * - hourSlot이 블록 범위 밖이면 가장 가까운 블록 내부 hour로 조정
 * - hourSlot이 없거나 블록이 없으면 undefined
 */
export function clampHourSlotToBlock(hourSlot: number | null | undefined, blockId: TimeBlockId): number | undefined {
  if (hourSlot === null || hourSlot === undefined) return undefined;
  if (typeof hourSlot !== 'number' || !Number.isFinite(hourSlot) || !Number.isInteger(hourSlot)) return undefined;
  if (!isValidHour(hourSlot)) return undefined;

  const block = getBlockById(blockId);
  if (!block) return undefined;

  if (hourSlot < block.start) return block.start;
  if (hourSlot >= block.end) return Math.max(block.start, block.end - 1);
  return hourSlot;
}

/**
 * 타임블록에 새 작업을 만들 때 hourSlot을 추천한다.
 * - preferredHourSlot(보통 현재 시각)이 블록 내부면 그대로 사용
 * - 아니면 현재 시각이 블록 내부면 사용
 * - 둘 다 아니면 블록 시작 시각 사용
 */
export function getSuggestedHourSlotForBlock(blockId: TimeBlockId, preferredHourSlot?: number | null): number | undefined {
  const block = getBlockById(blockId);
  if (!block) return undefined;

  const preferred = clampHourSlotToBlock(preferredHourSlot ?? undefined, blockId);
  if (preferred !== undefined) return preferred;

  const nowHour = new Date().getHours();
  const now = clampHourSlotToBlock(nowHour, blockId);
  if (now !== undefined) return now;

  return block.start;
}

/**
 * 주어진 hour가 속한 TIME_BLOCK의 시작 시각을 반환한다.
 * - 블록 밖이면 입력 hour 그대로 반환(소비자에서 제외/폴백 처리)
 */
export function getBucketStartHour(hour: number): number {
  if (!isValidHour(hour)) return hour;
  const blockId = getBlockIdFromHour(hour);
  const block = getBlockById(blockId);
  return block?.start ?? hour;
}

export function getBucketEndHour(bucketStartHour: number): number {
  const blockId = getBlockIdFromHour(bucketStartHour);
  const block = getBlockById(blockId);
  if (block?.start === bucketStartHour) return block.end;
  return bucketStartHour + 3;
}

/**
 * TIME_BLOCKS 라벨 기반 범위 라벨.
 * - 기존 API 호환을 위해 함수명은 유지(버킷=타임블럭)
 */
export function formatBucketRangeLabel(bucketStartHour: number): string {
  const blockId = getBlockIdFromHour(bucketStartHour);
  const block = getBlockById(blockId);
  if (block?.start === bucketStartHour) {
    return `${pad2(block.start)}:00-${pad2(block.end)}:00`;
  }
  return `${pad2(bucketStartHour)}:00`;
}

export interface HasHourSlot {
  hourSlot?: number;
}

export function countItemsInBucket<T extends HasHourSlot>(items: readonly T[], bucketStartHour: number): number {
  return items.filter((item) => {
    const hourSlot = item?.hourSlot;
    if (typeof hourSlot !== 'number') return false;
    if (!isValidHour(hourSlot)) return false;
    return getBucketStartHour(hourSlot) === bucketStartHour;
  }).length;
}

export const BUCKET_TOTAL_MINUTES = 3 * 60;
