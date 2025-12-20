import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Task, TimeBlockState } from '@/shared/types/domain';
import type { TaskCompletionContext } from '@/shared/services/gameplay/taskCompletion/types';

vi.mock('@/shared/lib/utils', () => ({
  calculateTaskXP: () => 10,
  getLocalDate: () => '2025-01-10',
}));

const showSpy = vi.fn();
vi.mock('@/shared/stores/waifuCompanionStore', () => ({
  useWaifuCompanionStore: {
    getState: () => ({ show: showSpy }),
  },
}));

const handleEventsSpy = vi.fn(async () => undefined);
vi.mock('@/shared/services/gameplay/gameState', () => ({
  gameStateEventHandler: {
    handleEvents: handleEventsSpy,
  },
}));

const addXPSpy = vi.fn(async () => ({ events: [{ type: 'xp_gained', amount: 40, reason: 'perfect_block' }] }));
const updateQuestProgressSpy = vi.fn(async () => undefined);
vi.mock('@/data/repositories/gameStateRepository', () => ({
  addXP: addXPSpy,
  updateQuestProgress: updateQuestProgressSpy,
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

const addXPStoreSpy = vi.fn(async () => undefined);
vi.mock('@/shared/stores/gameStateStore', () => ({
  useGameStateStore: {
    getState: () => ({ addXP: addXPStoreSpy }),
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

describe('TaskCompletionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when wasCompleted=true', async () => {
    vi.resetModules();

    const { TaskCompletionService } = await import(
      '@/shared/services/gameplay/taskCompletion/taskCompletionService'
    );

    const service = new TaskCompletionService();
    const result = await service.handleTaskCompletion({
      ...makeContext(),
      wasCompleted: true,
    });

    expect(result.success).toBe(true);
    expect(result.xpGained).toBe(0);
  });

  it('runs handlers in a stable order', async () => {
    vi.resetModules();

    const handlers = await import('@/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler');
    const xpHandler = await import('@/shared/services/gameplay/taskCompletion/handlers/xpRewardHandler');
    const questHandler = await import('@/shared/services/gameplay/taskCompletion/handlers/questProgressHandler');
    const waifuHandler = await import('@/shared/services/gameplay/taskCompletion/handlers/waifuAffectionHandler');
    const blockHandler = await import('@/shared/services/gameplay/taskCompletion/handlers/blockCompletionHandler');

    const goalSpy = vi.spyOn(handlers.GoalProgressHandler.prototype, 'handle');
    const xpSpy = vi.spyOn(xpHandler.XPRewardHandler.prototype, 'handle');
    const questSpy = vi.spyOn(questHandler.QuestProgressHandler.prototype, 'handle');
    const waifuSpy = vi.spyOn(waifuHandler.WaifuAffectionHandler.prototype, 'handle');
    const blockSpy = vi.spyOn(blockHandler.BlockCompletionHandler.prototype, 'handle');

    const { TaskCompletionService } = await import(
      '@/shared/services/gameplay/taskCompletion/taskCompletionService'
    );

    const service = new TaskCompletionService();
    await service.handleTaskCompletion(makeContext());

    const order = [
      goalSpy.mock.invocationCallOrder[0],
      xpSpy.mock.invocationCallOrder[0],
      questSpy.mock.invocationCallOrder[0],
      waifuSpy.mock.invocationCallOrder[0],
      blockSpy.mock.invocationCallOrder[0],
    ];

    expect(order.every((v) => typeof v === 'number')).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('reports perfect block and triggers waifu message', async () => {
    vi.resetModules();

    const { TaskCompletionService } = await import(
      '@/shared/services/gameplay/taskCompletion/taskCompletionService'
    );

    const service = new TaskCompletionService();
    const result = await service.handleTaskCompletion(makeContext());

    expect(result.success).toBe(true);
    expect(result.isPerfectBlock).toBe(true);
    expect(result.blockBonusXP).toBe(40);
    expect(result.waifuMessage).toContain('완벽해');
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(handleEventsSpy).toHaveBeenCalledTimes(1);
  });

  it('returns success=false when a handler throws', async () => {
    vi.resetModules();

    const { GoalProgressHandler } = await import(
      '@/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler'
    );

    vi.spyOn(GoalProgressHandler.prototype, 'handle').mockRejectedValueOnce(new Error('boom'));

    const { TaskCompletionService } = await import(
      '@/shared/services/gameplay/taskCompletion/taskCompletionService'
    );

    const service = new TaskCompletionService();
    const result = await service.handleTaskCompletion(makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});
