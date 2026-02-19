import type { BattleMission, BattleSettings, DailyBattleState } from '@/shared/types/domain';
import { sanitizeTaskCompletionDamageRules_core } from './taskCompletionDamage';

import { getBossXpByDifficulty } from './xp';
import { isMissionAvailable } from './missionLogic';

export const computeUpdatedSettings_core = (settings: BattleSettings, updates: Partial<BattleSettings>) => {
  const mergedDifficultyXP = updates.bossDifficultyXP
    ? { ...settings.bossDifficultyXP, ...updates.bossDifficultyXP }
    : settings.bossDifficultyXP;

  const mergedTaskCompletionDamageRules = updates.taskCompletionDamageRules
    ? sanitizeTaskCompletionDamageRules_core(updates.taskCompletionDamageRules)
    : settings.taskCompletionDamageRules;

  return {
    ...settings,
    ...updates,
    bossDifficultyXP: mergedDifficultyXP,
    taskCompletionDamageRules: mergedTaskCompletionDamageRules,
  };
};

export const computeCompleteMissionResult_core = (
  dailyState: DailyBattleState | null,
  missions: BattleMission[],
  settings: BattleSettings,
  missionId: string,
  timestamp: string
): {
  updatedState: DailyBattleState | null;
  result: { bossDefeated: boolean; xpEarned: number; damageDealt: number; overkillDamage: number };
  defeatedBossId: string | null;
} => {
  const emptyResult = {
    updatedState: null,
    result: { bossDefeated: false, xpEarned: 0, damageDealt: 0, overkillDamage: 0 },
    defeatedBossId: null,
  };

  if (!dailyState) {
    return emptyResult;
  }

  const completedMissionIds = dailyState.completedMissionIds ?? [];
  const defeatedBossIds = dailyState.defeatedBossIds ?? [];
  const missionUsedAt = dailyState.missionUsedAt ?? {};

  const currentBoss = dailyState.bosses?.[dailyState.currentBossIndex];
  if (!currentBoss || currentBoss.defeatedAt) {
    return emptyResult;
  }

  const mission = missions.find((m) => m.id === missionId);
  if (!mission) {
    return emptyResult;
  }

  if (!isMissionAvailable(mission, completedMissionIds, missionUsedAt)) {
    return emptyResult;
  }

  const damageDealt = mission.damage;
  const newHP = Math.max(0, currentBoss.currentHP - damageDealt);
  const bossDefeated = newHP <= 0;
  const overkillDamage = bossDefeated ? Math.max(0, damageDealt - currentBoss.currentHP) : 0;
  const xpEarned = bossDefeated ? getBossXpByDifficulty(settings, currentBoss.bossId) : 0;

  const updatedBosses = [...(dailyState.bosses ?? [])];
  updatedBosses[dailyState.currentBossIndex] = {
    ...currentBoss,
    currentHP: newHP,
    completedMissions: [...(currentBoss.completedMissions ?? []), missionId],
    ...(bossDefeated ? { defeatedAt: timestamp } : {}),
  };

  const updatedState: DailyBattleState = {
    ...dailyState,
    bosses: updatedBosses,
    completedMissionIds:
      !mission.cooldownMinutes || mission.cooldownMinutes <= 0
        ? [...completedMissionIds, missionId]
        : completedMissionIds,
    missionUsedAt:
      mission.cooldownMinutes && mission.cooldownMinutes > 0
        ? { ...missionUsedAt, [missionId]: timestamp }
        : missionUsedAt,
    ...(bossDefeated
      ? {
          totalDefeated: (dailyState.totalDefeated ?? 0) + 1,
          defeatedBossIds: [...defeatedBossIds, currentBoss.bossId],
          overkillDamage: (dailyState.overkillDamage ?? 0) + overkillDamage,
        }
      : {}),
  };

  return {
    updatedState,
    result: { bossDefeated, xpEarned, damageDealt, overkillDamage },
    defeatedBossId: bossDefeated ? currentBoss.bossId : null,
  };
};
