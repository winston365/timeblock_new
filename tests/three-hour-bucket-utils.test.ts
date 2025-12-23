import { describe, expect, it } from 'vitest';
import {
  MAX_TASKS_PER_BLOCK,
  clampHourSlotToBlock,
  formatBucketRangeLabel,
  getBucketStartHour,
  isBucketAtCapacity,
  getSuggestedHourSlotForBlock,
  normalizeDropTargetHourSlot,
} from '@/features/schedule/utils/timeBlockBucket';

import { getBlockById } from '@/shared/utils/timeBlockUtils';
import type { TimeBlockId } from '@/shared/types/domain';

describe('timeBlockBucket utils (TIME_BLOCKS 기반)', () => {
  it('getBucketStartHour: normalizes to TIME_BLOCKS block start when applicable', () => {
    expect(getBucketStartHour(0)).toBe(0);
    expect(getBucketStartHour(4)).toBe(4);
    expect(getBucketStartHour(5)).toBe(5);
    expect(getBucketStartHour(6)).toBe(5);
    expect(getBucketStartHour(7)).toBe(5);
    expect(getBucketStartHour(8)).toBe(8);
    expect(getBucketStartHour(10)).toBe(8);
    expect(getBucketStartHour(23)).toBe(23);
  });

  it('formatBucketRangeLabel: formats TIME_BLOCKS ranges for block starts', () => {
    expect(formatBucketRangeLabel(0)).toBe('00:00');
    expect(formatBucketRangeLabel(5)).toBe('05:00-08:00');
    expect(formatBucketRangeLabel(8)).toBe('08:00-11:00');
    expect(formatBucketRangeLabel(9)).toBe('09:00');
  });

  it('normalizeDropTargetHourSlot: TIME_BLOCKS 내부 hourSlot은 그대로 유지하고, 블록 밖이면 undefined', () => {
    expect(normalizeDropTargetHourSlot(undefined)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(null)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(10)).toBe(10);
    expect(normalizeDropTargetHourSlot(9)).toBe(9);
    expect(normalizeDropTargetHourSlot(23)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(-1)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(24)).toBeUndefined();
    expect(normalizeDropTargetHourSlot(Number.NaN)).toBeUndefined();
  });

  it('isBucketAtCapacity: 제한 제거 후 항상 false 반환 (무제한)', () => {
    // 제한이 제거되어 MAX_TASKS_PER_BLOCK은 Infinity
    expect(MAX_TASKS_PER_BLOCK).toBe(Infinity);
    // isBucketAtCapacity는 항상 false 반환 (무제한 배치 허용)
    expect(isBucketAtCapacity(0)).toBe(false);
    expect(isBucketAtCapacity(2)).toBe(false);
    expect(isBucketAtCapacity(3)).toBe(false);
    expect(isBucketAtCapacity(4)).toBe(false);
    expect(isBucketAtCapacity(100)).toBe(false);
    expect(isBucketAtCapacity(1000)).toBe(false);
  });

  it('clampHourSlotToBlock: 블록 밖 hourSlot을 블록 내부로 클램프한다', () => {
    const morning = 'morning' as TimeBlockId;
    const block = getBlockById(morning);
    expect(block?.start).toBe(8);
    expect(block?.end).toBe(11);

    expect(clampHourSlotToBlock(null, morning)).toBeUndefined();
    expect(clampHourSlotToBlock(7, morning)).toBe(8);
    expect(clampHourSlotToBlock(8, morning)).toBe(8);
    expect(clampHourSlotToBlock(10, morning)).toBe(10);
    expect(clampHourSlotToBlock(11, morning)).toBe(10);
  });

  it('getSuggestedHourSlotForBlock: 블록 내부 hourSlot 추천(없으면 블록 시작)', () => {
    // now 시각에 따라 달라질 수 있으므로 최소 보장만 검증
    const blockId = 'morning' as TimeBlockId;
    const block = getBlockById(blockId);
    expect(block?.start).toBe(8);

    const suggested = getSuggestedHourSlotForBlock(blockId, null);
    expect(typeof suggested === 'number' || suggested === undefined).toBe(true);
    if (suggested !== undefined) {
      expect(suggested).toBeGreaterThanOrEqual(block!.start);
      expect(suggested).toBeLessThan(block!.end);
    }
  });
});
