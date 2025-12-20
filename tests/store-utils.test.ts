import { describe, expect, it, vi } from 'vitest';

import type { Task } from '@/shared/types/domain';
import {
  calculateDefaultHourSlot,
  addTaskToArray,
  assertDailyDataExists,
  createBlockRollbackState,
  createFullRollbackState,
  createOptimisticBlockUpdate,
  createOptimisticTaskUpdate,
  createRollbackState,
  createUpdatedDailyData,
  findTaskOrThrow,
  removeTaskFromArray,
  sanitizeTaskUpdates,
  updateTaskInArray,
  withAsyncAction,
  withAsyncActionSafe,
  withBackgroundAction,
} from '@/shared/lib/storeUtils';

describe('storeUtils', () => {
  it('withAsyncAction manages loading and returns result', async () => {
    const set = vi.fn();
    const result = await withAsyncAction(set, async () => 123, { errorPrefix: 'X' });

    expect(result).toBe(123);
    expect(set).toHaveBeenCalledWith({ loading: true, error: null });
    expect(set).toHaveBeenCalledWith({ loading: false });
  });

  it('withAsyncAction sets error and rethrows by default', async () => {
    const set = vi.fn();

    await expect(withAsyncAction(set, async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(set).toHaveBeenCalledWith({ loading: true, error: null });
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ loading: false }));
  });

  it('withAsyncActionSafe returns undefined on error', async () => {
    const set = vi.fn();
    const result = await withAsyncActionSafe(set, async () => {
      throw new Error('boom');
    });

    expect(result).toBeUndefined();
  });

  it('withBackgroundAction does not touch loading state', async () => {
    const set = vi.fn();
    const result = await withBackgroundAction(set, async () => 1);
    expect(result).toBe(1);
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ loading: true }));
  });

  it('calculateDefaultHourSlot returns null for null timeBlock', () => {
    expect(calculateDefaultHourSlot(null)).toBeNull();
  });

  it('sanitizeTaskUpdates fills hourSlot from timeBlock when hourSlot is undefined', () => {
    const updates = sanitizeTaskUpdates({ timeBlock: 'morning', hourSlot: undefined } as unknown as Partial<Task>);
    expect(updates.hourSlot).toBe(8);
  });

  it('sanitizeTaskUpdates sets hourSlot null when moving to inbox', () => {
    const updates = sanitizeTaskUpdates({ timeBlock: null, hourSlot: undefined } as unknown as Partial<Task>);
    expect(updates.hourSlot).toBeNull();
  });

  it('createUpdatedDailyData updates updatedAt', () => {
    const now = 1234;
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);

    const base = { date: '2025-01-01', tasks: [], goals: [], timeBlockStates: {}, updatedAt: 1 };

    const updated = createUpdatedDailyData(base as unknown as never, { tasks: [] } as unknown as never);

    expect(updated.updatedAt).toBe(now);
  });

  it('updateTaskInArray updates only the matching task', () => {
    const tasks = [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ] as unknown as Task[];

    const next = updateTaskInArray(tasks, 'b', { text: 'B2' } as unknown as Partial<Task>);

    expect(next).not.toBe(tasks);
    expect(next.find((t) => t.id === 'a')?.text).toBe('A');
    expect(next.find((t) => t.id === 'b')?.text).toBe('B2');
  });

  it('addTaskToArray appends a task', () => {
    const tasks = [{ id: 'a' }] as unknown as Task[];
    const next = addTaskToArray(tasks, { id: 'b' } as unknown as Task);
    expect(next.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('removeTaskFromArray removes the matching task', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }] as unknown as Task[];
    const next = removeTaskFromArray(tasks, 'a');
    expect(next.map((t) => t.id)).toEqual(['b']);
  });

  it('createOptimisticTaskUpdate wraps updated DailyData with new tasks', () => {
    const now = 5000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);

    const base = {
      date: '2025-01-01',
      tasks: [{ id: 'a' }],
      goals: [],
      timeBlockStates: {},
      updatedAt: 1,
    };

    const result = createOptimisticTaskUpdate(base as unknown as never, [{ id: 'b' }] as unknown as Task[]);
    expect(result.dailyData.tasks[0]?.id).toBe('b');
    expect(result.dailyData.updatedAt).toBe(now);
  });

  it('createOptimisticBlockUpdate creates default block state when missing and applies updates', () => {
    const now = 6000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);

    const base = {
      date: '2025-01-01',
      tasks: [],
      goals: [],
      timeBlockStates: {},
      updatedAt: 1,
    };

    const result = createOptimisticBlockUpdate(base as unknown as never, 'morning', { isLocked: true } as never);
    expect(result.dailyData.timeBlockStates['morning']?.isLocked).toBe(true);
    expect(result.dailyData.updatedAt).toBe(now);
  });

  it('rollback helpers return updated DailyData and preserve error', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(7000);

    const base = {
      date: '2025-01-01',
      tasks: [{ id: 'a' }],
      goals: [],
      timeBlockStates: { morning: { isLocked: false, isPerfect: false, isFailed: false } },
      updatedAt: 1,
    };
    const err = new Error('x');

    const r1 = createRollbackState(base as unknown as never, [{ id: 'b' }] as unknown as Task[], err);
    expect(r1.error).toBe(err);
    expect(r1.dailyData.tasks[0]?.id).toBe('b');
    expect(r1.dailyData.updatedAt).toBe(7000);

    nowSpy.mockReturnValueOnce(8000);

    const r2 = createBlockRollbackState(
      base as unknown as never,
      { morning: { isLocked: true, isPerfect: false, isFailed: false } } as never,
      err
    );
    expect(r2.dailyData.timeBlockStates['morning']?.isLocked).toBe(true);
    expect(r2.dailyData.updatedAt).toBe(8000);

    nowSpy.mockReturnValueOnce(9000);

    const r3 = createFullRollbackState(
      base as unknown as never,
      [{ id: 'c' }] as unknown as Task[],
      { morning: { isLocked: false, isPerfect: true, isFailed: false } } as never,
      err
    );
    expect(r3.dailyData.tasks[0]?.id).toBe('c');
    expect(r3.dailyData.timeBlockStates['morning']?.isPerfect).toBe(true);
    expect(r3.dailyData.updatedAt).toBe(9000);

    nowSpy.mockRestore();
  });

  it('assertDailyDataExists throws when missing', () => {
    expect(() => assertDailyDataExists(null)).toThrow();
    expect(() => assertDailyDataExists({} as unknown as never)).not.toThrow();
  });

  it('findTaskOrThrow returns task when present and throws when missing', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }] as unknown as Task[];
    expect(findTaskOrThrow(tasks, 'b').id).toBe('b');
    expect(() => findTaskOrThrow(tasks, 'c')).toThrow('Task not found');
  });
});
