/**
 * Settings 저장소
 * 앱 설정 관리
 */

import { db } from '../db/dexieClient';
import type { Settings } from '@/shared/types/domain';
import { saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { STORAGE_KEYS, DEFAULT_AUTO_MESSAGE_INTERVAL } from '@/shared/lib/constants';

// ============================================================================
// Settings CRUD
// ============================================================================

/**
 * 초기 Settings 생성
 */
export function createInitialSettings(): Settings {
  return {
    geminiApiKey: '',
    autoMessageInterval: DEFAULT_AUTO_MESSAGE_INTERVAL,
    autoMessageEnabled: true,
  };
}

/**
 * Settings 로드
 */
export async function loadSettings(): Promise<Settings> {
  try {
    // 1. IndexedDB에서 조회
    const data = await db.settings.get('current');

    if (data) {
      return data;
    }

    // 2. localStorage에서 조회
    const localData = getFromStorage<Settings | null>(STORAGE_KEYS.SETTINGS, null);

    if (localData) {
      await saveSettings(localData);
      return localData;
    }

    // 3. 초기 설정 생성
    const initialSettings = createInitialSettings();
    await saveSettings(initialSettings);
    return initialSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return createInitialSettings();
  }
}

/**
 * Settings 저장
 */
export async function saveSettings(settings: Settings): Promise<void> {
  try {
    // 1. IndexedDB에 저장
    await db.settings.put({
      key: 'current',
      ...settings,
    });

    // 2. localStorage에도 저장
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);

    console.log('✅ Settings saved');
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * 특정 설정 업데이트
 */
export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  try {
    const settings = await loadSettings();
    const updatedSettings = { ...settings, ...updates };
    await saveSettings(updatedSettings);
    return updatedSettings;
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

/**
 * Gemini API 키 저장
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  await updateSettings({ geminiApiKey: apiKey });
}

/**
 * Firebase 설정 저장
 */
export async function saveFirebaseConfig(config: Settings['firebaseConfig']): Promise<void> {
  await updateSettings({ firebaseConfig: config });
}

/**
 * 자동 메시지 설정 업데이트
 */
export async function updateAutoMessageSettings(enabled: boolean, interval?: number): Promise<void> {
  const updates: Partial<Settings> = { autoMessageEnabled: enabled };
  if (interval !== undefined) {
    updates.autoMessageInterval = interval;
  }
  await updateSettings(updates);
}
