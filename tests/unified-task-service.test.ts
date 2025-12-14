import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Task } from '@/shared/types/domain';

const globalInboxGet = vi.fn();
const dailyDataGet = vi.fn();
const completedInboxGet = vi.fn();
const globalInboxToArray = vi.fn();

vi.mock('@/data/db/dexieClient', () => ({
  db: {
    globalInbox: {
      get: globalInboxGet,
      toArray: globalInboxToArray,
    },
    dailyData: {
      get: dailyDataGet,
    },
    completedInbox: {
      get: completedInboxGet,
    },
  },
}));

vi.mock('@/shared/lib/utils', () => ({
  getLocalDate: () => '2025-01-10',
}));

const updateInboxTask = vi.fn();
const deleteInboxTask = vi.fn();
const toggleInboxTaskCompletion = vi.fn();

vi.mock('@/data/repositories/inboxRepository', () => ({
  updateInboxTask,
  deleteInboxTask,
  toggleInboxTaskCompletion,
}));

const updateDailyTask = vi.fn();
const deleteDailyTask = vi.fn();
const toggleDailyTaskCompletion = vi.fn();

vi.mock('@/data/repositories/dailyDataRepository', () => ({
  updateTask: updateDailyTask,
  deleteTask: deleteDailyTask,
  toggleTaskCompletion: toggleDailyTaskCompletion,
}));

const dailyRefresh = vi.fn(async () => undefined);
vi.mock('@/shared/stores/dailyDataStore', () => ({
  useDailyDataStore: {
    getState: () => ({ refresh: dailyRefresh }),
  },
}));

const inboxRefresh = vi.fn(async () => undefined);
vi.mock('@/shared/stores/inboxStore', () => ({
  useInboxStore: {
    getState: () => ({ refresh: inboxRefresh }),
  },
}));

const makeTask = (overrides: Partial<Record<keyof Task, unknown>> = {}): Task =>
  ({
    id: 't1',
    text: 'task',
    memo: '',
    baseDuration: 15,
    resistance: 'low',
    adjustedDuration: 15,
    timeBlock: null,
    completed: false,
    actualDuration: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  }) as unknown as Task;

describe('unifiedTaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findTaskLocation returns inbox when task is in globalInbox', async () => {
    const task = makeTask();
    globalInboxGet.mockResolvedValueOnce(task);

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    const result = await findTaskLocation('t1');
    expect(result.location).toBe('inbox');
    expect(result.task?.id).toBe('t1');
  });

  it('findTaskLocation returns daily when task is in today dailyData', async () => {
    globalInboxGet.mockResolvedValueOnce(undefined);
    dailyDataGet.mockResolvedValueOnce({ tasks: [makeTask({ id: 't2', timeBlock: '8-11' })] });

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    const result = await findTaskLocation('t2');
    expect(result.location).toBe('daily');
    expect(result.date).toBe('2025-01-10');
  });

  it('findTaskLocation falls back to completedInbox when not found elsewhere', async () => {
    globalInboxGet.mockResolvedValueOnce(undefined);
    dailyDataGet.mockResolvedValue(null);
    completedInboxGet.mockResolvedValueOnce(makeTask({ id: 't2' }));

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    const result = await findTaskLocation('t2', '2025-01-10');
    expect(result.location).toBe('inbox');
    expect(result.task?.id).toBe('t2');
  });

  it('updateAnyTask updates inbox task and refreshes inboxStore unless skipped', async () => {
    const task = makeTask({ id: 't3' });
    globalInboxGet.mockResolvedValueOnce(task);

    const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

    const updated = await updateAnyTask('t3', { text: 'new' });

    expect(updateInboxTask).toHaveBeenCalledWith('t3', { text: 'new' });
    expect(inboxRefresh).toHaveBeenCalledTimes(1);
    expect(updated?.text).toBe('new');
  });

  it('updateAnyTask can skip store refresh', async () => {
    const task = makeTask({ id: 't4' });
    globalInboxGet.mockResolvedValueOnce(task);

    const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

    await updateAnyTask('t4', { text: 'new' }, undefined, { skipStoreRefresh: true });

    expect(inboxRefresh).not.toHaveBeenCalled();
  });

  it('updateAnyTask updates daily task and refreshes dailyDataStore unless skipped', async () => {
    globalInboxGet.mockResolvedValueOnce(undefined);
    dailyDataGet.mockResolvedValueOnce({ tasks: [makeTask({ id: 't5', timeBlock: '8-11' })] });

    const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

    const updated = await updateAnyTask('t5', { text: 'new' }, '2025-01-10');
    expect(updateDailyTask).toHaveBeenCalledWith('t5', { text: 'new' }, '2025-01-10');
    expect(dailyRefresh).toHaveBeenCalledTimes(1);
    expect(updated?.text).toBe('new');

    dailyRefresh.mockClear();
    globalInboxGet.mockResolvedValueOnce(undefined);
    dailyDataGet.mockResolvedValueOnce({ tasks: [makeTask({ id: 't6', timeBlock: '8-11' })] });

    await updateAnyTask('t6', { text: 'new' }, '2025-01-10', { skipStoreRefresh: true });
    expect(dailyRefresh).not.toHaveBeenCalled();
  });

  it('deleteAnyTask and toggleAnyTaskCompletion refresh stores unless skipped', async () => {
    const task = makeTask({ id: 't7' });
    globalInboxGet.mockResolvedValueOnce(task);

    const { deleteAnyTask, toggleAnyTaskCompletion } = await import('@/shared/services/task/unifiedTaskService');

    await deleteAnyTask('t7');
    expect(deleteInboxTask).toHaveBeenCalledWith('t7');
    expect(inboxRefresh).toHaveBeenCalledTimes(1);

    inboxRefresh.mockClear();

    toggleInboxTaskCompletion.mockResolvedValueOnce(makeTask({ id: 't8', completed: true }));
    globalInboxGet.mockResolvedValueOnce(makeTask({ id: 't8' }));

    const toggled = await toggleAnyTaskCompletion('t8', undefined, { skipStoreRefresh: true });
    expect(toggled?.completed).toBe(true);
    expect(inboxRefresh).not.toHaveBeenCalled();
  });

  it('wraps errors from Dexie with standard error codes', async () => {
    globalInboxGet.mockRejectedValueOnce(new Error('boom'));

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    await expect(findTaskLocation('t5')).rejects.toMatchObject({ code: 'TASK_LOCATION_FIND_FAILED' });
  });
});
