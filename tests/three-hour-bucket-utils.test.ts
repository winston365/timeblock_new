import { describe, expect, it } from 'vitest';
import {
  MAX_TASKS_PER_BUCKET,
  formatBucketRangeLabel,
  getBucketStartHour,
  getBucketStartHoursForBlock,
  getEffectiveHourSlotForBucketInBlock,
  isBucketAtCapacity,
  normalizeDropTargetHourSlot,
} from '@/features/schedule/utils/threeHourBucket';

describe('threeHourBucket utils', () => {
  it('getBucketStartHour: floors to 3-hour bucket start', () => {
    expect(getBucketStartHour(0)).toBe(0);
    expect(getBucketStartHour(1)).toBe(0);
    expect(getBucketStartHour(2)).toBe(0);
    expect(getBucketStartHour(3)).toBe(3);
    expect(getBucketStartHour(4)).toBe(3);
    expect(getBucketStartHour(5)).toBe(3);
    expect(getBucketStartHour(10)).toBe(9);
    expect(getBucketStartHour(23)).toBe(21);
  });

  it('formatBucketRangeLabel: formats bucket start/end range', () => {
    expect(formatBucketRangeLabel(0)).toBe('00:00-03:00');
    expect(formatBucketRangeLabel(9)).toBe('09:00-12:00');
    expect(formatBucketRangeLabel(21)).toBe('21:00-00:00');
  });

  it('normalizeDropTargetHourSlot: normalizes raw hour to bucket start', () => {
    expect(normalizeDropTargetHourSlot(undefined)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(null)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(10)).toBe(9);
    expect(normalizeDropTargetHourSlot(9)).toBe(9);
    expect(normalizeDropTargetHourSlot(23)).toBe(21);
    expect(normalizeDropTargetHourSlot(-1)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(24)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(Number.NaN)).toBeUndefined();
  });

  it('isBucketAtCapacity: applies MAX_TASKS_PER_BUCKET by default', () => {
    expect(MAX_TASKS_PER_BUCKET).toBe(3);
    expect(isBucketAtCapacity(0)).toBe(false);
    expect(isBucketAtCapacity(2)).toBe(false);
    expect(isBucketAtCapacity(3)).toBe(true);
    expect(isBucketAtCapacity(4)).toBe(true);
  });

  it('getBucketStartHoursForBlock: derives unique bucket starts from block hours', () => {
    expect(getBucketStartHoursForBlock(8, 11)).toEqual([6, 9]);
    expect(getBucketStartHoursForBlock(11, 14)).toEqual([9, 12]);
    expect(getBucketStartHoursForBlock(20, 23)).toEqual([18, 21]);
  });

  it('getEffectiveHourSlotForBucketInBlock: chooses an in-block hour inside the bucket range', () => {
    expect(getEffectiveHourSlotForBucketInBlock(6, 8, 11)).toBe(8);
    expect(getEffectiveHourSlotForBucketInBlock(9, 8, 11)).toBe(9);
    expect(getEffectiveHourSlotForBucketInBlock(18, 20, 23)).toBe(20);
    expect(getEffectiveHourSlotForBucketInBlock(21, 20, 23)).toBe(21);
  });
});
