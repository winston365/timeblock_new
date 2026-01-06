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
import { getBossById } from '../data/bossData';
import { getLocalDate } from '@/shared/lib/utils';
import { computeBossHP } from '../utils/combatCalculations';
import {
  computeDailyStateForToday_core,
  computeDeletedAndReorderedMissions_core,
  computeNewDailyState_core,
  computeNewMission_core,
  computeReorderedMissions_core,
  computeSpawnBossResult_core,
  computeUpdatedMissions_core,
  getMissionCooldownRemaining,
  getNextSequentialDifficulty,
  isMissionAvailable,
  isSequentialPhaseComplete,
  normalizeDailyBattleState_core,
} from '../utils/missionLogic';
import { computeCompleteMissionResult_core, computeUpdatedSettings_core } from '../utils/rewardCalculations';

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
    const { settings } = get();
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
    // 연쇄 처치된 보스 ID 수집 (도감 업데이트용)
    const chainDefeatedBossIds: string[] = [];

    try {
      // 보스 처치 시 순차 진행 단계 업데이트 및 자동 스폰
      if (computation.result.bossDefeated) {
        const currentPhase = finalState.sequentialPhase ?? 0;
        let nextPhase = currentPhase + 1;
        finalState = { ...finalState, sequentialPhase: nextPhase };

        // 순차 진행 중이면 자동 스폰 (phase 5 미만)
        // 오버킬로 즉시 처치 시 연쇄 스폰 처리
        let nextDifficulty = getNextSequentialDifficulty(nextPhase);

        while (nextDifficulty) {
          const spawnResult = computeSpawnBossResult_core(finalState, nextDifficulty, settings);

          if (!spawnResult.updatedState) {
            // 해당 난이도에 보스가 없으면 중단
            break;
          }

          finalState = spawnResult.updatedState;
          finalState = { ...finalState, sequentialPhase: nextPhase };

          // 스폰된 보스가 즉시 처치되었는지 확인 (오버킬로 인한 연쇄 처치)
          const newBoss = finalState.bosses?.[finalState.currentBossIndex];
          const isInstantDefeat = newBoss?.defeatedAt != null;

          if (isInstantDefeat && spawnResult.spawnedBossId) {
            // 연쇄 처치된 보스 ID 수집
            chainDefeatedBossIds.push(spawnResult.spawnedBossId);

            // 즉시 처치된 보스도 히스토리와 통계에 추가
            await addToDefeatedBossHistory(spawnResult.spawnedBossId);
            const instantBoss = getBossById(spawnResult.spawnedBossId);
            if (instantBoss) {
              await updateTodayBattleStats(spawnResult.spawnedBossId, instantBoss.difficulty);
            }

            // 다음 단계로 진행
            nextPhase++;
            finalState = { ...finalState, sequentialPhase: nextPhase };
            nextDifficulty = getNextSequentialDifficulty(nextPhase);
          } else {
            // 보스가 살아있으면 루프 종료
            break;
          }
        }
      }

      await saveDailyBattleState(finalState);

      // 연쇄 처치된 보스들도 로컬 히스토리에 추가
      let updatedHistory = get().defeatedBossHistory;
      for (const bossId of chainDefeatedBossIds) {
        if (!updatedHistory.includes(bossId)) {
          updatedHistory = [...updatedHistory, bossId];
        }
      }

      set({
        dailyState: finalState,
        defeatedBossHistory: updatedHistory,
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

// 쿨다운 관련 헬퍼 함수 export
export { getMissionCooldownRemaining, isMissionAvailable };
