import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Task } from '@/shared/types/domain';

vi.mock('@/shared/lib/utils', () => ({
  getLocalDate: () => '2025-01-10',
}));

const loadDailyData = vi.fn();
const updateDailyTask = vi.fn();
const deleteDailyTask = vi.fn();
const toggleDailyTaskCompletion = vi.fn();

vi.mock('@/data/repositories/dailyDataRepository', () => ({
  loadDailyData,
  updateTask: updateDailyTask,
  deleteTask: deleteDailyTask,
  toggleTaskCompletion: toggleDailyTaskCompletion,
}));

const loadInboxTasks = vi.fn();
const getInboxTaskById = vi.fn();
const updateInboxTask = vi.fn();
const deleteInboxTask = vi.fn();
const toggleInboxTaskCompletion = vi.fn();

vi.mock('@/data/repositories/inboxRepository', () => ({
  loadInboxTasks,
  getInboxTaskById,
  updateInboxTask,
  deleteInboxTask,
  toggleInboxTaskCompletion,
}));

const dailyRefresh = vi.fn(async () => undefined);
const dailyUpdateTask = vi.fn(async () => undefined);
const dailyDeleteTask = vi.fn(async () => undefined);
const dailyToggleTaskCompletion = vi.fn(async () => undefined);

vi.mock('@/shared/stores/dailyDataStore', () => ({
  useDailyDataStore: {
    getState: () => ({
      refresh: dailyRefresh,
      updateTask: dailyUpdateTask,
      deleteTask: dailyDeleteTask,
      toggleTaskCompletion: dailyToggleTaskCompletion,
    }),
  },
}));

const inboxRefresh = vi.fn(async () => undefined);
const inboxUpdateTask = vi.fn(async () => undefined);
const inboxDeleteTask = vi.fn(async () => undefined);
const inboxToggleTaskCompletion = vi.fn(async () => undefined);

vi.mock('@/shared/stores/inboxStore', () => ({
  useInboxStore: {
    getState: () => ({
      refresh: inboxRefresh,
      updateTask: inboxUpdateTask,
      deleteTask: inboxDeleteTask,
      toggleTaskCompletion: inboxToggleTaskCompletion,
    }),
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
    loadDailyData.mockResolvedValueOnce(null);
    getInboxTaskById.mockResolvedValueOnce(task);

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    const result = await findTaskLocation('t1');
    expect(result.location).toBe('inbox');
    expect(result.task?.id).toBe('t1');
  });

  it('findTaskLocation returns daily when task is in today dailyData', async () => {
    getInboxTaskById.mockResolvedValueOnce(null); // inbox에서 못 찾음
    loadDailyData.mockResolvedValueOnce({ tasks: [makeTask({ id: 't2', timeBlock: 'morning' })] });

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    const result = await findTaskLocation('t2');
    expect(result.location).toBe('daily');
  });

  it('findTaskLocation falls back to completedInbox when not found elsewhere', async () => {
    loadDailyData.mockResolvedValue(null);
    getInboxTaskById.mockResolvedValueOnce(makeTask({ id: 't2' }));

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    const result = await findTaskLocation('t2', '2025-01-10');
    expect(result.location).toBe('inbox');
    expect(result.task?.id).toBe('t2');
  });

  it('updateAnyTask updates inbox task and refreshes inboxStore unless skipped', async () => {
    const task = makeTask({ id: 't3' });
    loadDailyData.mockResolvedValueOnce(null);
    getInboxTaskById.mockResolvedValueOnce(task);

    const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

    const updated = await updateAnyTask('t3', { text: 'new' });

    expect(updateInboxTask).toHaveBeenCalledWith('t3', { text: 'new' });
    expect(inboxRefresh).toHaveBeenCalledTimes(1);
    expect(updated?.text).toBe('new');
  });

  it('updateAnyTask can skip store refresh', async () => {
    const task = makeTask({ id: 't4' });
    loadDailyData.mockResolvedValueOnce(null);
    getInboxTaskById.mockResolvedValueOnce(task);

    const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

    await updateAnyTask('t4', { text: 'new' }, undefined, { skipStoreRefresh: true });

    expect(inboxRefresh).not.toHaveBeenCalled();
  });

  it('updateAnyTask updates daily task and refreshes dailyDataStore unless skipped', async () => {
    getInboxTaskById.mockResolvedValueOnce(null); // inbox에서 못 찾음
    loadDailyData.mockResolvedValueOnce({ tasks: [makeTask({ id: 't5', timeBlock: 'morning' })] });

    const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

    const updated = await updateAnyTask('t5', { text: 'new' });
    expect(updateDailyTask).toHaveBeenCalled();
    expect(dailyRefresh).toHaveBeenCalledTimes(1);
    expect(updated?.text).toBe('new');

    dailyRefresh.mockClear();
    getInboxTaskById.mockResolvedValueOnce(null); // inbox에서 못 찾음
    loadDailyData.mockResolvedValueOnce({ tasks: [makeTask({ id: 't6', timeBlock: 'morning' })] });

    await updateAnyTask('t6', { text: 'new' }, undefined, { skipStoreRefresh: true });
    expect(dailyRefresh).not.toHaveBeenCalled();
  });

  it('deleteAnyTask and toggleAnyTaskCompletion refresh stores unless skipped', async () => {
    const task = makeTask({ id: 't7' });
    loadDailyData.mockResolvedValueOnce(null);
    getInboxTaskById.mockResolvedValueOnce(task);

    const { deleteAnyTask, toggleAnyTaskCompletion } = await import('@/shared/services/task/unifiedTaskService');

    await deleteAnyTask('t7');
    expect(deleteInboxTask).toHaveBeenCalledWith('t7');
    expect(inboxRefresh).toHaveBeenCalledTimes(1);

    inboxRefresh.mockClear();

    toggleInboxTaskCompletion.mockResolvedValueOnce(makeTask({ id: 't8', completed: true }));
    loadDailyData.mockResolvedValueOnce(null);
    getInboxTaskById.mockResolvedValueOnce(makeTask({ id: 't8' }));

    const toggled = await toggleAnyTaskCompletion('t8', undefined, { skipStoreRefresh: true });
    expect(toggled?.completed).toBe(true);
    expect(inboxRefresh).not.toHaveBeenCalled();
  });

  it('wraps errors from repository with standard error codes', async () => {
    loadDailyData.mockRejectedValueOnce(new Error('boom'));

    const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

    await expect(findTaskLocation('t5')).rejects.toMatchObject({ code: 'TASK_LOCATION_FIND_FAILED' });
  });

  // =========================================================================
  // Task 4.1: not_found 및 에러 코드 전파 테스트
  // =========================================================================
  describe('not_found and error code propagation', () => {
    it('findTaskLocation returns not_found when task is not in inbox or dailyData', async () => {
      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValue(null); // 모든 날짜에서 null

      const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

      const result = await findTaskLocation('non-existent-task');
      expect(result.location).toBe('not_found');
      expect(result.task).toBeNull();
    });

    it('updateAnyTask returns null and logs warning when task not found', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValue(null);

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      const result = await updateAnyTask('non-existent-task', { text: 'new' });

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found'));
      consoleWarnSpy.mockRestore();
    });

    it('deleteAnyTask returns false and logs warning when task not found', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValue(null);

      const { deleteAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      const result = await deleteAnyTask('non-existent-task');

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found'));
      consoleWarnSpy.mockRestore();
    });

    it('toggleAnyTaskCompletion returns null and logs warning when task not found', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValue(null);

      const { toggleAnyTaskCompletion } = await import('@/shared/services/task/unifiedTaskService');

      const result = await toggleAnyTaskCompletion('non-existent-task');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found'));
      consoleWarnSpy.mockRestore();
    });

    it('updateAnyTask throws TASK_UPDATE_FAILED when repository fails', async () => {
      const task = makeTask({ id: 'fail-task' });
      getInboxTaskById.mockResolvedValueOnce(task);
      updateInboxTask.mockRejectedValueOnce(new Error('Repository error'));

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      await expect(updateAnyTask('fail-task', { text: 'new' })).rejects.toMatchObject({
        code: 'TASK_UPDATE_FAILED',
      });
    });

    it('deleteAnyTask throws TASK_DELETE_FAILED when repository fails', async () => {
      const task = makeTask({ id: 'fail-task' });
      getInboxTaskById.mockResolvedValueOnce(task);
      deleteInboxTask.mockRejectedValueOnce(new Error('Repository error'));

      const { deleteAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      await expect(deleteAnyTask('fail-task')).rejects.toMatchObject({
        code: 'TASK_DELETE_FAILED',
      });
    });

    it('toggleAnyTaskCompletion throws TASK_TOGGLE_COMPLETION_FAILED when repository fails', async () => {
      const task = makeTask({ id: 'fail-task' });
      getInboxTaskById.mockResolvedValueOnce(task);
      toggleInboxTaskCompletion.mockRejectedValueOnce(new Error('Repository error'));

      const { toggleAnyTaskCompletion } = await import('@/shared/services/task/unifiedTaskService');

      await expect(toggleAnyTaskCompletion('fail-task')).rejects.toMatchObject({
        code: 'TASK_TOGGLE_COMPLETION_FAILED',
      });
    });

    it('getAnyTask propagates TASK_LOCATION_FIND_FAILED when findTaskLocation fails', async () => {
      getInboxTaskById.mockRejectedValueOnce(new Error('Repository error'));

      const { getAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      // getAnyTask internally calls findTaskLocation, so errors are wrapped as TASK_LOCATION_FIND_FAILED first
      // then re-wrapped as TASK_GET_FAILED (but we see the inner error code)
      await expect(getAnyTask('some-task')).rejects.toMatchObject({
        code: 'TASK_LOCATION_FIND_FAILED',
      });
    });
  });

  // =========================================================================
  // Task 4.2: inbox vs daily 중복 ID 우선순위 및 최근 7일 fallback 검색 테스트
  // =========================================================================
  describe('inbox vs daily priority and recent 7-day fallback search', () => {
    it('inbox takes priority over daily when same ID exists in both', async () => {
      const inboxTask = makeTask({ id: 'duplicate-id', text: 'inbox version' });
      const dailyTask = makeTask({ id: 'duplicate-id', text: 'daily version', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(inboxTask);
      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });

      const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

      const result = await findTaskLocation('duplicate-id');

      expect(result.location).toBe('inbox');
      expect(result.task?.text).toBe('inbox version');
      // inbox에서 찾았으므로 dailyData 조회 없음 (이미 반환)
    });

    it('falls back to recent 7 days search when not found in inbox or today daily', async () => {
      const pastTask = makeTask({ id: 'past-task', text: 'past task' });

      getInboxTaskById.mockResolvedValueOnce(null);
      // 오늘 날짜에서는 못 찾음
      loadDailyData.mockResolvedValueOnce(null);
      // 첫 번째 과거 날짜에서 찾음
      loadDailyData.mockResolvedValueOnce({ tasks: [pastTask] });

      const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

      const result = await findTaskLocation('past-task');

      expect(result.location).toBe('daily');
      expect(result.task?.id).toBe('past-task');
      expect(result.date).toBeDefined(); // 날짜가 반환되어야 함
    });

    it('returns not_found after exhausting 7-day search', async () => {
      getInboxTaskById.mockResolvedValueOnce(null);
      // 8번 호출 (오늘 + 7일)
      loadDailyData.mockResolvedValue(null);

      const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

      const result = await findTaskLocation('really-non-existent');

      expect(result.location).toBe('not_found');
      expect(result.task).toBeNull();
    });

    it('uses dateHint to optimize daily search when provided', async () => {
      const dailyTask = makeTask({ id: 'hint-task', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });

      const { findTaskLocation } = await import('@/shared/services/task/unifiedTaskService');

      const result = await findTaskLocation('hint-task', '2025-01-05');

      expect(result.location).toBe('daily');
      expect(result.date).toBe('2025-01-05');
      expect(loadDailyData).toHaveBeenCalledWith('2025-01-05');
    });

    it('updateAnyTask works correctly with daily location using date from findTaskLocation', async () => {
      const dailyTask = makeTask({ id: 'daily-task', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });
      updateDailyTask.mockResolvedValueOnce(undefined);

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      const result = await updateAnyTask('daily-task', { text: 'updated' });

      expect(result?.text).toBe('updated');
      expect(updateDailyTask).toHaveBeenCalledWith('daily-task', { text: 'updated' }, '2025-01-10');
    });

    it('deleteAnyTask works correctly with daily location', async () => {
      const dailyTask = makeTask({ id: 'daily-delete-task', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });
      deleteDailyTask.mockResolvedValueOnce(undefined);

      const { deleteAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      const result = await deleteAnyTask('daily-delete-task');

      expect(result).toBe(true);
      expect(deleteDailyTask).toHaveBeenCalledWith('daily-delete-task', '2025-01-10');
      expect(dailyRefresh).toHaveBeenCalled();
    });

    it('toggleAnyTaskCompletion works correctly with daily location', async () => {
      const dailyTask = makeTask({ id: 'daily-toggle-task', timeBlock: 'morning', completed: false });
      const toggledTask = makeTask({ id: 'daily-toggle-task', timeBlock: 'morning', completed: true });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });
      toggleDailyTaskCompletion.mockResolvedValueOnce(toggledTask);

      const { toggleAnyTaskCompletion } = await import('@/shared/services/task/unifiedTaskService');

      const result = await toggleAnyTaskCompletion('daily-toggle-task');

      expect(result?.completed).toBe(true);
      expect(toggleDailyTaskCompletion).toHaveBeenCalledWith('daily-toggle-task', '2025-01-10');
      expect(dailyRefresh).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Task 4.3: getAllActive, getUncompleted 집계 무결성 및 빈 데이터 방어 테스트
  // =========================================================================
  describe('getAllActiveTasks and getUncompletedTasks aggregation integrity', () => {
    it('getAllActiveTasks returns combined tasks from daily and inbox', async () => {
      const dailyTask = makeTask({ id: 'd1', text: 'daily task', timeBlock: 'morning' });
      const inboxTask = makeTask({ id: 'i1', text: 'inbox task' });

      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });
      loadInboxTasks.mockResolvedValueOnce([inboxTask]);

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getAllActiveTasks();

      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toContain('d1');
      expect(result.map(t => t.id)).toContain('i1');
    });

    it('getAllActiveTasks handles null dailyData safely', async () => {
      const inboxTask = makeTask({ id: 'i1', text: 'inbox task' });

      loadDailyData.mockResolvedValueOnce(null);
      loadInboxTasks.mockResolvedValueOnce([inboxTask]);

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getAllActiveTasks();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('i1');
    });

    it('getAllActiveTasks handles undefined dailyData.tasks safely', async () => {
      const inboxTask = makeTask({ id: 'i1', text: 'inbox task' });

      loadDailyData.mockResolvedValueOnce({ tasks: undefined } as never);
      loadInboxTasks.mockResolvedValueOnce([inboxTask]);

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getAllActiveTasks();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('i1');
    });

    it('getAllActiveTasks handles empty inbox safely', async () => {
      const dailyTask = makeTask({ id: 'd1', text: 'daily task', timeBlock: 'morning' });

      loadDailyData.mockResolvedValueOnce({ tasks: [dailyTask] });
      loadInboxTasks.mockResolvedValueOnce([]);

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getAllActiveTasks();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('d1');
    });

    it('getAllActiveTasks handles both empty sources', async () => {
      loadDailyData.mockResolvedValueOnce(null);
      loadInboxTasks.mockResolvedValueOnce([]);

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getAllActiveTasks();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('getAllActiveTasks uses provided date parameter', async () => {
      loadDailyData.mockResolvedValueOnce({ tasks: [] });
      loadInboxTasks.mockResolvedValueOnce([]);

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      await getAllActiveTasks('2025-01-05');

      expect(loadDailyData).toHaveBeenCalledWith('2025-01-05');
    });

    it('getAllActiveTasks throws TASK_GET_ALL_ACTIVE_FAILED when repository fails', async () => {
      loadDailyData.mockRejectedValueOnce(new Error('Repository error'));

      const { getAllActiveTasks } = await import('@/shared/services/task/unifiedTaskService');

      await expect(getAllActiveTasks()).rejects.toMatchObject({
        code: 'TASK_GET_ALL_ACTIVE_FAILED',
      });
    });

    it('getUncompletedTasks filters out completed tasks correctly', async () => {
      const completedTask = makeTask({ id: 'd1', completed: true });
      const uncompletedTask = makeTask({ id: 'd2', completed: false });
      const inboxCompleted = makeTask({ id: 'i1', completed: true });
      const inboxUncompleted = makeTask({ id: 'i2', completed: false });

      loadDailyData.mockResolvedValueOnce({ tasks: [completedTask, uncompletedTask] });
      loadInboxTasks.mockResolvedValueOnce([inboxCompleted, inboxUncompleted]);

      const { getUncompletedTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getUncompletedTasks();

      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['d2', 'i2']);
      expect(result.every(t => !t.completed)).toBe(true);
    });

    it('getUncompletedTasks returns empty array when all tasks are completed', async () => {
      const completedTask1 = makeTask({ id: 'd1', completed: true });
      const completedTask2 = makeTask({ id: 'i1', completed: true });

      loadDailyData.mockResolvedValueOnce({ tasks: [completedTask1] });
      loadInboxTasks.mockResolvedValueOnce([completedTask2]);

      const { getUncompletedTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getUncompletedTasks();

      expect(result).toHaveLength(0);
    });

    it('getUncompletedTasks handles empty data sources', async () => {
      loadDailyData.mockResolvedValueOnce(null);
      loadInboxTasks.mockResolvedValueOnce([]);

      const { getUncompletedTasks } = await import('@/shared/services/task/unifiedTaskService');

      const result = await getUncompletedTasks();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('getUncompletedTasks uses provided date parameter', async () => {
      loadDailyData.mockResolvedValueOnce({ tasks: [] });
      loadInboxTasks.mockResolvedValueOnce([]);

      const { getUncompletedTasks } = await import('@/shared/services/task/unifiedTaskService');

      await getUncompletedTasks('2025-01-05');

      expect(loadDailyData).toHaveBeenCalledWith('2025-01-05');
    });

    // T70-05: getUncompletedTasks 에러 전파 검증
    it('getUncompletedTasks propagates error from getAllActiveTasks', async () => {
      loadDailyData.mockRejectedValueOnce(new Error('Repository failure'));

      const { getUncompletedTasks } = await import('@/shared/services/task/unifiedTaskService');

      // getUncompletedTasks는 내부적으로 getAllActiveTasks를 호출하므로
      // 동일한 에러 코드가 전파되어야 함
      await expect(getUncompletedTasks()).rejects.toMatchObject({
        code: 'TASK_GET_ALL_ACTIVE_FAILED',
      });
    });
  });

  // =========================================================================
  // Task 7.1: optimistic 옵션 동작 테스트
  // =========================================================================
  describe('optimistic option behavior', () => {
    it('updateAnyTask with optimistic=true calls store updateTask instead of repo', async () => {
      const task = makeTask({ id: 'opt-update', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [task] });

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      await updateAnyTask('opt-update', { text: 'new' }, undefined, { optimistic: true });

      // Should call store's updateTask, not repo's
      expect(dailyUpdateTask).toHaveBeenCalledWith('opt-update', { text: 'new' });
      expect(updateDailyTask).not.toHaveBeenCalled();
      expect(dailyRefresh).not.toHaveBeenCalled();
    });

    it('updateAnyTask with optimistic=true for inbox calls inbox store', async () => {
      const task = makeTask({ id: 'opt-inbox' });

      getInboxTaskById.mockResolvedValueOnce(task);

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      await updateAnyTask('opt-inbox', { text: 'new' }, undefined, { optimistic: true });

      expect(inboxUpdateTask).toHaveBeenCalledWith('opt-inbox', { text: 'new' });
      expect(updateInboxTask).not.toHaveBeenCalled();
    });

    it('deleteAnyTask with optimistic=true calls store deleteTask', async () => {
      const task = makeTask({ id: 'opt-delete', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [task] });

      const { deleteAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      await deleteAnyTask('opt-delete', undefined, { optimistic: true });

      expect(dailyDeleteTask).toHaveBeenCalledWith('opt-delete');
      expect(deleteDailyTask).not.toHaveBeenCalled();
    });

    it('toggleAnyTaskCompletion with optimistic=true calls store toggle', async () => {
      const task = makeTask({ id: 'opt-toggle', timeBlock: 'morning', completed: false });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [task] });

      const { toggleAnyTaskCompletion } = await import('@/shared/services/task/unifiedTaskService');

      const result = await toggleAnyTaskCompletion('opt-toggle', undefined, { optimistic: true });

      expect(dailyToggleTaskCompletion).toHaveBeenCalledWith('opt-toggle');
      expect(toggleDailyTaskCompletion).not.toHaveBeenCalled();
      expect(result?.completed).toBe(true); // Expected toggled state
    });

    it('optimistic mode returns expected result without waiting for repo', async () => {
      const task = makeTask({ id: 'opt-result', text: 'original', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [task] });

      const { updateAnyTask } = await import('@/shared/services/task/unifiedTaskService');

      const result = await updateAnyTask('opt-result', { text: 'updated' }, undefined, { optimistic: true });

      expect(result?.text).toBe('updated');
      expect(result?.id).toBe('opt-result');
    });
  });

  // =========================================================================
  // Task 7.4: moveInboxToBlock and moveBlockToInbox
  // =========================================================================
  describe('inbox ↔ block move functions', () => {
    it('moveInboxToBlock with optimistic=true (default) delegates to dailyDataStore', async () => {
      const task = makeTask({ id: 'move-in' });

      getInboxTaskById.mockResolvedValueOnce(task);

      const { moveInboxToBlock } = await import('@/shared/services/task/unifiedTaskService');

      const result = await moveInboxToBlock('move-in', 'morning');

      expect(result).toBe(true);
      expect(dailyUpdateTask).toHaveBeenCalledWith('move-in', { timeBlock: 'morning' });
    });

    it('moveInboxToBlock with optimistic=false uses repo directly', async () => {
      const task = makeTask({ id: 'move-in-legacy' });

      getInboxTaskById.mockResolvedValueOnce(task);
      updateInboxTask.mockResolvedValueOnce(undefined);

      const { moveInboxToBlock } = await import('@/shared/services/task/unifiedTaskService');

      const result = await moveInboxToBlock('move-in-legacy', 'morning', { optimistic: false });

      expect(result).toBe(true);
      expect(updateInboxTask).toHaveBeenCalledWith('move-in-legacy', { timeBlock: 'morning' });
      expect(inboxRefresh).toHaveBeenCalled();
      expect(dailyRefresh).toHaveBeenCalled();
    });

    it('moveBlockToInbox with optimistic=true (default) delegates to dailyDataStore', async () => {
      const task = makeTask({ id: 'move-out', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValueOnce({ tasks: [task] });

      const { moveBlockToInbox } = await import('@/shared/services/task/unifiedTaskService');

      const result = await moveBlockToInbox('move-out');

      expect(result).toBe(true);
      expect(dailyUpdateTask).toHaveBeenCalledWith('move-out', { timeBlock: null });
    });

    it('moveBlockToInbox with optimistic=false calls repo when task found', async () => {
      vi.clearAllMocks();
      vi.resetModules();
      
      // mock을 명시적으로 초기화하고 재설정
      getInboxTaskById.mockReset();
      loadDailyData.mockReset();
      updateDailyTask.mockReset();

      const task = makeTask({ id: 'move-out-legacy', timeBlock: 'morning' });

      // inbox에서 못 찾고 daily에서 찾도록 설정
      getInboxTaskById.mockResolvedValue(null);
      // dateHint로 전달할 날짜에서 task를 반환하도록 설정
      loadDailyData.mockResolvedValue({ tasks: [task] });
      updateDailyTask.mockResolvedValue(undefined);

      const { moveBlockToInbox } = await import('@/shared/services/task/unifiedTaskService');

      // dateHint를 제공하여 findTaskLocation이 해당 날짜에서 바로 task를 찾도록 함
      const result = await moveBlockToInbox('move-out-legacy', '2025-01-10', { optimistic: false });

      expect(result).toBe(true);
      expect(updateDailyTask).toHaveBeenCalledWith('move-out-legacy', { timeBlock: null }, '2025-01-10');
      expect(dailyRefresh).toHaveBeenCalled();
      expect(inboxRefresh).toHaveBeenCalled();
    });

    it('moveInboxToBlock returns false when task not in inbox (non-optimistic)', async () => {
      vi.clearAllMocks();

      // 명시적으로 inbox와 dailyData 모두에서 못 찾도록 설정
      getInboxTaskById.mockResolvedValue(null);
      loadDailyData.mockResolvedValue(null);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { moveInboxToBlock } = await import('@/shared/services/task/unifiedTaskService');

      const result = await moveInboxToBlock('not-in-inbox', 'morning', { optimistic: false });

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found in inbox'));
      consoleWarnSpy.mockRestore();
    });

    it('moveBlockToInbox returns false when task not in daily (non-optimistic)', async () => {
      getInboxTaskById.mockResolvedValueOnce(null);
      loadDailyData.mockResolvedValue(null);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { moveBlockToInbox } = await import('@/shared/services/task/unifiedTaskService');

      const result = await moveBlockToInbox('not-in-daily', undefined, { optimistic: false });

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found in daily'));
      consoleWarnSpy.mockRestore();
    });

    // T70-03: moveInboxToBlock 에러 코드 래핑 검증
    it('moveInboxToBlock throws TASK_MOVE_INBOX_TO_BLOCK_FAILED when repo fails (non-optimistic)', async () => {
      vi.clearAllMocks();

      const task = makeTask({ id: 'move-error-task' });

      getInboxTaskById.mockResolvedValue(task);
      updateInboxTask.mockRejectedValueOnce(new Error('Repository failure'));

      const { moveInboxToBlock } = await import('@/shared/services/task/unifiedTaskService');

      await expect(moveInboxToBlock('move-error-task', 'morning', { optimistic: false })).rejects.toMatchObject({
        code: 'TASK_MOVE_INBOX_TO_BLOCK_FAILED',
      });
    });

    // T70-04: moveBlockToInbox 에러 코드 래핑 검증
    it('moveBlockToInbox throws TASK_MOVE_BLOCK_TO_INBOX_FAILED when repo fails (non-optimistic)', async () => {
      vi.clearAllMocks();
      vi.resetModules();

      // mock을 명시적으로 초기화하고 재설정
      getInboxTaskById.mockReset();
      loadDailyData.mockReset();
      updateDailyTask.mockReset();

      const task = makeTask({ id: 'move-error-task-2', timeBlock: 'morning' });

      getInboxTaskById.mockResolvedValue(null);
      // dateHint로 전달할 날짜에서 task를 반환하도록 설정
      loadDailyData.mockResolvedValue({ tasks: [task] });
      updateDailyTask.mockRejectedValue(new Error('Repository failure'));

      const { moveBlockToInbox } = await import('@/shared/services/task/unifiedTaskService');

      // dateHint를 제공하여 findTaskLocation이 해당 날짜에서 바로 task를 찾도록 함
      await expect(moveBlockToInbox('move-error-task-2', '2025-01-10', { optimistic: false })).rejects.toMatchObject({
        code: 'TASK_MOVE_BLOCK_TO_INBOX_FAILED',
      });
    });
  });
});
