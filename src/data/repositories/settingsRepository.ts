/**
 * Settings Repository
 *
 * @role 애플리케이션 설정 데이터 관리 (API 키, 메시지 간격 등)
 * @input Settings 객체, API 키, 설정 업데이트 요청
 * @output Settings 객체
 * @external_dependencies
 *   - IndexedDB (db.settings): 메인 저장소
 *   - localStorage (STORAGE_KEYS.SETTINGS): 백업 저장소
 *   - @/shared/types/domain: Settings 타입
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
 *
 * @returns {Settings} 기본값으로 초기화된 설정 객체
 * @throws 없음
 * @sideEffects 없음 (순수 함수)
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
 *
 * @returns {Promise<Settings>} 설정 객체 (없으면 초기값)
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - localStorage 폴백 시 IndexedDB에 데이터 복원
 *   - 데이터가 없으면 초기 설정 생성 및 저장
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
 *
 * @param {Settings} settings - 저장할 설정 객체
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 설정 저장
 *   - localStorage에 백업
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

  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * 특정 설정 업데이트
 *
 * @param {Partial<Settings>} updates - 업데이트할 필드
 * @returns {Promise<Settings>} 업데이트된 설정 객체
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 기존 설정 조회 및 업데이트
 *   - localStorage에 백업
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
 *
 * @param {string} apiKey - Gemini API 키
 * @returns {Promise<void>}
 * @throws {Error} 설정 업데이트 실패 시
 * @sideEffects
 *   - updateSettings 호출하여 API 키 저장
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  await updateSettings({ geminiApiKey: apiKey });
}

/**
 * Firebase 설정 저장
 *
 * @param {Settings['firebaseConfig']} config - Firebase 설정 객체
 * @returns {Promise<void>}
 * @throws {Error} 설정 업데이트 실패 시
 * @sideEffects
 *   - updateSettings 호출하여 Firebase 설정 저장
 */
export async function saveFirebaseConfig(config: Settings['firebaseConfig']): Promise<void> {
  await updateSettings({ firebaseConfig: config });
}

/**
 * 자동 메시지 설정 업데이트
 *
 * @param {boolean} enabled - 자동 메시지 활성화 여부
 * @param {number} [interval] - 메시지 간격 (선택, 밀리초)
 * @returns {Promise<void>}
 * @throws {Error} 설정 업데이트 실패 시
 * @sideEffects
 *   - updateSettings 호출하여 자동 메시지 설정 저장
 */
export async function updateAutoMessageSettings(enabled: boolean, interval?: number): Promise<void> {
  const updates: Partial<Settings> = { autoMessageEnabled: enabled };
  if (interval !== undefined) {
    updates.autoMessageInterval = interval;
  }
  await updateSettings(updates);
}
