/**
 * Settings Zustand Store
 *
 * @role 설정 상태(API 키, waifuMode 등)의 전역 상태 관리
 * @input 설정 업데이트 요청
 * @output 설정 상태 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - repositories: 설정 데이터 레포지토리
 */

import { create } from 'zustand';
import type { Settings, WaifuMode } from '../types/domain';
import { loadSettings, updateSettings } from '@/data/repositories/settingsRepository';

interface SettingsStore {
  // 상태
  settings: Settings | null;
  loading: boolean;
  error: Error | null;

  // 액션
  loadData: () => Promise<Settings>;
  updateWaifuMode: (mode: WaifuMode) => Promise<void>;
  updateApiKey: (apiKey: string) => Promise<void>;
  updateAutoMessage: (enabled: boolean, interval?: number) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * 설정 상태 Zustand 스토어
 *
 * @returns {SettingsStore} 설정 상태 및 관리 함수
 * @throws {Error} 데이터 로드/저장 실패 시
 * @sideEffects
 *   - IndexedDB/localStorage에 설정 저장
 *   - waifuMode 변경 시 즉시 저장
 *
 * @example
 * ```tsx
 * const { settings, updateWaifuMode } = useSettingsStore();
 * await updateWaifuMode('normal');
 * ```
 */
export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // 초기 상태
  settings: null,
  loading: false,
  error: null,

  /**
   * 설정 데이터 로드
   *
   * @returns {Promise<void>}
   * @throws {Error} 로드 실패 시
   * @sideEffects
   *   - IndexedDB에서 설정 조회
   *   - 상태 업데이트
   */
  loadData: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await loadSettings();
      set({ settings, loading: false });
      return settings;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load settings');
      set({ error: err, loading: false });
      console.error('Settings store: Failed to load data', err);
      throw err;
    }
  },

  /**
   * waifuMode 업데이트
   *
   * @param {WaifuMode} mode - 새로운 waifuMode ('normal' | 'characteristic')
   * @returns {Promise<void>}
   * @throws {Error} 업데이트 실패 시
   * @sideEffects
   *   - IndexedDB/localStorage에 설정 저장
   *   - 상태 업데이트
   */
  updateWaifuMode: async (mode: WaifuMode) => {
    set({ loading: true, error: null });
    try {
      const updatedSettings = await updateSettings({ waifuMode: mode });
      set({ settings: updatedSettings, loading: false });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update waifuMode');
      set({ error: err, loading: false });
      console.error('Settings store: Failed to update waifuMode', err);
      throw err;
    }
  },

  /**
   * API 키 업데이트
   *
   * @param {string} apiKey - 새로운 Gemini API 키
   * @returns {Promise<void>}
   * @throws {Error} 업데이트 실패 시
   * @sideEffects
   *   - IndexedDB/localStorage에 설정 저장
   *   - 상태 업데이트
   */
  updateApiKey: async (apiKey: string) => {
    set({ loading: true, error: null });
    try {
      const updatedSettings = await updateSettings({ geminiApiKey: apiKey });
      set({ settings: updatedSettings, loading: false });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update API key');
      set({ error: err, loading: false });
      console.error('Settings store: Failed to update API key', err);
      throw err;
    }
  },

  /**
   * 자동 메시지 설정 업데이트
   *
   * @param {boolean} enabled - 자동 메시지 활성화 여부
   * @param {number} [interval] - 메시지 간격 (선택)
   * @returns {Promise<void>}
   * @throws {Error} 업데이트 실패 시
   * @sideEffects
   *   - IndexedDB/localStorage에 설정 저장
   *   - 상태 업데이트
   */
  updateAutoMessage: async (enabled: boolean, interval?: number) => {
    set({ loading: true, error: null });
    try {
      const updates: Partial<Settings> = { autoMessageEnabled: enabled };
      if (interval !== undefined) {
        updates.autoMessageInterval = interval;
      }
      const updatedSettings = await updateSettings(updates);
      set({ settings: updatedSettings, loading: false });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update auto message settings');
      set({ error: err, loading: false });
      console.error('Settings store: Failed to update auto message settings', err);
      throw err;
    }
  },

  /**
   * 설정 새로고침
   *
   * @returns {Promise<void>}
   * @throws {Error} 로드 실패 시
   * @sideEffects
   *   - loadData 호출
   */
  refresh: async () => {
    await get().loadData();
  },

  /**
   * 상태 초기화
   *
   * @returns {void}
   * @throws 없음
   * @sideEffects
   *   - 상태를 초기값으로 리셋
   */
  reset: () => {
    set({ settings: null, loading: false, error: null });
  },
}));
