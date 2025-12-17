import { describe, expect, it } from 'vitest';

import { TIME_BLOCKS } from '@/shared/types/domain';
import { getCurrentBlock, getVisibleBlocks, isBlockFuture, isBlockPast } from '@/features/schedule/utils/timeBlockVisibility';

describe('timeBlockVisibility', () => {
  it('getCurrentBlock returns null outside block range', () => {
    // TIME_BLOCKS가 05:00 시작이라는 전제에 기반 (도메인 상수)
    expect(getCurrentBlock(0)).toBeNull();
    expect(getCurrentBlock(4)).toBeNull();
  });

  it('current-only shows exactly one current block when inside range', () => {
    const currentHour = 10;
    const currentBlock = getCurrentBlock(currentHour);
    expect(currentBlock).not.toBeNull();

    const visible = getVisibleBlocks(currentHour, 'current-only');
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(currentBlock!.id);
  });

  it('hide-future hides all future blocks but keeps past+current', () => {
    const currentHour = 10;
    const visible = getVisibleBlocks(currentHour, 'hide-future');

    for (const block of visible) {
      expect(isBlockFuture(block, currentHour)).toBe(false);
    }

    // 현재 블록은 포함되어야 함
    const currentBlock = getCurrentBlock(currentHour);
    expect(currentBlock).not.toBeNull();
    expect(visible.some((b) => b.id === currentBlock!.id)).toBe(true);

    // 미래 블록이 최소 1개라도 존재하는 도메인 상수라면, 전체와 개수가 달라야 함
    const hasAnyFuture = TIME_BLOCKS.some((b) => isBlockFuture(b, currentHour));
    if (hasAnyFuture) {
      expect(visible.length).toBeLessThan(TIME_BLOCKS.length);
    }

    // 과거 블록이 있다면 포함되어야 함
    const pastIds = TIME_BLOCKS.filter((b) => isBlockPast(b, currentHour)).map((b) => b.id);
    if (pastIds.length > 0) {
      for (const id of pastIds) {
        expect(visible.some((b) => b.id === id)).toBe(true);
      }
    }
  });
});
