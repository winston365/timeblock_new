/**
 * time-block-visibility.test.ts
 *
 * @description 타임블록 표시 정책 유틸리티 통합 테스트
 * @role visibility 모드(all, hide-past, hide-future, current-only)에 대한 완전한 테스트 커버리지 제공
 */

import { describe, it, expect } from 'vitest';

import {
  getCurrentBlock,
  isBlockPast,
  isBlockFuture,
  isBlockCurrent,
  shouldShowBlock,
  getVisibleBlocks,
} from '@/features/schedule/utils/timeBlockVisibility';
import { TIME_BLOCKS } from '@/shared/types/domain';

describe('timeBlockVisibility', () => {
  describe('getCurrentBlock', () => {
    it('returns correct block for morning hours', () => {
      expect(getCurrentBlock(6)?.id).toBe('dawn');
      expect(getCurrentBlock(9)?.id).toBe('morning');
      expect(getCurrentBlock(12)?.id).toBe('noon');
    });

    it('returns correct block for afternoon/evening hours', () => {
      expect(getCurrentBlock(15)?.id).toBe('afternoon');
      expect(getCurrentBlock(18)?.id).toBe('evening');
      expect(getCurrentBlock(21)?.id).toBe('night');
    });

    it('returns null for hours outside block range', () => {
      expect(getCurrentBlock(4)).toBeNull();
      expect(getCurrentBlock(23)).toBeNull();
      expect(getCurrentBlock(0)).toBeNull();
      expect(getCurrentBlock(3)).toBeNull();
    });

    it('handles block boundary hours correctly', () => {
      // Start of block - included
      expect(getCurrentBlock(5)?.id).toBe('dawn');
      expect(getCurrentBlock(8)?.id).toBe('morning');

      // End of block - excluded (next block starts)
      expect(getCurrentBlock(8)?.id).toBe('morning'); // 8 is start of morning, not end of dawn
    });

    // Edge cases: boundary hours (0, 23)
    it('handles boundary hours (0 and 23) correctly', () => {
      expect(getCurrentBlock(0)).toBeNull();
      expect(getCurrentBlock(23)).toBeNull();
    });

    // Edge cases: out-of-range hours (25, -1)
    it('returns null for out-of-range hours', () => {
      expect(getCurrentBlock(25)).toBeNull();
      expect(getCurrentBlock(-1)).toBeNull();
      expect(getCurrentBlock(100)).toBeNull();
      expect(getCurrentBlock(-100)).toBeNull();
    });

    // Edge cases: NaN and non-integer inputs
    it('handles NaN and non-integer inputs safely', () => {
      // NaN comparisons always return false, so no block matches
      expect(getCurrentBlock(NaN)).toBeNull();
      // Float values use truncated comparison (10.5 >= 8 && 10.5 < 11 = true)
      expect(getCurrentBlock(10.5)?.id).toBe('morning');
      expect(getCurrentBlock(10.999)?.id).toBe('morning');
      // Negative floats: -0.5 >= 5 is false, so no block matches
      expect(getCurrentBlock(-0.5)).toBeNull();
    });
  });

  describe('isBlockPast', () => {
    const blockMorning = TIME_BLOCKS.find((b) => b.id === 'morning')!;

    it('returns true when current hour is past block end', () => {
      expect(isBlockPast(blockMorning, 12)).toBe(true);
      expect(isBlockPast(blockMorning, 23)).toBe(true);
    });

    it('returns true when current hour equals block end', () => {
      expect(isBlockPast(blockMorning, 11)).toBe(true);
    });

    it('returns false when current hour is before block end', () => {
      expect(isBlockPast(blockMorning, 10)).toBe(false);
      expect(isBlockPast(blockMorning, 8)).toBe(false);
    });

    // Edge cases for isBlockPast
    it('handles edge cases safely', () => {
      expect(isBlockPast(blockMorning, 0)).toBe(false);
      expect(isBlockPast(blockMorning, -1)).toBe(false);
      expect(isBlockPast(blockMorning, 25)).toBe(true);
      expect(isBlockPast(blockMorning, NaN)).toBe(false);
    });
  });

  describe('isBlockFuture', () => {
    const blockAfternoon = TIME_BLOCKS.find((b) => b.id === 'afternoon')!;

    it('returns true when current hour is before block start', () => {
      expect(isBlockFuture(blockAfternoon, 10)).toBe(true);
      expect(isBlockFuture(blockAfternoon, 13)).toBe(true);
    });

    it('returns false when current hour equals block start', () => {
      expect(isBlockFuture(blockAfternoon, 14)).toBe(false);
    });

    it('returns false when current hour is within or after block', () => {
      expect(isBlockFuture(blockAfternoon, 15)).toBe(false);
      expect(isBlockFuture(blockAfternoon, 18)).toBe(false);
    });

    // Edge cases for isBlockFuture
    it('handles edge cases safely', () => {
      expect(isBlockFuture(blockAfternoon, 0)).toBe(true);
      expect(isBlockFuture(blockAfternoon, -1)).toBe(true);
      expect(isBlockFuture(blockAfternoon, 25)).toBe(false);
      expect(isBlockFuture(blockAfternoon, NaN)).toBe(false);
    });
  });

  describe('isBlockCurrent', () => {
    const blockNoon = TIME_BLOCKS.find((b) => b.id === 'noon')!;

    it('returns true when current hour is within block range', () => {
      expect(isBlockCurrent(blockNoon, 11)).toBe(true);
      expect(isBlockCurrent(blockNoon, 12)).toBe(true);
      expect(isBlockCurrent(blockNoon, 13)).toBe(true);
    });

    it('returns false when current hour is before block start', () => {
      expect(isBlockCurrent(blockNoon, 10)).toBe(false);
    });

    it('returns false when current hour equals or is past block end', () => {
      expect(isBlockCurrent(blockNoon, 14)).toBe(false);
      expect(isBlockCurrent(blockNoon, 15)).toBe(false);
    });

    // Edge cases for isBlockCurrent
    it('handles edge cases safely', () => {
      expect(isBlockCurrent(blockNoon, 0)).toBe(false);
      expect(isBlockCurrent(blockNoon, -1)).toBe(false);
      expect(isBlockCurrent(blockNoon, 25)).toBe(false);
      expect(isBlockCurrent(blockNoon, NaN)).toBe(false);
    });
  });

  describe('shouldShowBlock', () => {
    const blockMorning = TIME_BLOCKS.find((b) => b.id === 'morning')!;

    it('mode=all always returns true', () => {
      expect(shouldShowBlock(blockMorning, 6, 'all')).toBe(true);
      expect(shouldShowBlock(blockMorning, 10, 'all')).toBe(true);
      expect(shouldShowBlock(blockMorning, 15, 'all')).toBe(true);
    });

    it('mode=hide-past hides only past blocks', () => {
      expect(shouldShowBlock(blockMorning, 6, 'hide-past')).toBe(true); // future
      expect(shouldShowBlock(blockMorning, 10, 'hide-past')).toBe(true); // current
      expect(shouldShowBlock(blockMorning, 15, 'hide-past')).toBe(false); // past
    });

    it('mode=hide-future hides only future blocks', () => {
      expect(shouldShowBlock(blockMorning, 6, 'hide-future')).toBe(false); // future
      expect(shouldShowBlock(blockMorning, 10, 'hide-future')).toBe(true); // current
      expect(shouldShowBlock(blockMorning, 15, 'hide-future')).toBe(true); // past
    });

    it('mode=current-only shows only current block', () => {
      expect(shouldShowBlock(blockMorning, 6, 'current-only')).toBe(false); // future
      expect(shouldShowBlock(blockMorning, 10, 'current-only')).toBe(true); // current
      expect(shouldShowBlock(blockMorning, 15, 'current-only')).toBe(false); // past
    });

    // Edge cases for shouldShowBlock
    it('handles edge hour inputs safely', () => {
      expect(shouldShowBlock(blockMorning, 0, 'all')).toBe(true);
      expect(shouldShowBlock(blockMorning, 23, 'all')).toBe(true);
      expect(shouldShowBlock(blockMorning, -1, 'all')).toBe(true);
      expect(shouldShowBlock(blockMorning, 25, 'all')).toBe(true);
    });
  });

  describe('getVisibleBlocks', () => {
    it('mode=all returns all 6 blocks', () => {
      const blocks = getVisibleBlocks(10, 'all');
      expect(blocks).toHaveLength(6);
    });

    it('mode=hide-past filters out past blocks', () => {
      // At 15:00, blocks 5-8, 8-11, 11-14 are past
      const blocks = getVisibleBlocks(15, 'hide-past');
      expect(blocks).toHaveLength(3);
      expect(blocks.map((b) => b.id)).toEqual(['afternoon', 'evening', 'night']);
    });

    it('mode=hide-future filters out future blocks', () => {
      const currentHour = 10;
      const visible = getVisibleBlocks(currentHour, 'hide-future');

      // All visible blocks should not be future
      for (const block of visible) {
        expect(isBlockFuture(block, currentHour)).toBe(false);
      }

      // Current block should be included
      const currentBlock = getCurrentBlock(currentHour);
      expect(currentBlock).not.toBeNull();
      expect(visible.some((b) => b.id === currentBlock!.id)).toBe(true);

      // If there are future blocks, visible count should be less than total
      const hasAnyFuture = TIME_BLOCKS.some((b) => isBlockFuture(b, currentHour));
      if (hasAnyFuture) {
        expect(visible.length).toBeLessThan(TIME_BLOCKS.length);
      }

      // Past blocks should be included
      const pastIds = TIME_BLOCKS.filter((b) => isBlockPast(b, currentHour)).map((b) => b.id);
      if (pastIds.length > 0) {
        for (const id of pastIds) {
          expect(visible.some((b) => b.id === id)).toBe(true);
        }
      }
    });

    it('mode=current-only returns only one block when in range', () => {
      const blocks = getVisibleBlocks(10, 'current-only');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.id).toBe('morning');
    });

    it('mode=current-only returns empty array when outside block range', () => {
      const blocksLateNight = getVisibleBlocks(3, 'current-only');
      expect(blocksLateNight).toHaveLength(0);

      const blocksEarlyMorning = getVisibleBlocks(4, 'current-only');
      expect(blocksEarlyMorning).toHaveLength(0);

      const blocksNight = getVisibleBlocks(23, 'current-only');
      expect(blocksNight).toHaveLength(0);
    });

    // Edge cases for getVisibleBlocks
    it('handles boundary hours (0 and 23) correctly', () => {
      const blocksAt0 = getVisibleBlocks(0, 'current-only');
      expect(blocksAt0).toHaveLength(0);

      const blocksAt23 = getVisibleBlocks(23, 'current-only');
      expect(blocksAt23).toHaveLength(0);

      // mode=all should still return all blocks regardless of hour
      const allAt0 = getVisibleBlocks(0, 'all');
      expect(allAt0).toHaveLength(6);

      const allAt23 = getVisibleBlocks(23, 'all');
      expect(allAt23).toHaveLength(6);
    });

    it('handles out-of-range hours (25, -1) safely', () => {
      const blocksAt25 = getVisibleBlocks(25, 'current-only');
      expect(blocksAt25).toHaveLength(0);

      const blocksAtNeg1 = getVisibleBlocks(-1, 'current-only');
      expect(blocksAtNeg1).toHaveLength(0);

      // mode=all should still return all blocks for out-of-range hours
      const allAt25 = getVisibleBlocks(25, 'all');
      expect(allAt25).toHaveLength(6);

      const allAtNeg1 = getVisibleBlocks(-1, 'all');
      expect(allAtNeg1).toHaveLength(6);
    });

    it('handles NaN and non-integer inputs safely', () => {
      // NaN comparisons always return false, so isBlockCurrent returns false
      const blocksNaN = getVisibleBlocks(NaN, 'current-only');
      expect(blocksNaN).toHaveLength(0);

      // Float values: 10.5 is treated as-is in comparisons (10.5 >= 8 && 10.5 < 11 = true)
      const blocksFloat = getVisibleBlocks(10.5, 'current-only');
      expect(blocksFloat).toHaveLength(1);
      expect(blocksFloat[0]?.id).toBe('morning');

      // mode=all should still return all blocks
      const allNaN = getVisibleBlocks(NaN, 'all');
      expect(allNaN).toHaveLength(6);
    });
  });
});
