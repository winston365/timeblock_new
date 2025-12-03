/**
 * Battle Repository
 *
 * @role 전투 미션 및 설정 CRUD (Firebase 동기화 포함)
 * @input 미션/설정 데이터
 * @output 저장/조회/삭제 함수
 * @dependencies
 *   - Dexie: systemState 테이블
 *   - Firebase: 실시간 동기화
 */

import { db } from '../db/dexieClient';
import type { BattleMission, BattleSettings, DailyBattleState, BossImageSettings } from '@/shared/types/domain';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { battleMissionsStrategy, battleSettingsStrategy, bossImageSettingsStrategy } from '@/shared/services/sync/firebase/strategies';
import { generateId, getLocalDate } from '@/shared/lib/utils';

// ============================================================================
// Storage Keys
// ============================================================================

const MISSIONS_KEY = 'battleMissions';
const SETTINGS_KEY = 'battleSettings';
const BOSS_IMAGE_SETTINGS_KEY = 'bossImageSettings';
const DAILY_STATE_KEY_PREFIX = 'battleState:';
const DEFEATED_BOSS_HISTORY_KEY = 'defeatedBossHistory';

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_BATTLE_SETTINGS: BattleSettings = {
  dailyBossCount: 15,
  bossBaseHP: 60,
  missions: [],
  defaultMissionDamage: 15,
  bossDefeatXP: 40,
  bossDifficultyXP: {
    easy: 20,
    normal: 40,
    hard: 80,
    epic: 120,
  },
  showBattleInSidebar: true,
  showBossImage: true,
  battleSoundEffects: true,
};

// ============================================================================
// Battle Missions CRUD
// ============================================================================

/**
 * 전투 미션 목록 로드
 */
export async function loadBattleMissions(): Promise<BattleMission[]> {
  try {
    // 1. Dexie에서 조회
    const stored = await db.systemState.get(MISSIONS_KEY);
    if (stored?.value && Array.isArray(stored.value)) {
      addSyncLog('dexie', 'load', `Loaded ${stored.value.length} battle missions`);
      return stored.value as BattleMission[];
    }

    // 2. Firebase에서 조회 (초기 로드)
    if (isFirebaseInitialized()) {
      const remoteMissions = await fetchFromFirebase<BattleMission[]>(battleMissionsStrategy);
      if (remoteMissions && remoteMissions.length > 0) {
        await db.systemState.put({ key: MISSIONS_KEY, value: remoteMissions });
        addSyncLog('firebase', 'load', `Restored ${remoteMissions.length} missions from Firebase`);
        return remoteMissions;
      }
    }

    return [];
  } catch (error) {
    console.error('Failed to load battle missions:', error);
    addSyncLog('dexie', 'error', 'Failed to load battle missions', undefined, error as Error);
    return [];
  }
}

/**
 * 전투 미션 저장 (전체 덮어쓰기)
 */
export async function saveBattleMissions(missions: BattleMission[]): Promise<void> {
  try {
    await db.systemState.put({ key: MISSIONS_KEY, value: missions });
    addSyncLog('dexie', 'save', `Saved ${missions.length} battle missions`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      await syncToFirebase(battleMissionsStrategy, missions);
    }
  } catch (error) {
    console.error('Failed to save battle missions:', error);
    throw error;
  }
}

/**
 * 미션 추가
 */
export async function addBattleMission(
  data: Omit<BattleMission, 'id' | 'order' | 'createdAt' | 'updatedAt'>
): Promise<BattleMission> {
  const missions = await loadBattleMissions();

  const newMission: BattleMission = {
    ...data,
    id: generateId('mission'),
    order: missions.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveBattleMissions([...missions, newMission]);
  return newMission;
}

/**
 * 미션 수정
 */
export async function updateBattleMission(
  missionId: string,
  updates: Partial<BattleMission>
): Promise<BattleMission> {
  const missions = await loadBattleMissions();
  const index = missions.findIndex(m => m.id === missionId);

  if (index === -1) {
    throw new Error(`Mission not found: ${missionId}`);
  }

  const updatedMission: BattleMission = {
    ...missions[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  missions[index] = updatedMission;
  await saveBattleMissions(missions);
  return updatedMission;
}

/**
 * 미션 삭제
 */
export async function deleteBattleMission(missionId: string): Promise<void> {
  const missions = await loadBattleMissions();
  const filtered = missions.filter(m => m.id !== missionId);

  // order 재정렬
  const reordered = filtered.map((m, idx) => ({ ...m, order: idx }));
  await saveBattleMissions(reordered);
}

/**
 * 미션 순서 변경
 */
export async function reorderBattleMissions(missions: BattleMission[]): Promise<void> {
  const reordered = missions.map((m, idx) => ({
    ...m,
    order: idx,
    updatedAt: new Date().toISOString(),
  }));
  await saveBattleMissions(reordered);
}

// ============================================================================
// Battle Settings CRUD
// ============================================================================

/**
 * 전투 설정 로드
 */
export async function loadBattleSettings(): Promise<BattleSettings> {
  try {
    // 1. Dexie에서 조회
    const stored = await db.systemState.get(SETTINGS_KEY);
    if (stored?.value) {
      addSyncLog('dexie', 'load', 'Loaded battle settings');
      return { ...DEFAULT_BATTLE_SETTINGS, ...stored.value } as BattleSettings;
    }

    // 2. Firebase에서 조회 (초기 로드)
    if (isFirebaseInitialized()) {
      const remoteSettings = await fetchFromFirebase<BattleSettings>(battleSettingsStrategy);
      if (remoteSettings) {
        await db.systemState.put({ key: SETTINGS_KEY, value: remoteSettings });
        addSyncLog('firebase', 'load', 'Restored battle settings from Firebase');
        return { ...DEFAULT_BATTLE_SETTINGS, ...remoteSettings };
      }
    }

    return DEFAULT_BATTLE_SETTINGS;
  } catch (error) {
    console.error('Failed to load battle settings:', error);
    return DEFAULT_BATTLE_SETTINGS;
  }
}

/**
 * 전투 설정 저장
 */
export async function saveBattleSettings(settings: BattleSettings): Promise<void> {
  try {
    await db.systemState.put({ key: SETTINGS_KEY, value: settings });
    addSyncLog('dexie', 'save', 'Saved battle settings');

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      await syncToFirebase(battleSettingsStrategy, settings);
    }
  } catch (error) {
    console.error('Failed to save battle settings:', error);
    throw error;
  }
}

/**
 * 전투 설정 부분 업데이트
 */
export async function updateBattleSettings(updates: Partial<BattleSettings>): Promise<BattleSettings> {
  const current = await loadBattleSettings();
  const updated = { ...current, ...updates };
  await saveBattleSettings(updated);
  return updated;
}

// ============================================================================
// Boss Image Settings CRUD
// ============================================================================

/**
 * 보스 이미지 설정 로드
 */
export async function loadBossImageSettings(): Promise<BossImageSettings> {
  try {
    // 1. Dexie에서 조회
    const stored = await db.systemState.get(BOSS_IMAGE_SETTINGS_KEY);
    if (stored?.value) {
      addSyncLog('dexie', 'load', 'Loaded boss image settings');
      return stored.value as BossImageSettings;
    }

    // 2. Firebase에서 조회 (초기 로드)
    if (isFirebaseInitialized()) {
      const remoteSettings = await fetchFromFirebase<BossImageSettings>(bossImageSettingsStrategy);
      if (remoteSettings && Object.keys(remoteSettings).length > 0) {
        await db.systemState.put({ key: BOSS_IMAGE_SETTINGS_KEY, value: remoteSettings });
        addSyncLog('firebase', 'load', 'Restored boss image settings from Firebase');
        return remoteSettings;
      }
    }

    return {};
  } catch (error) {
    console.error('Failed to load boss image settings:', error);
    return {};
  }
}

/**
 * 보스 이미지 설정 저장
 */
export async function saveBossImageSettings(settings: BossImageSettings): Promise<void> {
  try {
    await db.systemState.put({ key: BOSS_IMAGE_SETTINGS_KEY, value: settings });
    addSyncLog('dexie', 'save', `Saved boss image settings (${Object.keys(settings).length} bosses)`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      await syncToFirebase(bossImageSettingsStrategy, settings);
    }
  } catch (error) {
    console.error('Failed to save boss image settings:', error);
    throw error;
  }
}

/**
 * 특정 보스의 이미지 설정 업데이트
 */
export async function updateBossImageSetting(
  bossId: string,
  imagePosition: string,
  imageScale: number
): Promise<void> {
  const current = await loadBossImageSettings();
  const updated: BossImageSettings = {
    ...current,
    [bossId]: { imagePosition, imageScale },
  };
  await saveBossImageSettings(updated);
}

/**
 * 특정 보스의 이미지 설정 가져오기
 */
export async function getBossImageSetting(
  bossId: string
): Promise<{ imagePosition: string; imageScale: number } | null> {
  const settings = await loadBossImageSettings();
  return settings[bossId] || null;
}

// ============================================================================
// Daily Battle State (로컬만, 매일 리셋)
// ============================================================================

/**
 * 오늘의 전투 상태 로드
 */
export async function loadDailyBattleState(): Promise<DailyBattleState | null> {
  const today = getLocalDate();
  const key = `${DAILY_STATE_KEY_PREFIX}${today}`;

  try {
    const stored = await db.systemState.get(key);
    if (stored?.value) {
      return stored.value as DailyBattleState;
    }
    return null;
  } catch (error) {
    console.error('Failed to load daily battle state:', error);
    return null;
  }
}

/**
 * 오늘의 전투 상태 저장
 */
export async function saveDailyBattleState(state: DailyBattleState): Promise<void> {
  const key = `${DAILY_STATE_KEY_PREFIX}${state.date}`;

  try {
    await db.systemState.put({ key, value: state });
  } catch (error) {
    console.error('Failed to save daily battle state:', error);
    throw error;
  }
}

/**
 * 오래된 전투 상태 정리 (7일 이전 삭제)
 */
export async function cleanupOldBattleStates(): Promise<void> {
  try {
    const allKeys = await db.systemState.toArray();
    const battleStateKeys = allKeys.filter(item => item.key.startsWith(DAILY_STATE_KEY_PREFIX));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().slice(0, 10);

    for (const item of battleStateKeys) {
      const dateStr = item.key.replace(DAILY_STATE_KEY_PREFIX, '');
      if (dateStr < cutoffDate) {
        await db.systemState.delete(item.key);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old battle states:', error);
  }
}

// ============================================================================
// Defeated Boss History (도감 확장 준비)
// ============================================================================

/**
 * 처치한 보스 히스토리 로드 (전체 기록)
 */
export async function loadDefeatedBossHistory(): Promise<string[]> {
  try {
    const stored = await db.systemState.get(DEFEATED_BOSS_HISTORY_KEY);
    if (stored?.value && Array.isArray(stored.value)) {
      return stored.value as string[];
    }
    return [];
  } catch (error) {
    console.error('Failed to load defeated boss history:', error);
    return [];
  }
}

/**
 * 처치한 보스 히스토리에 추가
 */
export async function addToDefeatedBossHistory(bossId: string): Promise<void> {
  try {
    const current = await loadDefeatedBossHistory();
    // 중복 방지 (이미 처치한 보스는 추가하지 않음)
    if (!current.includes(bossId)) {
      const updated = [...current, bossId];
      await db.systemState.put({ key: DEFEATED_BOSS_HISTORY_KEY, value: updated });
    }
  } catch (error) {
    console.error('Failed to add to defeated boss history:', error);
  }
}
