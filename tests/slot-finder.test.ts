/**
 * slotFinder.test.ts
 *
 * @description slotFinder 유틸리티 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { findSuggestedSlot, type FindSlotInput, isTomorrowSlot } from '@/shared/services/schedule/slotFinder';
import type { Task, TimeBlockStates } from '@/shared/types/domain';

// ============================================================================
// Test Helpers
// ============================================================================

const createInput = (
  hour: number,
  mode: 'today' | 'tomorrow' | 'next',
  todayTasks: Task[] = [],
  todayStates?: TimeBlockStates,
  tomorrowTasks?: Task[],
): FindSlotInput => ({
  now: new Date(2025, 11, 23, hour, 0, 0), // 2025-12-23
  mode,
  today: {
    tasks: todayTasks,
    timeBlockStates: todayStates,
    dateISO: '2025-12-23',
  },
  tomorrow: tomorrowTasks !== undefined ? {
    tasks: tomorrowTasks,
    dateISO: '2025-12-24',
  } : undefined,
});

// ============================================================================
// Tests
// ============================================================================

describe('slotFinder', () => {
  describe('findSuggestedSlot', () => {
    describe('Today mode', () => {
      it('returns current block when hour is within a block', () => {
        const input = createInput(10, 'today'); // 10시 = morning 블록 (8-11)
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.dateISO).toBe('2025-12-23');
        expect(result?.blockId).toBe('morning');
        expect(result?.hourSlot).toBe(10);
        expect(result?.reason).toBe('within-current-block');
      });

      it('returns next block when current hour is after current block', () => {
        const input = createInput(11, 'today'); // 11시 = noon 블록 시작 (11-14)
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.blockId).toBe('noon');
        expect(result?.hourSlot).toBe(11);
      });

      it('falls back to tomorrow when no blocks remain today', () => {
        const input = createInput(23, 'today'); // 23시 = night 블록 끝남
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.dateISO).toBe('2025-12-24');
        expect(result?.blockId).toBe('dawn');
        expect(result?.reason).toBe('fallback-tomorrow');
      });
    });

    describe('Tomorrow mode', () => {
      it('returns first block of tomorrow', () => {
        const input = createInput(15, 'tomorrow');
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.dateISO).toBe('2025-12-24');
        expect(result?.blockId).toBe('dawn');
        expect(result?.hourSlot).toBe(5);
      });
    });

    describe('Next mode', () => {
      it('returns today slot when blocks remain', () => {
        const input = createInput(14, 'next'); // 14시 = afternoon 시작
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.dateISO).toBe('2025-12-23');
        expect(result?.blockId).toBe('afternoon');
      });

      it('falls back to tomorrow when no blocks remain today', () => {
        const input = createInput(23, 'next');
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.dateISO).toBe('2025-12-24');
        expect(result?.reason).toBe('fallback-tomorrow');
      });
    });

    describe('Locked blocks', () => {
      it('skips locked blocks by default', () => {
        const lockedStates: TimeBlockStates = {
          afternoon: { isLocked: true, isPerfect: false, isFailed: false },
        };
        const input = createInput(14, 'today', [], lockedStates);
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.blockId).not.toBe('afternoon');
        expect(result?.blockId).toBe('evening'); // 다음 잠금 안 된 블록
      });

      it('respects skipLockedBlocks=false option', () => {
        const lockedStates: TimeBlockStates = {
          afternoon: { isLocked: true, isPerfect: false, isFailed: false },
        };
        const input: FindSlotInput = {
          ...createInput(14, 'today', [], lockedStates),
          options: { skipLockedBlocks: false },
        };
        const result = findSuggestedSlot(input);

        expect(result?.blockId).toBe('afternoon');
      });
    });

    describe('Edge cases', () => {
      it('handles early morning hours (before dawn)', () => {
        const input = createInput(3, 'today'); // 3시 = dawn 이전
        const result = findSuggestedSlot(input);

        expect(result).not.toBeNull();
        expect(result?.blockId).toBe('dawn');
        expect(result?.hourSlot).toBe(5); // dawn 시작
      });

      it('returns null only when truly no slots available (should never happen in practice)', () => {
        // 모든 블록이 잠긴 경우도 내일로 폴백하므로 null은 발생하지 않음
        const allLocked: TimeBlockStates = {
          dawn: { isLocked: true, isPerfect: false, isFailed: false },
          morning: { isLocked: true, isPerfect: false, isFailed: false },
          noon: { isLocked: true, isPerfect: false, isFailed: false },
          afternoon: { isLocked: true, isPerfect: false, isFailed: false },
          evening: { isLocked: true, isPerfect: false, isFailed: false },
          night: { isLocked: true, isPerfect: false, isFailed: false },
        };
        const input = createInput(5, 'today', [], allLocked);
        const result = findSuggestedSlot(input);

        // 내일은 잠금이 없으므로 폴백
        expect(result?.dateISO).toBe('2025-12-24');
      });
    });
  });

  describe('isTomorrowSlot', () => {
    it('returns true when suggestion date differs from today', () => {
      const suggestion = {
        dateISO: '2025-12-24',
        blockId: 'dawn' as const,
        hourSlot: 5,
        label: '내일 새벽',
        reason: 'fallback-tomorrow' as const,
      };
      expect(isTomorrowSlot(suggestion, '2025-12-23')).toBe(true);
    });

    it('returns false when suggestion date matches today', () => {
      const suggestion = {
        dateISO: '2025-12-23',
        blockId: 'morning' as const,
        hourSlot: 9,
        label: '오늘 오전',
        reason: 'within-current-block' as const,
      };
      expect(isTomorrowSlot(suggestion, '2025-12-23')).toBe(false);
    });
  });
});
