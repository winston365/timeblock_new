import { describe, expect, it, vi } from 'vitest';

import type { Task, TimeBlockState } from '@/shared/types/domain';
import type { TaskCompletionContext } from '@/shared/services/gameplay/taskCompletion/types';

type GameStateEvent = import('@/shared/services/gameplay/gameState').GameStateEvent;

const calculateTaskXPSpy = vi.fn((_task: unknown) => 10);
const getLocalDateSpy = vi.fn(() => '2025-01-10');
vi.mock('@/shared/lib/utils', () => ({
  calculateTaskXP: (task: unknown) => calculateTaskXPSpy(task),
  getLocalDate: () => getLocalDateSpy(),
}));

const addXPStoreSpy = vi.fn(async () => undefined);
vi.mock('@/shared/stores/gameStateStore', () => ({
  useGameStateStore: {
    getState: () => ({ addXP: addXPStoreSpy }),
  },
}));

const updateQuestProgressSpy = vi.fn(async () => undefined);
const addXPRepoSpy = vi.fn(async () => ({ events: [{ type: 'xp_gained', amount: 40, reason: 'perfect_block' }] as GameStateEvent[] }));
vi.mock('@/data/repositories/gameStateRepository', () => ({
  updateQuestProgress: updateQuestProgressSpy,
  addXP: addXPRepoSpy,
}));

const updateBlockStateSpy = vi.fn(async () => undefined);
vi.mock('@/data/repositories/dailyDataRepository', () => ({
  updateBlockState: updateBlockStateSpy,
}));

const increaseAffectionFromTaskSpy = vi.fn(async () => undefined);
vi.mock('@/data/repositories/waifuRepository', () => ({
  increaseAffectionFromTask: increaseAffectionFromTaskSpy,
}));

const recalculateGlobalGoalProgressSpy = vi.fn(async () => undefined);
vi.mock('@/data/repositories', () => ({
  recalculateGlobalGoalProgress: recalculateGlobalGoalProgressSpy,
}));

const makeTask = (overrides: Partial<Record<keyof Task, unknown>> = {}): Task =>
  ({
    id: 't1',
    text: 'task',
    memo: '',
    baseDuration: 15,
    resistance: 'low',
    adjustedDuration: 15,
    timeBlock: 'morning',
    completed: true,
    actualDuration: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    completedAt: '2025-01-01T00:00:10.000Z',
    ...overrides,
  }) as unknown as Task;

const makeContext = (overrides: Partial<TaskCompletionContext> = {}): TaskCompletionContext => {
  const task = makeTask(overrides.task as unknown as Record<string, unknown>);
  const blockState: TimeBlockState = { isLocked: true, isPerfect: false, isFailed: false };
  const blockTasks = [makeTask({ id: 'a', completed: true }), makeTask({ id: 'b', completed: true })];

  return {
    task,
    wasCompleted: false,
    date: '2025-01-10',
    blockState,
    blockTasks,
    ...overrides,
  };
};

describe('taskCompletion handlers', () => {
  it('XPRewardHandler returns [] when wasCompleted=true', async () => {
    const { XPRewardHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/xpRewardHandler'
    );

    const handler = new XPRewardHandler();
    const result = await handler.handle({ ...makeContext(), wasCompleted: true });

    expect(result).toEqual([]);
    expect(addXPStoreSpy).not.toHaveBeenCalled();
  });

  it('XPRewardHandler returns [] when xpAmount=0 (but still calls store)', async () => {
    calculateTaskXPSpy.mockReturnValueOnce(0);

    const { XPRewardHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/xpRewardHandler'
    );

    const handler = new XPRewardHandler();
    const result = await handler.handle(makeContext());

        expect(addXPStoreSpy).toHaveBeenCalledWith(0, 'morning', true);
    expect(result).toEqual([]);
  });

  it('QuestProgressHandler returns [] when wasCompleted=true, otherwise updates quests', async () => {
    const { QuestProgressHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/questProgressHandler'
    );

    const handler = new QuestProgressHandler();

    const r1 = await handler.handle({ ...makeContext(), wasCompleted: true });
    expect(r1).toEqual([]);

    updateQuestProgressSpy.mockClear();
    calculateTaskXPSpy.mockReturnValueOnce(12);

    const r2 = await handler.handle(makeContext());
    expect(r2).toEqual([]);
    expect(updateQuestProgressSpy).toHaveBeenCalledWith('complete_tasks', 1);
    expect(updateQuestProgressSpy).toHaveBeenCalledWith('earn_xp', 12);
  });

  it('WaifuAffectionHandler returns [] when wasCompleted=true, otherwise increases affection', async () => {
    const { WaifuAffectionHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/waifuAffectionHandler'
    );

    const handler = new WaifuAffectionHandler();

    const r1 = await handler.handle({ ...makeContext(), wasCompleted: true });
    expect(r1).toEqual([]);

    increaseAffectionFromTaskSpy.mockClear();

    const r2 = await handler.handle(makeContext());
    expect(r2).toEqual([]);
    expect(increaseAffectionFromTaskSpy).toHaveBeenCalledTimes(1);
  });

  it('GoalProgressHandler returns [] for ineligible contexts and swallows repo errors', async () => {
    const { GoalProgressHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler'
    );

    const handler = new GoalProgressHandler();

    const r1 = await handler.handle(makeContext({ task: makeTask({ goalId: undefined }) }));
    expect(r1).toEqual([]);

    const r2 = await handler.handle(makeContext({ task: makeTask({ goalId: 'g1', timeBlock: null }) }));
    expect(r2).toEqual([]);

    const r3 = await handler.handle(makeContext({ task: makeTask({ goalId: 'g1' }), date: '2025-01-09' }));
    expect(r3).toEqual([]);

    recalculateGlobalGoalProgressSpy.mockRejectedValueOnce(new Error('boom'));
    const r4 = await handler.handle(makeContext({ task: makeTask({ goalId: 'g1' }) }));
    expect(r4).toEqual([]);
    expect(recalculateGlobalGoalProgressSpy).toHaveBeenCalledTimes(1);
  });

  it('BlockCompletionHandler covers non-perfect branches and perfect branch', async () => {
    const { BlockCompletionHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/blockCompletionHandler'
    );

    const handler = new BlockCompletionHandler();

    await expect(handler.handle({ ...makeContext(), wasCompleted: true })).resolves.toEqual([]);

    await expect(handler.handle(makeContext({ task: makeTask({ timeBlock: null }) }))).resolves.toEqual([]);

    const unlocked: TimeBlockState = { isLocked: false, isPerfect: false, isFailed: false };
    await expect(handler.handle(makeContext({ blockState: unlocked }))).resolves.toEqual([]);

    const notAllDone = [makeTask({ id: 'a', completed: true }), makeTask({ id: 'b', completed: false })];
    await expect(handler.handle(makeContext({ blockTasks: notAllDone }))).resolves.toEqual([]);

    addXPRepoSpy.mockClear();
    updateBlockStateSpy.mockClear();
    updateQuestProgressSpy.mockClear();

    const events = await handler.handle(makeContext());
        expect(addXPRepoSpy).toHaveBeenCalledWith(40, 'morning', 'perfect_block');
        expect(updateBlockStateSpy).toHaveBeenCalledWith('morning', { isPerfect: true }, '2025-01-10');
    expect(updateQuestProgressSpy).toHaveBeenCalledWith('perfect_blocks', 1);
    expect(events.length).toBeGreaterThan(0);

    expect(handler.isPerfectBlockAchieved(makeContext())).toBe(true);
    expect(handler.isPerfectBlockAchieved(makeContext({ wasCompleted: true }))).toBe(false);
  });
});
