import type { BattleSettings } from '@/shared/types/domain';
import { getBossById } from '../data/bossData';

export function getBossXpByDifficulty(settings: BattleSettings, bossId: string): number {
  const boss = getBossById(bossId);
  const xpFromDifficulty = boss ? settings.bossDifficultyXP?.[boss.difficulty] : undefined;
  const fallbackXP = settings.bossDefeatXP ?? 0;
  return typeof xpFromDifficulty === 'number' ? xpFromDifficulty : fallbackXP;
}
