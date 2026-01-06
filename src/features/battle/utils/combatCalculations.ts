import type { BattleSettings, BossDifficulty } from '@/shared/types/domain';

/**
 * 보스 HP를 계산합니다. (난이도별 XP의 절반)
 *
 * @param difficulty - 보스 난이도
 * @param settings - 전투 설정
 * @returns HP (분 단위)
 */
export const computeBossHP = (difficulty: BossDifficulty, settings: BattleSettings): number => {
  const xp = settings.bossDifficultyXP[difficulty];
  return Math.floor(xp * 0.5);
};
