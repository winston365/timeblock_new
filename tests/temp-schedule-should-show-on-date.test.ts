import { describe, expect, it } from 'vitest';

import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { shouldShowOnDate } from '@/data/repositories/tempScheduleRepository';

const makeBaseTask = (overrides: Partial<TempScheduleTask>): TempScheduleTask => {
  const nowIso = new Date('2025-12-21T10:00:00.000Z').toISOString();
  return {
    id: 't1',
    name: 'task',
    startTime: 60,
    endTime: 120,
    scheduledDate: null,
    color: '#3b82f6',
    recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
    order: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    favorite: false,
    ...overrides,
  };
};

describe('shouldShowOnDate date normalization', () => {
  it('treats scheduledDate ISO as YYYY-MM-DD for non-recurring tasks', () => {
    const task = makeBaseTask({
      scheduledDate: '2025-12-20T00:00:00.000Z',
      recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
    });

    expect(shouldShowOnDate(task, '2025-12-20')).toBe(true);
    expect(shouldShowOnDate(task, '2025-12-21')).toBe(false);
  });

  it('returns false for invalid date input', () => {
    const task = makeBaseTask({
      scheduledDate: '2025-12-20',
      recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
    });

    expect(shouldShowOnDate(task, 'not-a-date')).toBe(false);
  });
});
