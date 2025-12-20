/**
 * timeBlockVisibility.test.ts
 *
 * @role 타임블록 표시 정책 유틸리티 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  getCurrentBlock,
  isBlockPast,
  isBlockFuture,
  isBlockCurrent,
  shouldShowBlock,
  getVisibleBlocks,
} from '../src/features/schedule/utils/timeBlockVisibility';
import { TIME_BLOCKS } from '../src/shared/types/domain';

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

    it('mode=current-only shows only current block', () => {
      expect(shouldShowBlock(blockMorning, 6, 'current-only')).toBe(false); // future
      expect(shouldShowBlock(blockMorning, 10, 'current-only')).toBe(true); // current
      expect(shouldShowBlock(blockMorning, 15, 'current-only')).toBe(false); // past
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
  });
});
