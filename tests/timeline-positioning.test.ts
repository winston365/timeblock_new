import { describe, expect, it } from 'vitest';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { calculateBlockPositions } from '@/features/tempSchedule/utils/timelinePositioning';

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

describe('timelinePositioning', () => {
  it('calculateBlockPositions: assigns columns and totalColumns for overlapping tasks', () => {
    const tasks: TempScheduleTask[] = [
      createTask({ id: 'a', startTime: 300, endTime: 360 }), // 05:00-06:00
      createTask({ id: 'b', startTime: 330, endTime: 390 }), // 05:30-06:30
      createTask({ id: 'c', startTime: 390, endTime: 420 }), // 06:30-07:00 (no overlap)
    ];

    const positions = calculateBlockPositions(tasks, {
      timelineStartHour: 5,
      pixelsPerMinute: 2,
      minBlockHeightPx: 20,
    });

    const posA = positions.find(p => p.task.id === 'a');
    const posB = positions.find(p => p.task.id === 'b');
    const posC = positions.find(p => p.task.id === 'c');

    expect(posA).toBeTruthy();
    expect(posB).toBeTruthy();
    expect(posC).toBeTruthy();

    expect(posA!.column).toBe(0);
    expect(posB!.column).toBe(1);
    expect(posA!.totalColumns).toBe(2);
    expect(posB!.totalColumns).toBe(2);

    expect(posA!.top).toBe(0);
    expect(posA!.height).toBe(120);

    expect(posC!.column).toBe(0);
    expect(posC!.totalColumns).toBe(1);
  });

  it('calculateBlockPositions: enforces minBlockHeightPx', () => {
    const tasks: TempScheduleTask[] = [
      createTask({ id: 'short', startTime: 300, endTime: 305 }), // 5min
    ];

    const positions = calculateBlockPositions(tasks, {
      timelineStartHour: 5,
      pixelsPerMinute: 2,
      minBlockHeightPx: 20,
    });

    expect(positions).toHaveLength(1);
    expect(positions[0]?.height).toBe(20);
  });
});
