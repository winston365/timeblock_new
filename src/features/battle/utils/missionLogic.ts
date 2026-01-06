import type {
  BattleMission,
  BattleSettings,
  DailyBattleState,
  DailyBossProgress,
  BossDifficulty,
} from '@/shared/types/domain';

import { BOSSES, getBossById, groupBossesByDifficulty } from '../data/bossData';
import { computeBossHP } from './combatCalculations';

/**
 * 순차 진행 단계별 난이도 매핑
 * phase 0: easy, 1: normal, 2: hard(1회차), 3: hard(2회차), 4: epic, 5+: 자유선택
 */
const SEQUENTIAL_PHASE_DIFFICULTY: readonly (BossDifficulty | null)[] = [
  'easy',
  'normal',
  'hard',
  'hard',
  'epic',
  null,
];

/** 현재 순차 진행 단계에서 다음 스폰할 난이도 반환 (null이면 자유선택) */
export const getNextSequentialDifficulty = (phase: number): BossDifficulty | null => {
  if (phase >= SEQUENTIAL_PHASE_DIFFICULTY.length - 1) {
    return null;
  }
  return SEQUENTIAL_PHASE_DIFFICULTY[phase] ?? null;
};

/** 순차 진행 완료 여부 (phase 5 이상) */
export const isSequentialPhaseComplete = (phase: number | undefined): boolean => (phase ?? 0) >= 5;

export const computeDailyStateForToday_core = (dailyState: DailyBattleState | null, today: string) => {
  if (dailyState && dailyState.date === today) {
    return { dailyStateForToday: dailyState, shouldStartNewDay: false };
  }

  return { dailyStateForToday: null, shouldStartNewDay: true };
};

/** legacy 데이터에 remainingBosses가 비어 있거나 누락된 경우 풀 시스템을 복원 */
export const normalizeDailyBattleState_core = (
  dailyState: DailyBattleState
): { normalized: DailyBattleState; changed: boolean } => {
  let changed = false;

  const bosses = Array.isArray(dailyState.bosses) ? dailyState.bosses : [];
  if (!Array.isArray(dailyState.bosses)) {
    changed = true;
  }

  const defeatedBossIds = dailyState.defeatedBossIds ?? [];
  if (!dailyState.defeatedBossIds) {
    changed = true;
  }

  const completedMissionIds = dailyState.completedMissionIds ?? [];
  if (!dailyState.completedMissionIds) {
    changed = true;
  }

  const seenBossIds = new Set([...defeatedBossIds, ...bosses.map((b) => b.bossId)]);

  const existingRemaining = dailyState.remainingBosses;
  const existingRemainingTotal = existingRemaining
    ? Object.values(existingRemaining).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
    : 0;

  const totalBosses = BOSSES.length;
  const shouldRebuildPool =
    (!existingRemaining || existingRemainingTotal === 0) && seenBossIds.size < totalBosses;

  let remainingBosses: Record<BossDifficulty, string[]> =
    existingRemaining ?? { easy: [], normal: [], hard: [], epic: [] };
  if (!existingRemaining) {
    changed = true;
  }

  if (shouldRebuildPool) {
    const rebuilt = groupBossesByDifficulty();
    (Object.keys(rebuilt) as BossDifficulty[]).forEach((diff) => {
      rebuilt[diff] = rebuilt[diff].filter((id) => !seenBossIds.has(id));
    });
    remainingBosses = rebuilt;
    changed = true;
  }

  const maxIndex = Math.max(bosses.length - 1, 0);
  const currentBossIndex =
    typeof dailyState.currentBossIndex === 'number'
      ? Math.min(dailyState.currentBossIndex, maxIndex)
      : 0;
  if (currentBossIndex !== dailyState.currentBossIndex) {
    changed = true;
  }

  return {
    normalized: {
      ...dailyState,
      currentBossIndex,
      bosses,
      defeatedBossIds,
      completedMissionIds,
      remainingBosses,
    },
    changed,
  };
};

export const computeNewMission_core = (params: {
  text: string;
  damage: number;
  order: number;
  idSeed: number;
  timestamp: string;
  cooldownMinutes?: number;
  tier?: number;
}): BattleMission => {
  const { text, damage, order, idSeed, timestamp, cooldownMinutes = 0, tier = 10 } = params;
  return {
    id: `mission_${idSeed}`,
    text,
    damage,
    order,
    enabled: true,
    cooldownMinutes,
    tier,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const computeUpdatedMissions_core = (
  missions: BattleMission[],
  missionId: string,
  updates: Partial<BattleMission>,
  timestamp: string
) => missions.map((m) => (m.id === missionId ? { ...m, ...updates, updatedAt: timestamp } : m));

export const computeDeletedAndReorderedMissions_core = (missions: BattleMission[], missionId: string) => {
  const filtered = missions.filter((m) => m.id !== missionId);
  return filtered.map((m, idx) => ({ ...m, order: idx }));
};

export const computeReorderedMissions_core = (missions: BattleMission[], timestamp: string) =>
  missions.map((m, idx) => ({
    ...m,
    order: idx,
    updatedAt: timestamp,
  }));

/**
 * 보스 스폰 결과 계산 (남은 풀에서 랜덤 1마리 선택 + 오버킬 적용)
 */
export const computeSpawnBossResult_core = (
  dailyState: DailyBattleState,
  difficulty: BossDifficulty,
  settings: BattleSettings
): { updatedState: DailyBattleState | null; spawnedBossId: string | null; overkillApplied: number } => {
  const pool = dailyState.remainingBosses?.[difficulty];

  if (!pool || pool.length === 0) {
    return { updatedState: null, spawnedBossId: null, overkillApplied: 0 };
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedBossId = pool[randomIndex];
  const boss = getBossById(selectedBossId);

  if (!boss) {
    return { updatedState: null, spawnedBossId: null, overkillApplied: 0 };
  }

  const bossHP = computeBossHP(difficulty, settings);

  const overkillDamage = dailyState.overkillDamage ?? 0;
  const appliedOverkill = Math.min(overkillDamage, bossHP);
  const initialHP = Math.max(0, bossHP - overkillDamage);
  const remainingOverkill = Math.max(0, overkillDamage - bossHP);

  const updatedRemainingBosses = {
    ...dailyState.remainingBosses,
    [difficulty]: pool.filter((id) => id !== selectedBossId),
  };

  const newBossProgress: DailyBossProgress = {
    bossId: selectedBossId,
    maxHP: bossHP,
    currentHP: initialHP,
    completedMissions: [],
    ...(initialHP <= 0 ? { defeatedAt: new Date().toISOString() } : {}),
  };

  const bosses = dailyState.bosses ?? [];
  const isInstantDefeat = initialHP <= 0;

  const updatedState: DailyBattleState = {
    ...dailyState,
    currentBossIndex: bosses.length,
    bosses: [...bosses, newBossProgress],
    remainingBosses: updatedRemainingBosses,
    overkillDamage: remainingOverkill,
    ...(isInstantDefeat
      ? {
          totalDefeated: (dailyState.totalDefeated ?? 0) + 1,
          defeatedBossIds: [...(dailyState.defeatedBossIds ?? []), selectedBossId],
        }
      : {}),
  };

  return { updatedState, spawnedBossId: selectedBossId, overkillApplied: appliedOverkill };
};

/**
 * 새로운 일일 전투 상태 생성 (23마리 풀 시스템)
 * - 모든 보스를 난이도별로 분류하여 remainingBosses에 저장
 * - easy 난이도에서 랜덤 1마리 자동 스폰
 */
export const computeNewDailyState_core = (settings: BattleSettings, today: string): DailyBattleState => {
  const remainingBosses = groupBossesByDifficulty();

  const easyBossIds = remainingBosses.easy;
  const randomIndex = Math.floor(Math.random() * easyBossIds.length);
  const firstBossId = easyBossIds[randomIndex];
  const firstBoss = getBossById(firstBossId)!;
  const firstBossHP = computeBossHP(firstBoss.difficulty, settings);

  remainingBosses.easy = easyBossIds.filter((id) => id !== firstBossId);

  return {
    date: today,
    currentBossIndex: 0,
    bosses: [
      {
        bossId: firstBossId,
        maxHP: firstBossHP,
        currentHP: firstBossHP,
        completedMissions: [],
      },
    ],
    totalDefeated: 0,
    remainingBosses,
    defeatedBossIds: [],
    completedMissionIds: [],
    missionUsedAt: {},
    sequentialPhase: 0,
  };
};

/**
 * 미션 쿨다운 남은 시간 (분)
 * - 쿨다운이 0이면 하루 1회 제한(-1)
 * - 0이면 사용 가능
 */
export const getMissionCooldownRemaining = (
  mission: BattleMission,
  missionUsedAt: Record<string, string> | undefined
): number => {
  if (!mission.cooldownMinutes || mission.cooldownMinutes <= 0) {
    return -1;
  }

  const lastUsed = missionUsedAt?.[mission.id];
  if (!lastUsed) {
    return 0;
  }

  const lastUsedTime = new Date(lastUsed).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - lastUsedTime) / (1000 * 60);
  const remaining = mission.cooldownMinutes - elapsedMinutes;

  return remaining > 0 ? Math.ceil(remaining) : 0;
};

/** 미션 사용 가능 여부 (쿨다운 / 하루 1회 제한) */
export const isMissionAvailable = (
  mission: BattleMission,
  completedMissionIds: string[],
  missionUsedAt: Record<string, string> | undefined
): boolean => {
  if (!mission.enabled) {
    return false;
  }

  if (!mission.cooldownMinutes || mission.cooldownMinutes <= 0) {
    return !completedMissionIds.includes(mission.id);
  }

  return getMissionCooldownRemaining(mission, missionUsedAt) === 0;
};
