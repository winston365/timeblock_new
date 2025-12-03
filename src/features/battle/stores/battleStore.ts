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
      const dailyState = await loadDailyBattleState();
      const today = getLocalDate();

      if (dailyState && dailyState.date === today) {
        set({ dailyState, loading: false });
      } else {
        // 새로운 날 - 전투 시작
        await get().startNewDay();
        set({ loading: false });
      }
    } catch (error) {
      console.error('BattleStore: Failed to initialize', error);
      set({ error: error as Error, loading: false });
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
      console.error('BattleStore: Failed to load missions', error);
    }
  },

  addMission: async (text, damage) => {
    const { settings, missions } = get();
    const newMission: BattleMission = {
      id: `mission_${Date.now()}`,
      text,
      damage: damage ?? settings.defaultMissionDamage,
      order: missions.length,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedMissions = [...missions, newMission];
    await saveBattleMissions(updatedMissions);
    set({ missions: updatedMissions });
    return newMission;
  },

  updateMission: async (missionId, updates) => {
    const { missions } = get();
    const updatedMissions = missions.map(m =>
      m.id === missionId
        ? { ...m, ...updates, updatedAt: new Date().toISOString() }
        : m
    );
    await saveBattleMissions(updatedMissions);
    set({ missions: updatedMissions });
  },

  deleteMission: async (missionId) => {
    const { missions } = get();
    const filtered = missions.filter(m => m.id !== missionId);
    const reordered = filtered.map((m, idx) => ({ ...m, order: idx }));
    await saveBattleMissions(reordered);
    set({ missions: reordered });
  },

  reorderMissions: async (missions) => {
    const reordered = missions.map((m, idx) => ({
      ...m,
      order: idx,
      updatedAt: new Date().toISOString(),
    }));
    await saveBattleMissions(reordered);
    set({ missions: reordered });
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
      console.error('BattleStore: Failed to load settings', error);
    }
  },

  updateSettings: async (updates) => {
    const { settings, dailyState } = get();
    const updated = { ...settings, ...updates };
    await saveBattleSettings(updated);
    set({ settings: updated });

    // dailyBossCount가 변경되었고, 오늘 전투가 진행 중이라면 보스 목록 동기화
    if (updates.dailyBossCount !== undefined && dailyState) {
      const newCount = updates.dailyBossCount;
      const currentCount = dailyState.bosses.length;

      if (newCount > currentCount) {
        // 보스 추가: 부족한 수만큼 랜덤 보스 선택 (이미 있는 보스 제외)
        const diff = newCount - currentCount;
        const existingIds = dailyState.bosses.map(b => b.bossId);
        const newBosses = selectRandomBosses(diff, existingIds);

        const addedBosses = newBosses.map(boss => ({
          bossId: boss.id,
          maxHP: settings.bossBaseHP,
          currentHP: settings.bossBaseHP,
          completedMissions: [],
        }));

        const updatedState = {
          ...dailyState,
          bosses: [...dailyState.bosses, ...addedBosses],
        };

        await saveDailyBattleState(updatedState);
        set({ dailyState: updatedState });
      } else if (newCount < currentCount) {
        // 보스 감소: 뒤에서부터 제거 (현재 진행 중인 보스 인덱스 고려)
        // 만약 현재 보스 인덱스가 새 카운트보다 크거나 같으면, 마지막 보스로 조정
        const updatedBosses = dailyState.bosses.slice(0, newCount);
        const newIndex = Math.min(dailyState.currentBossIndex, newCount - 1);

        // 만약 줄어든 보스 수보다 더 많이 처치했다면? 
        // -> totalDefeated는 재계산 필요할 수 있음. 
        // 하지만 단순하게 defeatedAt이 있는 보스 수로 totalDefeated 재계산이 안전함.
        const newTotalDefeated = updatedBosses.filter(b => b.defeatedAt).length;

        const updatedState = {
          ...dailyState,
          bosses: updatedBosses,
          currentBossIndex: newIndex,
          totalDefeated: newTotalDefeated,
        };

        await saveDailyBattleState(updatedState);
        set({ dailyState: updatedState });
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
    await saveBossImageSettings(updated);
    set({ bossImageSettings: updated });
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

    // 랜덤 보스 선택
    const selectedBosses = selectRandomBosses(settings.dailyBossCount, excludeIds);

    const newState: DailyBattleState = {
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

    await saveDailyBattleState(newState);
    set({ dailyState: newState });
  },

  completeMission: async (missionId) => {
    const { dailyState, missions, settings } = get();
    if (!dailyState) return { bossDefeated: false, xpEarned: 0 };

    const currentBoss = dailyState.bosses[dailyState.currentBossIndex];
    if (!currentBoss || currentBoss.defeatedAt) {
      return { bossDefeated: false, xpEarned: 0 };
    }

    // 이미 완료된 미션인지 확인
    if (currentBoss.completedMissions.includes(missionId)) {
      return { bossDefeated: false, xpEarned: 0 };
    }

    const mission = missions.find(m => m.id === missionId);
    if (!mission) return { bossDefeated: false, xpEarned: 0 };

    // 원킬 판정: HP를 0으로 설정
    const bossDefeated = true;

    // 상태 업데이트
    const updatedBosses = [...dailyState.bosses];
    updatedBosses[dailyState.currentBossIndex] = {
      ...currentBoss,
      currentHP: 0, // 원킬
      completedMissions: [...currentBoss.completedMissions, missionId],
      defeatedAt: new Date().toISOString(),
    };

    const updatedState: DailyBattleState = {
      ...dailyState,
      bosses: updatedBosses,
      totalDefeated: dailyState.totalDefeated + 1,
      currentBossIndex: Math.min(dailyState.currentBossIndex + 1, dailyState.bosses.length - 1),
    };

    await saveDailyBattleState(updatedState);
    set({ dailyState: updatedState });

    // XP 보상
    const xpEarned = settings.bossDefeatXP;

    // 처치 연출 표시
    get().showBossDefeat(currentBoss.bossId);

    return { bossDefeated, xpEarned };
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
