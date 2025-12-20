import { describe, expect, it } from 'vitest';
import { useDragDropManager, type DragData } from '@/features/schedule/hooks/useDragDropManager';

describe('drag/drop location contract (bucket-normalized)', () => {
  it('treats raw-hour and bucket-start targets as the same location within the same block', () => {
    const { isSameLocation } = useDragDropManager();

    const dragData: DragData = {
      taskId: 't1',
      sourceBlockId: 'morning',
      sourceHourSlot: 10,
      sourceBucketStart: 8,
      taskData: {
        id: 't1',
        text: 'x',
        memo: '',
        baseDuration: 15,
        resistance: 'low',
        adjustedDuration: 15,
        timeBlock: 'morning',
        hourSlot: 10,
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    };

    // same block, raw hour inside same bucket
    expect(isSameLocation(dragData, 'morning', 10)).toBe(true);
    expect(isSameLocation(dragData, 'morning', 9)).toBe(true);

    // same block, bucket start explicitly
    expect(isSameLocation(dragData, 'morning', 8)).toBe(true);

    // different bucket
    expect(isSameLocation(dragData, 'morning', 12)).toBe(false);

    // different block
    expect(isSameLocation(dragData, 'noon', 10)).toBe(false);

    // boundary hour belongs to the next block
    expect(isSameLocation(dragData, 'morning', 11)).toBe(false);
  });
});
