import { describe, expect, it } from 'vitest';
import type { BattleMission } from '@/shared/types/domain';
import { computeCurrentVisibleMissionTier } from '@/features/battle/utils/missionTier';

function makeMission(overrides: Partial<BattleMission>): BattleMission {
  const base: BattleMission = {
    id: 'm1',
    text: 't',
    damage: 10,
    order: 0,
    enabled: true,
    cooldownMinutes: 0,
    tier: 1,
    timeSlots: [],
    createdAt: '2025-12-14T00:00:00.000Z',
    updatedAt: '2025-12-14T00:00:00.000Z',
  };

  return { ...base, ...overrides };
}

describe('computeCurrentVisibleMissionTier', () => {
  it('쿨다운 미션을 1회 성공하면 다음 tier로 승급한다', () => {
    const now = new Date('2025-12-14T12:00:00.000Z');

    const missions: BattleMission[] = [
      makeMission({ id: 'cooldown_1', tier: 1, cooldownMinutes: 30 }),
      makeMission({ id: 'tier2_1', tier: 2, cooldownMinutes: 0 }),
    ];

    const before = computeCurrentVisibleMissionTier({
      missions,
      completedMissionIds: [],
      missionUsedAt: {},
      now,
    });
    expect(before).toBe(1);

    const after = computeCurrentVisibleMissionTier({
      missions,
      completedMissionIds: [],
      missionUsedAt: { cooldown_1: '2025-12-14T11:59:00.000Z' },
      now,
    });
    expect(after).toBe(2);
  });
});
