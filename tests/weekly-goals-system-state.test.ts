import { describe, it, expect, beforeEach } from 'vitest';
import {
  deleteSystemState,
  getSystemState,
  setSystemState,
  SYSTEM_KEYS,
} from '@/data/repositories/systemRepository';

type CatchUpSnoozeState = {
  readonly snoozeUntil: string | null;
  readonly dismissedDate: string | null;
};

type QuotaAchievedState = {
  readonly date: string;
  readonly achievedGoalIds: string[];
};

describe('systemRepository: weekly-goals UX keys', () => {
  beforeEach(async () => {
    await deleteSystemState(SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS);
    await deleteSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);
  });

  it('QUOTA_ACHIEVED_GOALS: stores and loads structured state', async () => {
    const initial: QuotaAchievedState = {
      date: '2025-12-23',
      achievedGoalIds: ['g1', 'g2'],
    };

    await setSystemState(SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS, initial);
    const stored = await getSystemState<QuotaAchievedState>(SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS);

    expect(stored).toEqual(initial);
  });

  it('CATCH_UP_SNOOZE_STATE: supports overwrite updates', async () => {
    const first: CatchUpSnoozeState = {
      snoozeUntil: new Date('2025-12-23T10:00:00.000Z').toISOString(),
      dismissedDate: null,
    };

    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, first);

    const second: CatchUpSnoozeState = {
      snoozeUntil: null,
      dismissedDate: '2025-12-23',
    };

    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, second);

    const stored = await getSystemState<CatchUpSnoozeState>(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);
    expect(stored).toEqual(second);
  });

  it('deleteSystemState removes keys (returns undefined)', async () => {
    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      snoozeUntil: null,
      dismissedDate: '2025-12-23',
    } satisfies CatchUpSnoozeState);

    await deleteSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);

    const stored = await getSystemState<CatchUpSnoozeState>(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);
    expect(stored).toBeUndefined();
  });
});
