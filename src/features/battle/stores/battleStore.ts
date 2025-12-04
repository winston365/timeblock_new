/**
 * Battle Zustand Store
 *
 * @role 전투 시스템 전역 상태 관리
 * @input 전투 상태 변경 요청
 * @output 전투 상태 및 액션
 * @dependencies
 *   - battleRepository: 데이터 영속성
 *   - bossData: 보스 메타데이터
 *   - gameStateStore: XP 보상
 */

import { create } from 'zustand';
import type { BattleMission, BattleSettings, DailyBattleState, DailyBossProgress, BossImageSettings, BossDifficulty } from '@/shared/types/domain';
import {
  loadBattleMissions,
  saveBattleMissions,
  loadBattleSettings,
  saveBattleSettings,
  loadDailyBattleState,
  saveDailyBattleState,
  loadBossImageSettings,
  saveBossImageSettings,
  DEFAULT_BATTLE_SETTINGS,
  addToDefeatedBossHistory,
  loadDefeatedBossHistory,
  updateTodayBattleStats,
} from '@/data/repositories/battleRepository';
import { BOSSES, getBossById, groupBossesByDifficulty } from '../data/bossData';
import { getLocalDate } from '@/shared/lib/utils';
import { getBossXpByDifficulty } from '../utils/xp';

interface BattleStoreError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  originalError?: unknown;
}

function createBattleStoreError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  originalError?: unknown,
): Error & BattleStoreError {
  const error = new Error(message) as Error & BattleStoreError;
  error.code = code;
  error.context = context;
  error.originalError = originalError;
  return error;
}

function logBattleStoreError(context: string, error: Error & BattleStoreError) {
  console.error(`[BattleStore] ${context}`, error);
}

function computeDailyStateForToday_core(dailyState: DailyBattleState | null, today: string) {
  if (dailyState && dailyState.date === today) {
    return { dailyStateForToday: dailyState, shouldStartNewDay: false };
  }

  return { dailyStateForToday: null, shouldStartNewDay: true };
}

/**
 * legacy 데이터에 remainingBosses가 비어 있거나 누락된 경우 풀 시스템을 복원
 */
function normalizeDailyBattleState_core(dailyState: DailyBattleState): { normalized: DailyBattleState; changed: boolean } {
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

  const seenBossIds = new Set([
    ...defeatedBossIds,
    ...bosses.map(b => b.bossId),
  ]);

  const existingRemaining = dailyState.remainingBosses;
  const existingRemainingTotal = existingRemaining
    ? Object.values(existingRemaining).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
    : 0;

  const totalBosses = BOSSES.length;
  const shouldRebuildPool = (!existingRemaining || existingRemainingTotal === 0) && seenBossIds.size < totalBosses;

  let remainingBosses: Record<BossDifficulty, string[]> =
    existingRemaining ?? { easy: [], normal: [], hard: [], epic: [] };
  if (!existingRemaining) {
    changed = true;
  }

  if (shouldRebuildPool) {
    const rebuilt = groupBossesByDifficulty();
    (Object.keys(rebuilt) as BossDifficulty[]).forEach(diff => {
      rebuilt[diff] = rebuilt[diff].filter(id => !seenBossIds.has(id));
    });
    remainingBosses = rebuilt;
    changed = true;
  }

  const maxIndex = Math.max(bosses.length - 1, 0);
  const currentBossIndex = typeof dailyState.currentBossIndex === 'number'
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
}

function computeNewMission_core(params: {
  text: string;
  damage: number;
  order: number;
  idSeed: number;
  timestamp: string;
}): BattleMission {
  const { text, damage, order, idSeed, timestamp } = params;
  return {
    id: `mission_${idSeed}`,
    text,
    damage,
    order,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function computeUpdatedMissions_core(
  missions: BattleMission[],
  missionId: string,
  updates: Partial<BattleMission>,
  timestamp: string,
) {
  return missions.map(m =>
    m.id === missionId
      ? { ...m, ...updates, updatedAt: timestamp }
      : m
  );
}

function computeDeletedAndReorderedMissions_core(missions: BattleMission[], missionId: string) {
  const filtered = missions.filter(m => m.id !== missionId);
  return filtered.map((m, idx) => ({ ...m, order: idx }));
}

function computeReorderedMissions_core(missions: BattleMission[], timestamp: string) {
  return missions.map((m, idx) => ({
    ...m,
    order: idx,
    updatedAt: timestamp,
  }));
}

function computeUpdatedSettings_core(settings: BattleSettings, updates: Partial<BattleSettings>) {
  const mergedDifficultyXP = updates.bossDifficultyXP
    ? { ...settings.bossDifficultyXP, ...updates.bossDifficultyXP }
    : settings.bossDifficultyXP;

  return { ...settings, ...updates, bossDifficultyXP: mergedDifficultyXP };
}

/**
 * 순차 진행 단계별 난이도 매핑
 * phase 0: easy, 1: normal, 2: hard(1회차), 3: hard(2회차), 4: epic, 5+: 자유선택
 */
const SEQUENTIAL_PHASE_DIFFICULTY: (BossDifficulty | null)[] = [
  'easy',    // phase 0
  'normal',  // phase 1
  'hard',    // phase 2
  'hard',    // phase 3 (2회차)
  'epic',    // phase 4
  null,      // phase 5+ (자유선택)
];

/**
 * 현재 순차 진행 단계에서 다음 스폰할 난이도 반환
 * @returns null이면 자유선택 모드
 */
function getNextSequentialDifficulty(phase: number): BossDifficulty | null {
  if (phase >= SEQUENTIAL_PHASE_DIFFICULTY.length - 1) {
    return null; // 자유선택 모드
  }
  return SEQUENTIAL_PHASE_DIFFICULTY[phase] ?? null;
}

/**
 * 순차 진행 완료 여부 (phase 5 이상)
 */
function isSequentialPhaseComplete(phase: number | undefined): boolean {
  return (phase ?? 0) >= 5;
}

/**
 * 보스 HP 계산 (난이도별 XP의 절반)
 * @param difficulty 보스 난이도
 * @param settings 전투 설정
 * @returns HP (분 단위)
 */
function computeBossHP(difficulty: BossDifficulty, settings: BattleSettings): number {
  const xp = settings.bossDifficultyXP[difficulty];
  return Math.floor(xp * 0.5);
}

/**
 * @deprecated dailyBossCount 기반 시스템은 더 이상 사용되지 않음
 * 23마리 풀 시스템으로 대체됨
 */
function computeUpdatedDailyStateForBossCount_core(
  dailyState: DailyBattleState,
  _newCount: number,
  _settings: BattleSettings,
) {
  // deprecated - 더 이상 동적으로 보스 수를 변경하지 않음
  return { changed: false, nextState: dailyState };
}

/**
 * 새로운 일일 전투 상태 생성 (23마리 풀 시스템)
 * - 모든 보스를 난이도별로 분류하여 remainingBosses에 저장
 * - easy 난이도에서 랜덤 1마리 자동 스폰
 */
function computeNewDailyState_core(
  settings: BattleSettings,
  today: string,
): DailyBattleState {
  // 23마리 보스를 난이도별로 분류
  const remainingBosses = groupBossesByDifficulty();
  
  // easy 풀에서 랜덤 1마리 선택하여 첫 보스로 스폰
  const easyBossIds = remainingBosses.easy;
  const randomIndex = Math.floor(Math.random() * easyBossIds.length);
  const firstBossId = easyBossIds[randomIndex];
  const firstBoss = getBossById(firstBossId)!;
  const firstBossHP = computeBossHP(firstBoss.difficulty, settings);
  
  // 선택된 보스를 풀에서 제거
  remainingBosses.easy = easyBossIds.filter(id => id !== firstBossId);

  return {
    date: today,
    currentBossIndex: 0,
    bosses: [{
      bossId: firstBossId,
      maxHP: firstBossHP,
      currentHP: firstBossHP,
      completedMissions: [],
    }],
    totalDefeated: 0,
    remainingBosses,
    defeatedBossIds: [],
    completedMissionIds: [],
    sequentialPhase: 0, // 순차 진행 시작 (easy)
  };
}

/**
 * 난이도별 보스 스폰 결과 계산
 * - 오버킬 데미지가 있으면 새 보스 HP에 적용
 */
function computeSpawnBossResult_core(
  dailyState: DailyBattleState,
  difficulty: BossDifficulty,
  settings: BattleSettings,
): { updatedState: DailyBattleState | null; spawnedBossId: string | null; overkillApplied: number } {
  const pool = dailyState.remainingBosses?.[difficulty];
  
  // 해당 난이도에 남은 보스가 없으면 실패
  if (!pool || pool.length === 0) {
    return { updatedState: null, spawnedBossId: null, overkillApplied: 0 };
  }
  
  // 랜덤 선택
  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedBossId = pool[randomIndex];
  const boss = getBossById(selectedBossId);
  
  if (!boss) {
    return { updatedState: null, spawnedBossId: null, overkillApplied: 0 };
  }
  
  const bossHP = computeBossHP(difficulty, settings);
  
  // 오버킬 데미지 적용
  const overkillDamage = dailyState.overkillDamage ?? 0;
  const appliedOverkill = Math.min(overkillDamage, bossHP); // 최대 HP까지만 적용
  const initialHP = Math.max(0, bossHP - overkillDamage);
  const remainingOverkill = Math.max(0, overkillDamage - bossHP); // 남은 오버킬 (추가 이월)
  
  // 풀에서 제거
  const updatedRemainingBosses = {
    ...dailyState.remainingBosses,
    [difficulty]: pool.filter(id => id !== selectedBossId),
  };
  
  // 새 보스 추가
  const newBossProgress: DailyBossProgress = {
    bossId: selectedBossId,
    maxHP: bossHP,
    currentHP: initialHP,
    completedMissions: [],
    // 스폰 시 HP가 0이면 즉시 처치
    ...(initialHP <= 0 ? { defeatedAt: new Date().toISOString() } : {}),
  };
  
  const bosses = dailyState.bosses ?? [];
  const isInstantDefeat = initialHP <= 0;
  
  const updatedState: DailyBattleState = {
    ...dailyState,
    currentBossIndex: bosses.length, // 새 보스가 현재 보스
    bosses: [...bosses, newBossProgress],
    remainingBosses: updatedRemainingBosses,
    overkillDamage: remainingOverkill, // 남은 오버킬 저장
    // 스폰 시 즉시 처치되면 처치 정보 업데이트
    ...(isInstantDefeat ? {
      totalDefeated: (dailyState.totalDefeated ?? 0) + 1,
      defeatedBossIds: [...(dailyState.defeatedBossIds ?? []), selectedBossId],
    } : {}),
  };
  
  return { updatedState, spawnedBossId: selectedBossId, overkillApplied: appliedOverkill };
}

/**
 * 미션 완료 결과 계산 (데미지 누적 시스템)
 * - 미션은 하루에 한 번만 사용 가능
 * - HP가 0 이하가 되면 보스 처치
 * - 오버킬 데미지는 다음 보스에 이월
 */
function computeCompleteMissionResult_core(
  dailyState: DailyBattleState | null,
  missions: BattleMission[],
  settings: BattleSettings,
  missionId: string,
  timestamp: string,
): {
  updatedState: DailyBattleState | null;
  result: { bossDefeated: boolean; xpEarned: number; damageDealt: number; overkillDamage: number };
  defeatedBossId: string | null;
} {
  const emptyResult = {
    updatedState: null,
    result: { bossDefeated: false, xpEarned: 0, damageDealt: 0, overkillDamage: 0 },
    defeatedBossId: null,
  };

  if (!dailyState) {
    return emptyResult;
  }

  // 기존 데이터 호환성: 필드가 없을 수 있음
  const completedMissionIds = dailyState.completedMissionIds ?? [];
  const defeatedBossIds = dailyState.defeatedBossIds ?? [];

  const currentBoss = dailyState.bosses?.[dailyState.currentBossIndex];
  if (!currentBoss || currentBoss.defeatedAt) {
    return emptyResult;
  }

  // 이미 오늘 사용한 미션인지 확인 (하루 1회 제한)
  if (completedMissionIds.includes(missionId)) {
    return emptyResult;
  }

  const mission = missions.find(m => m.id === missionId);
  if (!mission) {
    return emptyResult;
  }

  const damageDealt = mission.damage;
  const newHP = Math.max(0, currentBoss.currentHP - damageDealt);
  const bossDefeated = newHP <= 0;
  // 오버킬 데미지 계산 (보스 HP보다 많은 데미지)
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
    completedMissionIds: [...completedMissionIds, missionId],
    // 오버킬 데미지 저장 (다음 보스 스폰 시 적용)
    ...(bossDefeated ? {
      totalDefeated: (dailyState.totalDefeated ?? 0) + 1,
      defeatedBossIds: [...defeatedBossIds, currentBoss.bossId],
      overkillDamage: (dailyState.overkillDamage ?? 0) + overkillDamage,
    } : {}),
  };

  return {
    updatedState,
    result: { bossDefeated, xpEarned, damageDealt, overkillDamage },
    defeatedBossId: bossDefeated ? currentBoss.bossId : null,
  };
}

interface BattleStore {
  // 상태
  missions: BattleMission[];
  settings: BattleSettings;
  dailyState: DailyBattleState | null;
  bossImageSettings: BossImageSettings;
  defeatedBossHistory: string[];
  loading: boolean;
  error: Error | null;

  // 처치 연출 상태
  showDefeatOverlay: boolean;
  defeatedBossId: string | null;
  
  // 처치 후 보스 선택 대기 상태
  awaitingBossSelection: boolean;

  // 오버킬 데미지 상태
  lastOverkillDamage: number; // 마지막 처치 시 발생한 오버킬
  lastOverkillApplied: number; // 마지막 스폰 시 적용된 오버킬

  // 초기화
  initialize: () => Promise<void>;

  // 미션 CRUD
  loadMissions: () => Promise<void>;
  addMission: (text: string, damage?: number) => Promise<BattleMission>;
  updateMission: (missionId: string, updates: Partial<BattleMission>) => Promise<void>;
  deleteMission: (missionId: string) => Promise<void>;
  reorderMissions: (missions: BattleMission[]) => Promise<void>;
  toggleMission: (missionId: string) => Promise<void>;

  // 설정
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<BattleSettings>) => Promise<void>;

  // 보스 이미지 설정
  updateBossImageSetting: (bossId: string, imagePosition: string, imageScale: number) => Promise<void>;
  getBossImageSetting: (bossId: string) => { imagePosition: string; imageScale: number } | null;

  // 전투 액션
  startNewDay: () => Promise<void>;
  completeMission: (missionId: string) => Promise<{ bossDefeated: boolean; xpEarned: number; damageDealt: number; overkillDamage: number }>;
  spawnBossByDifficulty: (difficulty: BossDifficulty) => Promise<boolean>;
  resetMissionsForNextBoss: () => void;

  // 처치 연출
  showBossDefeat: (bossId: string) => void;
  hideBossDefeat: () => void;
  setAwaitingBossSelection: (awaiting: boolean) => void;

  // 유틸리티
  getCurrentBoss: () => DailyBossProgress | null;
  getActiveMissions: () => BattleMission[];
  isAllBossesDefeated: () => boolean;
  getRemainingBossCount: (difficulty: BossDifficulty) => number;
  getTotalRemainingBossCount: () => number;
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  missions: [],
  settings: DEFAULT_BATTLE_SETTINGS,
  dailyState: null,
  bossImageSettings: {},
  defeatedBossHistory: [],
  loading: false,
  error: null,
  showDefeatOverlay: false,
  defeatedBossId: null,
  awaitingBossSelection: false,
  lastOverkillDamage: 0,
  lastOverkillApplied: 0,

  // =========================================================================
  // 초기화
  // =========================================================================

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const [missions, settings, bossImageSettings, defeatedBossHistory] = await Promise.all([
        loadBattleMissions(),
        loadBattleSettings(),
        loadBossImageSettings(),
        loadDefeatedBossHistory(),
      ]);

      set({ missions, settings, bossImageSettings, defeatedBossHistory });

      // 오늘의 전투 상태 확인
      const loadedDailyState = await loadDailyBattleState();
      const today = getLocalDate();
      const { dailyStateForToday, shouldStartNewDay } = computeDailyStateForToday_core(loadedDailyState, today);

      if (dailyStateForToday) {
        const { normalized, changed } = normalizeDailyBattleState_core(dailyStateForToday);
        if (changed) {
          await saveDailyBattleState(normalized);
        }
        set({ dailyState: normalized, loading: false });
        return;
      }

      // 새로운 날 - 전투 시작
      if (shouldStartNewDay) {
        await get().startNewDay();
      }
      set({ loading: false });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_INIT_ERROR',
        'Failed to initialize battle store',
        {},
        error,
      );
      logBattleStoreError('initialize failed', formattedError);
      set({ error: formattedError, loading: false });
    }
  },

  // =========================================================================
  // 미션 CRUD
  // =========================================================================

  loadMissions: async () => {
    try {
      const missions = await loadBattleMissions();
      set({ missions });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_MISSIONS_LOAD_ERROR',
        'Failed to load battle missions',
        {},
        error,
      );
      logBattleStoreError('loadMissions failed', formattedError);
    }
  },

  addMission: async (text, damage) => {
    const { settings, missions } = get();
    const now = new Date();
    const newMission = computeNewMission_core({
      text,
      damage: damage ?? settings.defaultMissionDamage,
      order: missions.length,
      idSeed: now.getTime(),
      timestamp: now.toISOString(),
    });

    const updatedMissions = [...missions, newMission];
    try {
      await saveBattleMissions(updatedMissions);
      set({ missions: updatedMissions });
      return newMission;
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_MISSION_ADD_ERROR',
        'Failed to add battle mission',
        { missionId: newMission.id },
        error,
      );
      logBattleStoreError('addMission failed', formattedError);
      throw formattedError;
    }
  },

  updateMission: async (missionId, updates) => {
    const { missions } = get();
    const updatedMissions = computeUpdatedMissions_core(
      missions,
      missionId,
      updates,
      new Date().toISOString(),
    );

    try {
      await saveBattleMissions(updatedMissions);
      set({ missions: updatedMissions });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_MISSION_UPDATE_ERROR',
        'Failed to update battle mission',
        { missionId, updates },
        error,
      );
      logBattleStoreError('updateMission failed', formattedError);
      throw formattedError;
    }
  },

  deleteMission: async (missionId) => {
    const { missions } = get();
    const reordered = computeDeletedAndReorderedMissions_core(missions, missionId);
    try {
      await saveBattleMissions(reordered);
      set({ missions: reordered });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_MISSION_DELETE_ERROR',
        'Failed to delete battle mission',
        { missionId },
        error,
      );
      logBattleStoreError('deleteMission failed', formattedError);
      throw formattedError;
    }
  },

  reorderMissions: async (missions) => {
    const reordered = computeReorderedMissions_core(missions, new Date().toISOString());
    try {
      await saveBattleMissions(reordered);
      set({ missions: reordered });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_MISSION_REORDER_ERROR',
        'Failed to reorder battle missions',
        { missionCount: missions.length },
        error,
      );
      logBattleStoreError('reorderMissions failed', formattedError);
      throw formattedError;
    }
  },

  toggleMission: async (missionId) => {
    const { missions } = get();
    const mission = missions.find(m => m.id === missionId);
    if (mission) {
      await get().updateMission(missionId, { enabled: !mission.enabled });
    }
  },

  // =========================================================================
  // 설정
  // =========================================================================

  loadSettings: async () => {
    try {
      const settings = await loadBattleSettings();
      set({ settings });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_SETTINGS_LOAD_ERROR',
        'Failed to load battle settings',
        {},
        error,
      );
      logBattleStoreError('loadSettings failed', formattedError);
    }
  },

  updateSettings: async (updates) => {
    const { settings, dailyState } = get();
    const updatedSettings = computeUpdatedSettings_core(settings, updates);

    try {
      await saveBattleSettings(updatedSettings);
      set({ settings: updatedSettings });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_SETTINGS_UPDATE_ERROR',
        'Failed to update battle settings',
        { updates },
        error,
      );
      logBattleStoreError('updateSettings failed', formattedError);
      throw formattedError;
    }

    // dailyBossCount가 변경되었고, 오늘 전투가 진행 중이라면 보스 목록 동기화
    if (updates.dailyBossCount !== undefined && dailyState) {
      const { changed, nextState } = computeUpdatedDailyStateForBossCount_core(
        dailyState,
        updates.dailyBossCount,
        settings,
      );

      if (changed && nextState) {
        try {
          await saveDailyBattleState(nextState);
          set({ dailyState: nextState });
        } catch (error) {
          const formattedError = createBattleStoreError(
            'BATTLE_DAILY_STATE_SAVE_ERROR',
            'Failed to persist updated daily battle state',
            { dailyBossCount: updates.dailyBossCount },
            error,
          );
          logBattleStoreError('updateSettings daily state sync failed', formattedError);
          throw formattedError;
        }
      }
    }
  },

  // =========================================================================
  // 보스 이미지 설정
  // =========================================================================

  updateBossImageSetting: async (bossId, imagePosition, imageScale) => {
    const { bossImageSettings } = get();
    const updated: BossImageSettings = {
      ...bossImageSettings,
      [bossId]: { imagePosition, imageScale },
    };

    try {
      await saveBossImageSettings(updated);
      set({ bossImageSettings: updated });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_BOSS_IMAGE_SAVE_ERROR',
        'Failed to update boss image settings',
        { bossId, imagePosition, imageScale },
        error,
      );
      logBattleStoreError('updateBossImageSetting failed', formattedError);
      throw formattedError;
    }
  },

  getBossImageSetting: (bossId) => {
    const { bossImageSettings } = get();
    return bossImageSettings[bossId] || null;
  },

  // =========================================================================
  // 전투 액션
  // =========================================================================

  startNewDay: async () => {
    const { settings } = get();
    const today = getLocalDate();

    const newState = computeNewDailyState_core(settings, today);

    try {
      await saveDailyBattleState(newState);
      set({ dailyState: newState, awaitingBossSelection: false });
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_NEW_DAY_ERROR',
        'Failed to start a new battle day',
        { date: today },
        error,
      );
      logBattleStoreError('startNewDay failed', formattedError);
      set({ error: formattedError });
      throw formattedError;
    }
  },

  spawnBossByDifficulty: async (difficulty: BossDifficulty) => {
    const { dailyState, settings } = get();
    
    if (!dailyState) {
      return false;
    }
    
    const computation = computeSpawnBossResult_core(dailyState, difficulty, settings);
    
    if (!computation.updatedState) {
      return false;
    }
    
    try {
      await saveDailyBattleState(computation.updatedState);
      set({ 
        dailyState: computation.updatedState, 
        awaitingBossSelection: false,
        lastOverkillApplied: computation.overkillApplied,
      });
      return true;
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_SPAWN_BOSS_ERROR',
        'Failed to spawn boss by difficulty',
        { difficulty },
        error,
      );
      logBattleStoreError('spawnBossByDifficulty failed', formattedError);
      throw formattedError;
    }
  },

  completeMission: async (missionId) => {
    const { dailyState, missions, settings } = get();
    const computation = computeCompleteMissionResult_core(
      dailyState,
      missions,
      settings,
      missionId,
      new Date().toISOString(),
    );

    if (!computation.updatedState) {
      return computation.result;
    }

    let finalState = computation.updatedState;

    try {
      // 보스 처치 시 순차 진행 단계 업데이트 및 자동 스폰
      if (computation.result.bossDefeated) {
        const currentPhase = finalState.sequentialPhase ?? 0;
        const nextPhase = currentPhase + 1;
        finalState = { ...finalState, sequentialPhase: nextPhase };
        
        // 순차 진행 중이면 자동 스폰 (phase 5 미만)
        const nextDifficulty = getNextSequentialDifficulty(nextPhase);
        console.log('[Battle] Boss defeated! Current phase:', currentPhase, '-> Next phase:', nextPhase, '-> Next difficulty:', nextDifficulty);
        console.log('[Battle] Remaining bosses:', finalState.remainingBosses);
        
        if (nextDifficulty) {
          // 다음 난이도로 자동 스폰
          const spawnResult = computeSpawnBossResult_core(finalState, nextDifficulty, settings);
          console.log('[Battle] Auto-spawn result:', spawnResult.spawnedBossId, spawnResult.updatedState ? 'success' : 'failed');
          if (spawnResult.updatedState) {
            finalState = spawnResult.updatedState;
            // 자동 스폰 시 sequentialPhase 유지
            finalState = { ...finalState, sequentialPhase: nextPhase };
            console.log('[Battle] New boss index:', finalState.currentBossIndex, 'Total bosses:', finalState.bosses?.length);
          }
        }
      }

      await saveDailyBattleState(finalState);
      set({ 
        dailyState: finalState,
        // 오버킬 데미지 저장 (처치 시만)
        ...(computation.result.bossDefeated ? { lastOverkillDamage: computation.result.overkillDamage } : {}),
      });
      
      if (computation.defeatedBossId) {
        // 보스 처치 시 히스토리에 저장 (도감 확장 준비)
        await addToDefeatedBossHistory(computation.defeatedBossId);
        
        // 통계 업데이트
        const defeatedBoss = getBossById(computation.defeatedBossId);
        if (defeatedBoss) {
          await updateTodayBattleStats(computation.defeatedBossId, defeatedBoss.difficulty);
        }
        
        // 로컬 상태도 업데이트
        const currentHistory = get().defeatedBossHistory;
        if (!currentHistory.includes(computation.defeatedBossId)) {
          set({ defeatedBossHistory: [...currentHistory, computation.defeatedBossId] });
        }
        get().showBossDefeat(computation.defeatedBossId);
        
        // 순차 진행 완료 후(phase 5+)만 보스 선택 대기 상태로 전환
        const isSequentialComplete = isSequentialPhaseComplete(finalState.sequentialPhase);
        set({ awaitingBossSelection: isSequentialComplete });
      }
    } catch (error) {
      const formattedError = createBattleStoreError(
        'BATTLE_MISSION_COMPLETE_ERROR',
        'Failed to complete battle mission',
        { missionId },
        error,
      );
      logBattleStoreError('completeMission failed', formattedError);
      throw formattedError;
    }

    return computation.result;
  },

  resetMissionsForNextBoss: () => {
    // 현재 보스의 미션 완료 상태를 다음 보스를 위해 리셋할 필요 없음
    // 각 보스는 자체 completedMissions 배열을 가짐
  },

  // =========================================================================
  // 처치 연출
  // =========================================================================

  showBossDefeat: (bossId) => {
    set({ showDefeatOverlay: true, defeatedBossId: bossId });
  },

  hideBossDefeat: () => {
    set({ showDefeatOverlay: false, defeatedBossId: null });
  },

  setAwaitingBossSelection: (awaiting: boolean) => {
    set({ awaitingBossSelection: awaiting });
  },

  // =========================================================================
  // 유틸리티
  // =========================================================================

  getCurrentBoss: () => {
    const { dailyState } = get();
    if (!dailyState?.bosses) return null;

    // 현재 보스 또는 마지막 보스 반환
    const currentBoss = dailyState.bosses[dailyState.currentBossIndex];
    return currentBoss || null;
  },

  getActiveMissions: () => {
    const { missions, dailyState } = get();
    if (!dailyState) return [];

    const completedMissionIds = dailyState.completedMissionIds ?? [];
    // 오늘 사용하지 않은 활성 미션만 반환
    return missions
      .filter(m => m.enabled && !completedMissionIds.includes(m.id))
      .sort((a, b) => a.order - b.order);
  },

  isAllBossesDefeated: () => {
    const { dailyState } = get();
    if (!dailyState?.remainingBosses || !dailyState?.bosses) return false;
    // 모든 난이도의 보스가 소진되었는지 확인
    const totalRemaining = Object.values(dailyState.remainingBosses).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
    return totalRemaining === 0 && dailyState.bosses.every(boss => boss.defeatedAt);
  },

  getRemainingBossCount: (difficulty: BossDifficulty) => {
    const { dailyState } = get();
    if (!dailyState?.remainingBosses) return 0;
    return dailyState.remainingBosses[difficulty]?.length ?? 0;
  },

  getTotalRemainingBossCount: () => {
    const { dailyState } = get();
    if (!dailyState?.remainingBosses) return 0;
    return Object.values(dailyState.remainingBosses).reduce((sum, arr) => sum + arr.length, 0);
  },
}));

// 보스 정보 헬퍼 함수 (컴포넌트에서 사용)
export { getBossById };

// HP 계산 헬퍼 함수 export
export { computeBossHP };
