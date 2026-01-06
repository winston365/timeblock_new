import { describe, expect, it } from 'vitest';

import type { DailyData, Task } from '@/shared/types/domain';

import { createDailyReportBase } from '@/features/insight/utils/dailySummaryReport';

const makeTask = (overrides: Partial<Task>): Task => {
  const base: Task = {
    id: 't1',
    text: 'task',
    memo: '',
    baseDuration: 10,
    resistance: 'low',
    adjustedDuration: 10,
    timeBlock: null,
    completed: false,
    actualDuration: 0,
    createdAt: '2026-01-05T00:00:00.000Z',
    completedAt: null,
  };

  return { ...base, ...overrides } as unknown as Task;
};

describe('daily summary report base builder', () => {
  it('computes XP, completion rate, and block completion correctly', () => {
    const tasks: Task[] = [
      makeTask({
        id: 'a',
        completed: true,
        actualDuration: 10,
        adjustedDuration: 0,
        resistance: 'low',
        timeBlock: 'morning',
      }),
      makeTask({
        id: 'b',
        completed: true,
        actualDuration: 0,
        adjustedDuration: 20,
        resistance: 'medium',
        timeBlock: 'night',
      }),
      makeTask({
        id: 'c',
        completed: false,
        actualDuration: 30,
        adjustedDuration: 0,
        resistance: 'high',
        timeBlock: 'morning',
      }),
    ];

    const dailyData: DailyData = {
      tasks,
      goals: [],
      timeBlockStates: {},
      updatedAt: Date.now(),
    };

    const base = createDailyReportBase('2026-01-05', dailyData);

    expect(base.overview.completedTasks).toBe(2);
    expect(base.overview.totalTasks).toBe(3);
    expect(base.overview.completionRate).toBe(67);

    // XP_PER_MINUTE=1, multipliers: low=1.0, medium=1.3
    // a: 10*1.0=10, b: round(20*1.3)=26 => total=36
    expect(base.overview.totalXP).toBe(36);

    expect(base.overview.totalBlocks).toBe(2);
    expect(base.overview.blocksCompleted).toBe(1);

    expect(base.tasks.completed).toHaveLength(2);
    expect(base.tasks.uncompleted).toHaveLength(1);
    expect(base.tasks.uncompleted[0]?.xp).toBe(48);
  });
});
