import { describe, expect, it } from 'vitest';

import type { GameState, Task } from '@/shared/types/domain';
import {
  mergeGameState,
  mergeTaskArray,
  resolveConflictLWW,
  type SyncData,
} from '@/shared/services/sync/firebase/conflictResolver';

const makeTask = (overrides: Partial<Record<keyof Task, unknown>> = {}): Task => {
  const base: Record<string, unknown> = {
    id: 't1',
    text: 'task',
    memo: '',
    baseDuration: 15,
    resistance: 'low',
    adjustedDuration: 15,
    timeBlock: null,
    completed: false,
    actualDuration: 0,
    createdAt: 0,
    completedAt: null,
  };

  return { ...base, ...overrides } as unknown as Task;
};

const makeGameState = (overrides: Partial<GameState> = {}): GameState => ({
  totalXP: 0,
  dailyXP: 0,
  availableXP: 0,
  streak: 0,
  lastLogin: '2025-01-01',
  dailyQuests: [],
  questBonusClaimed: false,
  xpHistory: [],
  timeBlockXP: {},
  timeBlockXPHistory: [],
  completedTasksHistory: [],
  dailyTimerCount: 0,
  inventory: {},
  ...overrides,
});

describe('resolveConflictLWW', () => {
  it('returns local when local.updatedAt is newer or equal', () => {
    const local: SyncData<number> = { data: 1, updatedAt: 10, deviceId: 'A' };
    const remote: SyncData<number> = { data: 2, updatedAt: 10, deviceId: 'B' };

    expect(resolveConflictLWW(local, remote)).toBe(local);
  });

  it('returns remote when remote.updatedAt is newer', () => {
    const local: SyncData<number> = { data: 1, updatedAt: 9, deviceId: 'A' };
    const remote: SyncData<number> = { data: 2, updatedAt: 10, deviceId: 'B' };

    expect(resolveConflictLWW(local, remote)).toBe(remote);
  });
});

describe('mergeGameState', () => {
  it('uses max for cumulative XP fields', () => {
    const local: SyncData<GameState> = {
      data: makeGameState({ totalXP: 10, dailyXP: 5, availableXP: 3 }),
      updatedAt: 10,
      deviceId: 'A',
    };

    const remote: SyncData<GameState> = {
      data: makeGameState({ totalXP: 8, dailyXP: 7, availableXP: 1 }),
      updatedAt: 9,
      deviceId: 'B',
    };

    const merged = mergeGameState(local, remote);

    expect(merged.data.totalXP).toBe(10);
    expect(merged.data.dailyXP).toBe(7);
    expect(merged.data.availableXP).toBe(3);
  });

  it('merges dailyQuests by id, max progress, OR completed', () => {
    const localQuest = { id: 'q1', title: 'Q', type: 'complete_tasks', target: 3, progress: 1, completed: false };
    const remoteQuest = { ...localQuest, progress: 2, completed: true };

    const local: SyncData<GameState> = {
      data: makeGameState({ dailyQuests: [localQuest as never] }),
      updatedAt: 10,
      deviceId: 'A',
    };

    const remote: SyncData<GameState> = {
      data: makeGameState({ dailyQuests: [remoteQuest as never] }),
      updatedAt: 9,
      deviceId: 'B',
    };

    const merged = mergeGameState(local, remote);
    const q1 = (merged.data.dailyQuests as unknown as Array<typeof localQuest>).find(q => q.id === 'q1');

    expect(q1?.progress).toBe(2);
    expect(q1?.completed).toBe(true);
  });

  it('merges xpHistory by date using max and keeps last 7 days', () => {
    const local: SyncData<GameState> = {
      data: makeGameState({
        xpHistory: [
          { date: '2025-01-01', xp: 1 },
          { date: '2025-01-02', xp: 10 },
        ],
      }),
      updatedAt: 10,
      deviceId: 'A',
    };

    const remote: SyncData<GameState> = {
      data: makeGameState({
        xpHistory: [
          { date: '2025-01-02', xp: 5 },
          { date: '2025-01-03', xp: 3 },
        ],
      }),
      updatedAt: 11,
      deviceId: 'B',
    };

    const merged = mergeGameState(local, remote);
    expect(merged.data.xpHistory).toEqual([
      { date: '2025-01-01', xp: 1 },
      { date: '2025-01-02', xp: 10 },
      { date: '2025-01-03', xp: 3 },
    ]);
  });

  it('uses max updatedAt and deviceId from the newer side', () => {
    const local: SyncData<GameState> = {
      data: makeGameState({ totalXP: 1 }),
      updatedAt: 10,
      deviceId: 'A',
    };

    const remote: SyncData<GameState> = {
      data: makeGameState({ totalXP: 2 }),
      updatedAt: 11,
      deviceId: 'B',
    };

    const merged = mergeGameState(local, remote);
    expect(merged.updatedAt).toBe(11);
    expect(merged.deviceId).toBe('B');
  });
});

describe('mergeTaskArray', () => {
  it('merges by id and keeps the newer task (updatedAt||createdAt)', () => {
    const older = makeTask({ id: 't1', createdAt: 1, updatedAt: 1, text: 'old' });
    const newer = makeTask({ id: 't1', createdAt: 1, updatedAt: 2, text: 'new' });

    const local: SyncData<Task[]> = { data: [newer], updatedAt: 10, deviceId: 'A' };
    const remote: SyncData<Task[]> = { data: [older], updatedAt: 9, deviceId: 'B' };

    const merged = mergeTaskArray(local, remote);

    expect(merged.data).toHaveLength(1);
    expect(merged.data[0]?.text).toBe('new');
  });

  it('sorts merged tasks by createdAt descending', () => {
    const t1 = makeTask({ id: 'a', createdAt: 1 });
    const t2 = makeTask({ id: 'b', createdAt: 2 });

    const local: SyncData<Task[]> = { data: [t1], updatedAt: 10, deviceId: 'A' };
    const remote: SyncData<Task[]> = { data: [t2], updatedAt: 9, deviceId: 'B' };

    const merged = mergeTaskArray(local, remote);

    expect(merged.data.map(t => t.id)).toEqual(['b', 'a']);
  });
});
