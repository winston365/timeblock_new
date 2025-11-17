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
 *   - BaseRepository: 공통 Repository 패턴
 */

import { db } from '../db/dexieClient';
import type { Settings } from '@/shared/types/domain';
import { STORAGE_KEYS, DEFAULT_AUTO_MESSAGE_INTERVAL } from '@/shared/lib/constants';
import { loadData, saveData, updateData, type RepositoryConfig } from './baseRepository';

// ============================================================================
// Repository Configuration
// ============================================================================

/**
 * Settings Repository 설정
 */
const settingsConfig: RepositoryConfig<Settings> = {
  table: db.settings,
  storageKey: STORAGE_KEYS.SETTINGS,
  createInitial: () => ({
    geminiApiKey: '',
    autoMessageInterval: DEFAULT_AUTO_MESSAGE_INTERVAL,
    autoMessageEnabled: true,
    waifuMode: 'characteristic', // 기본값: 특성 모드
    templateCategories: ['업무', '건강', '공부', '취미'], // 기본 카테고리
  }),
  sanitize: (data: Settings) => {
    // 기존 사용자를 위한 마이그레이션
    return {
      ...data,
      waifuMode: data.waifuMode || 'characteristic',
      templateCategories: data.templateCategories || ['업무', '건강', '공부', '취미'],
    };
  },
  logPrefix: 'Settings',
};

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
  return settingsConfig.createInitial();
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
  return loadData(settingsConfig, 'current', { useFirebase: false });
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
  await saveData(settingsConfig, 'current', settings, { syncFirebase: false });
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
  return updateData(settingsConfig, 'current', updates, { syncFirebase: false });
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

// ============================================================================
// Template Category Management
// ============================================================================

/**
 * 템플릿 카테고리 목록 가져오기
 *
 * @returns {Promise<string[]>} 카테고리 목록
 * @throws 없음
 * @sideEffects
 *   - loadSettings 호출
 */
export async function getTemplateCategories(): Promise<string[]> {
  const settings = await loadSettings();
  return settings.templateCategories || [];
}

/**
 * 템플릿 카테고리 추가
 *
 * @param {string} category - 추가할 카테고리 이름
 * @returns {Promise<string[]>} 업데이트된 카테고리 목록
 * @throws {Error} 설정 업데이트 실패 시
 * @sideEffects
 *   - updateSettings 호출하여 카테고리 추가
 */
export async function addTemplateCategory(category: string): Promise<string[]> {
  const settings = await loadSettings();
  const categories = settings.templateCategories || [];

  // 중복 체크
  if (!categories.includes(category)) {
    categories.push(category);
    await updateSettings({ templateCategories: categories });
  }

  return categories;
}

/**
 * 템플릿 카테고리 삭제
 *
 * @param {string} category - 삭제할 카테고리 이름
 * @returns {Promise<string[]>} 업데이트된 카테고리 목록
 * @throws {Error} 설정 업데이트 실패 시
 * @sideEffects
 *   - updateSettings 호출하여 카테고리 삭제
 */
export async function removeTemplateCategory(category: string): Promise<string[]> {
  const settings = await loadSettings();
  const categories = settings.templateCategories || [];
  const updatedCategories = categories.filter(c => c !== category);

  await updateSettings({ templateCategories: updatedCategories });
  return updatedCategories;
}
