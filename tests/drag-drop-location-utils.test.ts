import { describe, expect, it } from 'vitest';
import { useDragDropManager, type DragData } from '@/features/schedule/hooks/useDragDropManager';

describe('drag/drop location contract (bucket-normalized)', () => {
  it('treats raw-hour and bucket-start targets as the same location within the same block', () => {
    const { isSameLocation } = useDragDropManager();

    const dragData: DragData = {
      taskId: 't1',
      sourceBlockId: '8-11',
      sourceHourSlot: 10,
      sourceBucketStart: 9,
      taskData: {
        id: 't1',
        text: 'x',
        memo: '',
        baseDuration: 15,
        resistance: 'low',
        adjustedDuration: 15,
        timeBlock: '8-11',
        hourSlot: 10,
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    };

    // same block, raw hour inside same bucket
    expect(isSameLocation(dragData, '8-11', 10)).toBe(true);
    expect(isSameLocation(dragData, '8-11', 11)).toBe(true);

    // same block, bucket start explicitly
    expect(isSameLocation(dragData, '8-11', 9)).toBe(true);

    // different bucket
    expect(isSameLocation(dragData, '8-11', 12)).toBe(false);

    // different block
    expect(isSameLocation(dragData, '11-14', 10)).toBe(false);
  });
});
