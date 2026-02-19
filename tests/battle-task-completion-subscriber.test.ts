import { beforeEach, describe, expect, it, vi } from 'vitest';

const applyTaskCompletionDamageSpy = vi.fn(async () => undefined);

vi.mock('@/features/battle/stores/battleStore', () => ({
  useBattleStore: {
    getState: () => ({
      applyTaskCompletionDamage: applyTaskCompletionDamageSpy,
    }),
  },
}));

describe('battleTaskCompletionSubscriber', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const { eventBus } = await import('@/shared/lib/eventBus');
    eventBus.clear();

    const subscriber = await import('@/shared/subscribers/battleTaskCompletionSubscriber');
    subscriber.resetBattleTaskCompletionSubscriber();
  });

  it('applies damage once for duplicated task:completed events with same taskId', async () => {
    const { eventBus } = await import('@/shared/lib/eventBus');
    const subscriber = await import('@/shared/subscribers/battleTaskCompletionSubscriber');

    subscriber.initBattleTaskCompletionSubscriber();

    eventBus.emit('task:completed', {
      taskId: 'task-1',
      xpEarned: 10,
      isPerfectBlock: false,
      adjustedDuration: 45,
    });

    eventBus.emit('task:completed', {
      taskId: 'task-1',
      xpEarned: 10,
      isPerfectBlock: false,
      adjustedDuration: 45,
    });

    await Promise.resolve();

    expect(applyTaskCompletionDamageSpy).toHaveBeenCalledTimes(1);
    expect(applyTaskCompletionDamageSpy).toHaveBeenCalledWith({
      taskId: 'task-1',
      adjustedDuration: 45,
    });
  });

  it('applies damage for different task ids', async () => {
    const { eventBus } = await import('@/shared/lib/eventBus');
    const subscriber = await import('@/shared/subscribers/battleTaskCompletionSubscriber');

    subscriber.initBattleTaskCompletionSubscriber();

    eventBus.emit('task:completed', {
      taskId: 'task-1',
      xpEarned: 10,
      isPerfectBlock: false,
      adjustedDuration: 30,
    });

    eventBus.emit('task:completed', {
      taskId: 'task-2',
      xpEarned: 15,
      isPerfectBlock: false,
      adjustedDuration: 60,
    });

    await Promise.resolve();

    expect(applyTaskCompletionDamageSpy).toHaveBeenCalledTimes(2);
  });
});
