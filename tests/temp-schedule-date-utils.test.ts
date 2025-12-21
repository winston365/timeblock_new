import { describe, expect, it } from 'vitest';

import { calculateWeekDates } from '@/features/tempSchedule/components/WeeklyScheduleView';
import { calculateMonthDates } from '@/features/tempSchedule/components/MonthlyScheduleView';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

describe('tempSchedule date utils (local-safe)', () => {
  it('calculateWeekDates: selectedDate를 포함하는 7일 배열을 생성하고 YYYY-MM-DD 포맷을 유지한다', () => {
    const selectedDate = '2025-12-21';
    const dates = calculateWeekDates(selectedDate);

    expect(dates).toHaveLength(7);
    expect(dates).toContain(selectedDate);
    for (const d of dates) {
      expect(d).toMatch(YMD_RE);
    }
  });

  it('calculateWeekDates: invalid 입력이면 []를 반환한다', () => {
    expect(calculateWeekDates('2025-13-01')).toEqual([]);
    expect(calculateWeekDates('not-a-date')).toEqual([]);
  });

  it('calculateMonthDates: selectedDate를 포함하는 월 그리드 배열을 생성하고 YYYY-MM-DD 포맷을 유지한다', () => {
    const selectedDate = '2025-12-21';
    const dates = calculateMonthDates(selectedDate);

    expect(dates.length).toBeGreaterThan(0);
    expect(dates.length % 7).toBe(0);
    expect(dates).toContain(selectedDate);
    for (const d of dates) {
      expect(d).toMatch(YMD_RE);
    }
  });

  it('calculateMonthDates: invalid 입력이면 []를 반환한다', () => {
    expect(calculateMonthDates('2025-13-01')).toEqual([]);
    expect(calculateMonthDates('not-a-date')).toEqual([]);
  });
});
