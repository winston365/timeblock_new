import { TIME_BLOCKS } from '@/shared/types/domain';
import { getBlockById, getBlockIdFromHour } from '@/shared/utils/timeBlockUtils';

export const THREE_HOUR_BUCKET_SIZE = 3;

export const BUCKET_TOTAL_MINUTES = THREE_HOUR_BUCKET_SIZE * 60;

export const MAX_TASKS_PER_BUCKET = 3;

function isValidHour(hour: number): boolean {
  return Number.isFinite(hour) && Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getBucketStartHour(hour: number): number {
  if (!isValidHour(hour)) return hour;
  const blockId = getBlockIdFromHour(hour);
  const block = getBlockById(blockId);
  return block?.start ?? hour;
}

export function getBucketEndHour(bucketStartHour: number): number {
  const block = TIME_BLOCKS.find((b) => b.start === bucketStartHour);
  return block?.end ?? (bucketStartHour + THREE_HOUR_BUCKET_SIZE);
}

export function formatBucketRangeLabel(bucketStartHour: number): string {
  const block = TIME_BLOCKS.find((b) => b.start === bucketStartHour);
  if (block) {
    return `${pad2(block.start)}:00-${pad2(block.end)}:00`;
  }
  return `${pad2(bucketStartHour)}:00`;
}

/**
 * Drop target / seed hourSlot을 '버킷 시작 시각'으로 정규화한다.
 * - UI가 1시간 단위 값을 주더라도 저장은 bucketStartHour로 통일
 * - invalid 값은 undefined로 반환
 */
export function normalizeDropTargetHourSlot(hourSlot?: number | null): number | undefined {
  if (hourSlot === null || hourSlot === undefined) return undefined;
  if (typeof hourSlot !== 'number' || !Number.isFinite(hourSlot) || !Number.isInteger(hourSlot)) {
    return undefined;
  }
  if (!isValidHour(hourSlot)) return undefined;
  const normalized = getBucketStartHour(hourSlot);
  const block = TIME_BLOCKS.find((b) => b.start === normalized);
  return block ? normalized : undefined;
}

export function isBucketAtCapacity(taskCount: number, maxPerBucket: number = MAX_TASKS_PER_BUCKET): boolean {
  return taskCount >= maxPerBucket;
}

export interface HasHourSlot {
  hourSlot?: number;
}

export function countItemsInBucket<T extends HasHourSlot>(items: readonly T[], bucketStartHour: number): number {
  return items.filter((item) => {
    const hourSlot = item.hourSlot;
    if (typeof hourSlot !== 'number') return false;
    if (!isValidHour(hourSlot)) return false;
    return getBucketStartHour(hourSlot) === bucketStartHour;
  }).length;
}

export function getBucketStartHoursForBlock(blockStartHour: number, blockEndHour: number): number[] {
  const block = TIME_BLOCKS.find((b) => b.start === blockStartHour && b.end === blockEndHour);
  return block ? [block.start] : [];
}

export function getEffectiveHourSlotForBucketInBlock(
  bucketStartHour: number,
  blockStartHour: number,
  blockEndHour: number
): number {
  const block = TIME_BLOCKS.find((b) => b.start === blockStartHour && b.end === blockEndHour);
  if (block?.start === bucketStartHour) return block.start;
  return blockStartHour;
}
