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
import type { BattleMission, BattleSettings, DailyBattleState, DailyBossProgress, BossImageSettings } from '@/shared/types/domain';
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
} from '@/data/repositories/battleRepository';
import { selectRandomBosses, getBossById } from '../data/bossData';
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

function computeUpdatedDailyStateForBossCount_core(
  dailyState: DailyBattleState,
  newCount: number,
  settings: BattleSettings,
) {
  const currentCount = dailyState.bosses.length;

  if (newCount > currentCount) {
    const diff = newCount - currentCount;
    const existingIds = dailyState.bosses.map(b => b.bossId);
    const newBosses = selectRandomBosses(diff, existingIds);

    const addedBosses = newBosses.map(boss => ({
      bossId: boss.id,
      maxHP: settings.bossBaseHP,
      currentHP: settings.bossBaseHP,
      completedMissions: [],
    }));

    const nextState = {
      ...dailyState,
      bosses: [...dailyState.bosses, ...addedBosses],
    };

    return { changed: true, nextState };
  }

  if (newCount < currentCount) {
    const updatedBosses = dailyState.bosses.slice(0, newCount);
    const newIndex = Math.min(dailyState.currentBossIndex, newCount - 1);
    const newTotalDefeated = updatedBosses.filter(b => b.defeatedAt).length;

    const nextState = {
      ...dailyState,
      bosses: updatedBosses,
      currentBossIndex: newIndex,
      totalDefeated: newTotalDefeated,
    };

    return { changed: true, nextState };
  }

  return { changed: false, nextState: dailyState };
}

function computeNewDailyState_core(
  settings: BattleSettings,
  today: string,
  excludeIds: string[],
): DailyBattleState {
  const selectedBosses = selectRandomBosses(settings.dailyBossCount, excludeIds);

  return {
    date: today,
    currentBossIndex: 0,
    bosses: selectedBosses.map(boss => ({
      bossId: boss.id,
      maxHP: settings.bossBaseHP,
      currentHP: settings.bossBaseHP,
      completedMissions: [],
    })),
    totalDefeated: 0,
  };
}

function computeCompleteMissionResult_core(
  dailyState: DailyBattleState | null,
  missions: BattleMission[],
  settings: BattleSettings,
  missionId: string,
  timestamp: string,
) {
  if (!dailyState) {
    return {
      updatedState: null,
      result: { bossDefeated: false, xpEarned: 0 },
      defeatedBossId: null,
    };
  }

  const currentBoss = dailyState.bosses[dailyState.currentBossIndex];
  if (!currentBoss || currentBoss.defeatedAt) {
    return { updatedState: null, result: { bossDefeated: false, xpEarned: 0 }, defeatedBossId: null };
  }

  if (currentBoss.completedMissions.includes(missionId)) {
    return { updatedState: null, result: { bossDefeated: false, xpEarned: 0 }, defeatedBossId: null };
  }

  const mission = missions.find(m => m.id === missionId);
  if (!mission) {
    return { updatedState: null, result: { bossDefeated: false, xpEarned: 0 }, defeatedBossId: null };
  }

  const xpEarned = getBossXpByDifficulty(settings, currentBoss.bossId);

  const updatedBosses = [...dailyState.bosses];
  updatedBosses[dailyState.currentBossIndex] = {
    ...currentBoss,
    currentHP: 0,
    completedMissions: [...currentBoss.completedMissions, missionId],
    defeatedAt: timestamp,
  };

  const updatedState: DailyBattleState = {
    ...dailyState,
    bosses: updatedBosses,
    totalDefeated: dailyState.totalDefeated + 1,
    currentBossIndex: Math.min(dailyState.currentBossIndex + 1, dailyState.bosses.length - 1),
  };

  return {
    updatedState,
    result: { bossDefeated: true, xpEarned },
    defeatedBossId: currentBoss.bossId,
  };
}

interface BattleStore {
  // 상태
  missions: BattleMission[];
  settings: BattleSettings;
  dailyState: DailyBattleState | null;
  bossImageSettings: BossImageSettings;
  loading: boolean;
  error: Error | null;

  // 처치 연출 상태
  showDefeatOverlay: boolean;
  defeatedBossId: string | null;

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
  completeMission: (missionId: string) => Promise<{ bossDefeated: boolean; xpEarned: number }>;
  resetMissionsForNextBoss: () => void;

  // 처치 연출
  showBossDefeat: (bossId: string) => void;
  hideBossDefeat: () => void;

  // 유틸리티
  getCurrentBoss: () => DailyBossProgress | null;
  getActiveMissions: () => BattleMission[];
  isAllBossesDefeated: () => boolean;
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  missions: [],
  settings: DEFAULT_BATTLE_SETTINGS,
  dailyState: null,
  bossImageSettings: {},
  loading: false,
  error: null,
  showDefeatOverlay: false,
  defeatedBossId: null,

  // =========================================================================
  // 초기화
  // =========================================================================

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const [missions, settings, bossImageSettings] = await Promise.all([
        loadBattleMissions(),
        loadBattleSettings(),
        loadBossImageSettings(),
      ]);

      set({ missions, settings, bossImageSettings });

      // 오늘의 전투 상태 확인
      const loadedDailyState = await loadDailyBattleState();
      const today = getLocalDate();
      const { dailyStateForToday, shouldStartNewDay } = computeDailyStateForToday_core(loadedDailyState, today);

      if (dailyStateForToday) {
        set({ dailyState: dailyStateForToday, loading: false });
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

    // 최근 7일 사용된 보스 ID 가져오기 (향후 구현)
    const excludeIds: string[] = [];

    const newState = computeNewDailyState_core(settings, today, excludeIds);

    try {
      await saveDailyBattleState(newState);
      set({ dailyState: newState });
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

    try {
      await saveDailyBattleState(computation.updatedState);
      set({ dailyState: computation.updatedState });
      if (computation.defeatedBossId) {
        get().showBossDefeat(computation.defeatedBossId);
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

  // =========================================================================
  // 유틸리티
  // =========================================================================

  getCurrentBoss: () => {
    const { dailyState } = get();
    if (!dailyState) return null;

    // 현재 보스 또는 마지막 보스 반환
    const currentBoss = dailyState.bosses[dailyState.currentBossIndex];
    return currentBoss || null;
  },

  getActiveMissions: () => {
    const { missions, dailyState } = get();
    if (!dailyState) return [];

    const currentBoss = dailyState.bosses[dailyState.currentBossIndex];
    if (!currentBoss) return [];

    // 활성화된 미션 중 아직 완료하지 않은 것만
    return missions
      .filter(m => m.enabled && !currentBoss.completedMissions.includes(m.id))
      .sort((a, b) => a.order - b.order);
  },

  isAllBossesDefeated: () => {
    const { dailyState } = get();
    if (!dailyState) return false;
    return dailyState.bosses.every(boss => boss.defeatedAt);
  },
}));

// 보스 정보 헬퍼 함수 (컴포넌트에서 사용)
export { getBossById };
