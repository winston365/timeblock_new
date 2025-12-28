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

// ============================================================================
// Task 5.3: 전략별 충돌 해결 결정성 테스트
// ============================================================================
describe('Conflict Resolution Determinism (Task 5.3)', () => {
  describe('resolveConflictLWW determinism', () => {
    it('is deterministic: same inputs always produce same output', () => {
      const local: SyncData<string> = { data: 'local', updatedAt: 100, deviceId: 'A' };
      const remote: SyncData<string> = { data: 'remote', updatedAt: 99, deviceId: 'B' };

      // 동일 입력에 대해 항상 동일 결과
      const result1 = resolveConflictLWW(local, remote);
      const result2 = resolveConflictLWW(local, remote);
      const result3 = resolveConflictLWW(local, remote);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1.data).toBe('local');
    });

    it('tie-breaker: equal timestamps favor local (>=)', () => {
      const local: SyncData<string> = { data: 'local', updatedAt: 100, deviceId: 'A' };
      const remote: SyncData<string> = { data: 'remote', updatedAt: 100, deviceId: 'B' };

      const result = resolveConflictLWW(local, remote);

      // 동점일 때 local 선택 (>= 조건)
      expect(result).toBe(local);
      expect(result.data).toBe('local');
    });

    it('commutative check: order of arguments matters (local always first)', () => {
      const dataA: SyncData<string> = { data: 'A', updatedAt: 100, deviceId: 'A' };
      const dataB: SyncData<string> = { data: 'B', updatedAt: 99, deviceId: 'B' };

      // A가 local일 때
      const resultAB = resolveConflictLWW(dataA, dataB);
      expect(resultAB.data).toBe('A'); // A가 더 최신

      // B가 local일 때 (순서 바뀜)
      const resultBA = resolveConflictLWW(dataB, dataA);
      expect(resultBA.data).toBe('A'); // 여전히 A가 더 최신
    });
  });

  describe('mergeGameState determinism', () => {
    it('is deterministic: same inputs always produce same merged output', () => {
      const local: SyncData<GameState> = {
        data: makeGameState({ totalXP: 100, dailyXP: 50, availableXP: 25 }),
        updatedAt: 10,
        deviceId: 'A',
      };
      const remote: SyncData<GameState> = {
        data: makeGameState({ totalXP: 80, dailyXP: 60, availableXP: 20 }),
        updatedAt: 9,
        deviceId: 'B',
      };

      const result1 = mergeGameState(local, remote);
      const result2 = mergeGameState(local, remote);

      expect(result1.data.totalXP).toBe(result2.data.totalXP);
      expect(result1.data.dailyXP).toBe(result2.data.dailyXP);
      expect(result1.data.availableXP).toBe(result2.data.availableXP);
    });

    it('uses max for all cumulative fields regardless of which side is newer', () => {
      const local: SyncData<GameState> = {
        data: makeGameState({ totalXP: 50, dailyXP: 100, availableXP: 10 }),
        updatedAt: 5,
        deviceId: 'A',
      };
      const remote: SyncData<GameState> = {
        data: makeGameState({ totalXP: 100, dailyXP: 50, availableXP: 20 }),
        updatedAt: 10,
        deviceId: 'B',
      };

      const merged = mergeGameState(local, remote);

      // 모든 누적 필드에서 최대값 사용
      expect(merged.data.totalXP).toBe(100);  // remote가 더 높음
      expect(merged.data.dailyXP).toBe(100);  // local이 더 높음
      expect(merged.data.availableXP).toBe(20); // remote가 더 높음
      expect(merged.deviceId).toBe('B'); // remote가 더 최신
    });

    it('quest progress uses max and completed uses OR', () => {
      const quest1Local = { id: 'q1', title: 'Quest', type: 'complete_tasks', target: 5, progress: 3, completed: false };
      const quest1Remote = { id: 'q1', title: 'Quest', type: 'complete_tasks', target: 5, progress: 2, completed: true };

      const local: SyncData<GameState> = {
        data: makeGameState({ dailyQuests: [quest1Local as never] }),
        updatedAt: 10,
        deviceId: 'A',
      };
      const remote: SyncData<GameState> = {
        data: makeGameState({ dailyQuests: [quest1Remote as never] }),
        updatedAt: 9,
        deviceId: 'B',
      };

      const merged = mergeGameState(local, remote);
      const mergedQuest = (merged.data.dailyQuests as unknown as typeof quest1Local[])[0];

      expect(mergedQuest.progress).toBe(3);  // max(3, 2) = 3
      expect(mergedQuest.completed).toBe(true); // false OR true = true
    });
  });

  describe('mergeTaskArray determinism', () => {
    it('is deterministic: same inputs always produce same merged array', () => {
      const task1 = makeTask({ id: 't1', createdAt: 1, updatedAt: 10, text: 'task1' });
      const task2 = makeTask({ id: 't2', createdAt: 2, updatedAt: 20, text: 'task2' });
      const task1Updated = makeTask({ id: 't1', createdAt: 1, updatedAt: 15, text: 'task1-updated' });

      const local: SyncData<Task[]> = { data: [task1, task2], updatedAt: 100, deviceId: 'A' };
      const remote: SyncData<Task[]> = { data: [task1Updated], updatedAt: 99, deviceId: 'B' };

      const result1 = mergeTaskArray(local, remote);
      const result2 = mergeTaskArray(local, remote);

      expect(result1.data.length).toBe(result2.data.length);
      expect(result1.data.map(t => t.id)).toEqual(result2.data.map(t => t.id));
    });

    it('preserves newer task version when same id exists on both sides', () => {
      const oldVersion = makeTask({ id: 'shared', createdAt: 1, updatedAt: 5, text: 'old' });
      const newVersion = makeTask({ id: 'shared', createdAt: 1, updatedAt: 10, text: 'new' });

      const local: SyncData<Task[]> = { data: [oldVersion], updatedAt: 100, deviceId: 'A' };
      const remote: SyncData<Task[]> = { data: [newVersion], updatedAt: 100, deviceId: 'B' };

      const merged = mergeTaskArray(local, remote);

      expect(merged.data.length).toBe(1);
      expect(merged.data[0].text).toBe('new');
    });

    it('combines unique tasks from both sides', () => {
      const localOnly = makeTask({ id: 'local', createdAt: 1, text: 'local-task' });
      const remoteOnly = makeTask({ id: 'remote', createdAt: 2, text: 'remote-task' });

      const local: SyncData<Task[]> = { data: [localOnly], updatedAt: 100, deviceId: 'A' };
      const remote: SyncData<Task[]> = { data: [remoteOnly], updatedAt: 100, deviceId: 'B' };

      const merged = mergeTaskArray(local, remote);

      expect(merged.data.length).toBe(2);
      expect(merged.data.map(t => t.id).sort()).toEqual(['local', 'remote']);
    });

    it('sorts by createdAt descending for consistent ordering', () => {
      const t1 = makeTask({ id: 'a', createdAt: 1 });
      const t2 = makeTask({ id: 'b', createdAt: 3 });
      const t3 = makeTask({ id: 'c', createdAt: 2 });

      const local: SyncData<Task[]> = { data: [t1, t3], updatedAt: 100, deviceId: 'A' };
      const remote: SyncData<Task[]> = { data: [t2], updatedAt: 100, deviceId: 'B' };

      const merged = mergeTaskArray(local, remote);

      // createdAt 내림차순: 3, 2, 1 → b, c, a
      expect(merged.data.map(t => t.id)).toEqual(['b', 'c', 'a']);
    });
  });
});
