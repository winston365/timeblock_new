import { describe, expect, it } from 'vitest';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { getNextUpcomingTask, groupTasksByDate } from '@/features/tempSchedule/utils/taskGrouping';

const createTask = (overrides: Partial<TempScheduleTask>): TempScheduleTask => {
  const now = new Date().toISOString();
  return {
    id: 't1',
    name: 'Task',
    startTime: 300,
    endTime: 360,
    scheduledDate: '2026-01-05',
    color: '#3b82f6',
    recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe('taskGrouping', () => {
  it('groupTasksByDate: groups by relative date and sorts groups by sortOrder', () => {
    const baseDate = '2026-01-05';

    const tasks: TempScheduleTask[] = [
      createTask({ id: 'today-1', scheduledDate: baseDate, startTime: 600, endTime: 660 }),
      createTask({ id: 'today-2', scheduledDate: null, startTime: 300, endTime: 360 }),
      createTask({ id: 'tomorrow', scheduledDate: '2026-01-06', startTime: 300, endTime: 360 }),
      createTask({ id: 'this-week', scheduledDate: '2026-01-10', startTime: 300, endTime: 360 }),
      createTask({ id: 'later', scheduledDate: '2026-02-01', startTime: 300, endTime: 360 }),
      createTask({ id: 'past', scheduledDate: '2026-01-01', startTime: 300, endTime: 360 }),
    ];

    const groups = groupTasksByDate(tasks, baseDate);

    expect(groups.map(g => g.label)).toEqual(['오늘', '내일', '이번 주', '다가오는 일정', '지난 일정']);

    const todayGroup = groups.find(g => g.label === '오늘');
    expect(todayGroup?.tasks.map(t => t.id)).toEqual(['today-2', 'today-1']);
  });

  it('getNextUpcomingTask: returns earliest upcoming task for base date', () => {
    const baseDate = '2026-01-05';

    const tasks: TempScheduleTask[] = [
      createTask({ id: 'later', scheduledDate: baseDate, startTime: 600, endTime: 660 }),
      createTask({ id: 'soon', scheduledDate: baseDate, startTime: 480, endTime: 540 }),
      createTask({ id: 'past-today', scheduledDate: baseDate, startTime: 300, endTime: 360 }),
      createTask({ id: 'tomorrow', scheduledDate: '2026-01-06', startTime: 360, endTime: 420 }),
    ];

    expect(getNextUpcomingTask(tasks, 450, baseDate)?.id).toBe('soon');
    expect(getNextUpcomingTask(tasks, 479, baseDate)?.id).toBe('soon');
    expect(getNextUpcomingTask(tasks, 480, baseDate)?.id).toBe('later');
  });
});
