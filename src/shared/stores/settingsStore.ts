/**
 * Settings Zustand Store
 *
 * @role 설정 상태(API 키, waifuMode 등)의 전역 상태 관리
 * @responsibilities
 *   - 설정 데이터 로드/저장 (IndexedDB/Firebase)
 *   - waifuMode, API 키, 자동 메시지 설정 관리
 *   - AI 작업 세분화 트리거 설정
 *   - 하지않기 체크리스트 CRUD
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - settingsRepository: 설정 데이터 영속성 관리
 *   - storeUtils: 비동기 액션 래퍼
 */

import { create } from 'zustand';
import type { Settings, WaifuMode, AIBreakdownTrigger, DontDoChecklistItem } from '../types/domain';
import { loadSettings, updateSettings, updateLocalSettings } from '@/data/repositories/settingsRepository';
import { withAsyncAction, withAsyncActionSafe } from '@/shared/lib/storeUtils';

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
  updateAIBreakdownTrigger: (trigger: AIBreakdownTrigger) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  updateLocalSettings: (updates: Partial<Settings>) => Promise<void>;

  // 하지않기 체크리스트 관리
  addDontDoItem: (item: Omit<DontDoChecklistItem, 'id'>) => Promise<void>;
  updateDontDoItem: (id: string, updates: Partial<DontDoChecklistItem>) => Promise<void>;
  deleteDontDoItem: (id: string) => Promise<void>;
  reorderDontDoItems: (items: DontDoChecklistItem[]) => Promise<void>;

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
   * @returns {Promise<Settings>}
   * @throws {Error} 로드 실패 시
   * @sideEffects
   *   - IndexedDB에서 설정 조회
   *   - 상태 업데이트
   */
  loadData: async () => {
    const result = await withAsyncAction(set, async () => {
      const settings = await loadSettings();
      set({ settings });
      return settings;
    }, { errorPrefix: 'SettingsStore: load' });
    // loadSettings는 항상 값을 반환하므로 (createInitial fallback이 있음)
    return result as Settings;
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
    return withAsyncAction(set, async () => {
      const updatedSettings = await updateSettings({ waifuMode: mode });
      set({ settings: updatedSettings });
    }, { errorPrefix: 'SettingsStore: updateWaifuMode' });
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
    return withAsyncAction(set, async () => {
      const updatedSettings = await updateSettings({ geminiApiKey: apiKey });
      set({ settings: updatedSettings });
    }, { errorPrefix: 'SettingsStore: updateApiKey' });
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
    return withAsyncAction(set, async () => {
      const updates: Partial<Settings> = { autoMessageEnabled: enabled };
      if (interval !== undefined) {
        updates.autoMessageInterval = interval;
      }
      const updatedSettings = await updateSettings(updates);
      set({ settings: updatedSettings });
    }, { errorPrefix: 'SettingsStore: updateAutoMessage' });
  },

  /**
   * AI 작업 세분화 트리거 설정 업데이트
   *
   * @param {AIBreakdownTrigger} trigger - 트리거 조건 ('always' | 'high_difficulty' | 'manual')
   * @returns {Promise<void>}
   * @throws {Error} 업데이트 실패 시
   * @sideEffects
   *   - IndexedDB/localStorage에 설정 저장
   *   - 상태 업데이트
   */
  updateAIBreakdownTrigger: async (trigger: AIBreakdownTrigger) => {
    return withAsyncAction(set, async () => {
      const updatedSettings = await updateSettings({ aiBreakdownTrigger: trigger });
      set({ settings: updatedSettings });
    }, { errorPrefix: 'SettingsStore: updateAIBreakdownTrigger' });
  },

  /**
   * 설정 일반 업데이트
   *
   * @param {Partial<Settings>} updates - 업데이트할 설정 객체
   * @returns {Promise<void>}
   */
  updateSettings: async (updates: Partial<Settings>) => {
    return withAsyncAction(set, async () => {
      const updatedSettings = await updateSettings(updates);
      set({ settings: updatedSettings });
    }, { errorPrefix: 'SettingsStore: updateSettings' });
  },

  /**
   * 설정 로컬 업데이트 (Firebase 동기화 안 함)
   *
   * @param {Partial<Settings>} updates - 업데이트할 설정 객체
   * @returns {Promise<void>}
   */
  updateLocalSettings: async (updates: Partial<Settings>) => {
    return withAsyncAction(set, async () => {
      const updatedSettings = await updateLocalSettings(updates);
      set({ settings: updatedSettings });
    }, { errorPrefix: 'SettingsStore: updateLocalSettings' });
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

  /**
   * 하지않기 체크리스트 항목 추가
   */
  addDontDoItem: async (item: Omit<DontDoChecklistItem, 'id'>) => {
    return withAsyncActionSafe(set, async () => {
      const newItem: DontDoChecklistItem = {
        id: `dnd-${Date.now()}`,
        ...item,
      };
      const currentList = get().settings?.dontDoChecklist || [];
      await get().updateSettings({
        dontDoChecklist: [...currentList, newItem],
      });
    }, 'SettingsStore: addDontDoItem');
  },

  /**
   * 하지않기 체크리스트 항목 수정
   */
  updateDontDoItem: async (id: string, updates: Partial<DontDoChecklistItem>) => {
    return withAsyncActionSafe(set, async () => {
      const currentList = get().settings?.dontDoChecklist || [];
      await get().updateSettings({
        dontDoChecklist: currentList.map(item =>
          item.id === id ? { ...item, ...updates } : item
        ),
      });
    }, 'SettingsStore: updateDontDoItem');
  },

  /**
   * 하지않기 체크리스트 항목 삭제
   */
  deleteDontDoItem: async (id: string) => {
    return withAsyncActionSafe(set, async () => {
      const currentList = get().settings?.dontDoChecklist || [];
      await get().updateSettings({
        dontDoChecklist: currentList.filter(item => item.id !== id),
      });
    }, 'SettingsStore: deleteDontDoItem');
  },

  /**
   * 하지않기 체크리스트 항목 순서 변경
   */
  reorderDontDoItems: async (items: DontDoChecklistItem[]) => {
    return withAsyncActionSafe(set, async () => {
      await get().updateSettings({
        dontDoChecklist: items.map((item, index) => ({ ...item, order: index })),
      });
    }, 'SettingsStore: reorderDontDoItems');
  },
}));
