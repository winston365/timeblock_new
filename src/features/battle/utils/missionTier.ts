import type { BattleMission } from '@/shared/types/domain';
import { MISSION_TIER_DEFAULT, shouldShowMissionByTime } from '@/features/battle/constants/battleConstants';

function getTier(mission: BattleMission): number {
  return mission.tier ?? MISSION_TIER_DEFAULT;
}

function hasMissionBeenCompletedForTierProgression(
  mission: BattleMission,
  completedMissionIds: string[],
  missionUsedAt: Record<string, string> | undefined,
): boolean {
  const cooldownMinutes = mission.cooldownMinutes ?? 0;
  if (cooldownMinutes > 0) {
    return Boolean(missionUsedAt?.[mission.id]);
  }

  return completedMissionIds.includes(mission.id);
}

/**
 * 현재 UI에서 보여줘야 하는 미션 tier를 계산합니다.
 *
 * 규칙:
 * - tier는 낮을수록 먼저 표시
 * - 같은 tier의 미션들이 '오늘 기준'으로 모두 완료되어야 다음 tier가 표시
 * - 쿨다운 미션은 "오늘 1회 이상 사용"(missionUsedAt 기록) 시 완료로 간주
 */
export function computeCurrentVisibleMissionTier(params: {
  missions: BattleMission[];
  completedMissionIds: string[];
  missionUsedAt: Record<string, string> | undefined;
  now: Date;
}): number {
  const { missions, completedMissionIds, missionUsedAt, now } = params;

  const enabledMissions = missions.filter(
    (m) => m.enabled && shouldShowMissionByTime(m.timeSlots, now),
  );
  if (enabledMissions.length === 0) return MISSION_TIER_DEFAULT;

  const allTiers = [...new Set(enabledMissions.map(getTier))].sort((a, b) => a - b);

  for (const tier of allTiers) {
    const tierMissions = enabledMissions.filter((m) => getTier(m) === tier);

    const hasIncomplete = tierMissions.some(
      (m) => !hasMissionBeenCompletedForTierProgression(m, completedMissionIds, missionUsedAt),
    );

    if (hasIncomplete) {
      return tier;
    }
  }

  return allTiers[allTiers.length - 1] ?? MISSION_TIER_DEFAULT;
}
