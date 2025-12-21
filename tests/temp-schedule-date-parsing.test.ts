import { describe, expect, it } from 'vitest';
import { calculateWeekDates } from '@/features/tempSchedule/components/WeeklyScheduleView';

describe('tempSchedule date parsing (local-safe)', () => {
  it("calculateWeekDates should not call Date('YYYY-MM-DD') (UTC parsing risk)", () => {
    const RealDate = globalThis.Date;

    class GuardedDate extends RealDate {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        if (args.length === 1 && typeof args[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
          throw new Error("Disallowed Date('YYYY-MM-DD') constructor usage");
        }
        super(...(args as never[]));
      }

      static now = RealDate.now;
      static parse = RealDate.parse;
      static UTC = RealDate.UTC;
    }

    globalThis.Date = GuardedDate as unknown as DateConstructor;

    try {
      const dates = calculateWeekDates('2025-01-01');
      expect(dates).toHaveLength(7);
      expect(dates).toContain('2025-01-01');
      expect(dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('calculateWeekDates returns [] for invalid selectedDate', () => {
    expect(calculateWeekDates('not-a-date')).toEqual([]);
  });
});
