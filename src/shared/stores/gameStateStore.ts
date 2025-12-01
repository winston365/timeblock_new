/**
 * GameState Zustand Store
 *
 * @role 게임 상태(XP, 퀘스트)의 전역 상태 관리 및 자동 일일 초기화
 * @responsibilities
 *   - 게임 상태 로드 (자동 날짜 변경 감지 및 일일 초기화)
 *   - XP 획득/소비 관리
 *   - 퀘스트 진행도 업데이트
 *   - 인벤토리 아이템 추가/사용
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - gameStateRepository: 게임 상태 데이터 영속성 관리
 *   - utils: 날짜 유틸리티
 */

import { create } from 'zustand';
import type { GameState } from '../types/domain';
import {
  loadGameState,
  addXP as addXPToRepo,
  spendXP as spendXPFromRepo,
  initializeNewDay as initializeNewDayInRepo,
  updateQuestProgress as updateQuestProgressInRepo,
} from '@/data/repositories';
import { getLocalDate } from '../lib/utils';

interface GameStateStore {
  // 상태
  gameState: GameState | null;
  loading: boolean;
  error: Error | null;

  // 액션
  loadData: () => Promise<void>;
  addXP: (amount: number, blockId?: string, skipEvents?: boolean) => Promise<void>;
  spendXP: (amount: number) => Promise<void>;
  initializeNewDay: () => Promise<void>;
  updateQuestProgress: (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks' | 'use_timer', amount?: number) => Promise<void>;
  addItem: (itemId: string, amount?: number) => Promise<void>;
  useItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * 게임 상태 Zustand 스토어
 *
 * @returns {GameStateStore} 게임 상태 및 관리 함수
 * @throws {Error} XP 부족, 데이터 로드 실패 시
 * @sideEffects
 *   - localStorage/Firebase에 게임 상태 저장
 *   - 날짜 변경 감지 시 자동 일일 초기화 (dailyXP, 퀘스트 리셋)
 *   - XP 증감 처리
 *
 * @example
 * ```tsx
 * const { gameState, addXP, spendXP } = useGameStateStore();
 * await addXP(50, 'block-1');
 * await spendXP(15);
 * ```
 */
export const useGameStateStore = create<GameStateStore>((set, get) => ({
  // 초기 상태
  gameState: null,
  loading: false,
  error: null,

  /**
   * 게임 상태 데이터 로드 (자동 날짜 확인)
   *
   * @returns {Promise<void>}
   * @throws {Error} 로드 실패 시
   * @sideEffects
   *   - 날짜가 변경되었으면 자동으로 일일 초기화 수행
   *   - 상태 업데이트
   */
  loadData: async () => {
    try {
      set({ loading: true, error: null });
      let gameStateData = await loadGameState();

      // 날짜가 바뀌었는지 확인
      const today = getLocalDate();
      if (gameStateData.lastLogin !== today) {
        gameStateData = await initializeNewDayInRepo();
      }

      set({ gameState: gameStateData, loading: false });
    } catch (err) {
      console.error('[GameStateStore] Failed to load game state:', err);
      set({ error: err as Error, loading: false });
    }
  },

  /**
   * XP 추가
   *
   * @param {number} amount - 추가할 XP 양 (음수 가능)
   * @param {string} [blockId] - 관련 블록 ID (선택)
   * @param {boolean} [skipEvents] - 이벤트 처리 건너뛰기 여부 (중복 방지)
   * @returns {Promise<void>}
   * @throws {Error} XP 추가 실패 시
   */
  addXP: async (amount: number, blockId?: string, skipEvents?: boolean) => {
    try {
      const result = await addXPToRepo(amount, blockId);
      set({ gameState: result.gameState });

      // skipEvents가 true이면 이벤트 처리 건너뛰기 (중복 방지)
      if (!skipEvents && result.events.length > 0) {
        const { gameStateEventHandler } = await import('@/shared/services/gameplay/gameState');
        await gameStateEventHandler.handleEvents(result.events);
      }
    } catch (err) {
      console.error('[GameStateStore] Failed to add XP:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  /**
   * XP 소비
   *
   * @param {number} amount - 소비할 XP 양
   * @returns {Promise<void>}
   * @throws {Error} XP 부족 또는 소비 실패 시
   */
  spendXP: async (amount: number) => {
    try {
      const updatedState = await spendXPFromRepo(amount);
      set({ gameState: updatedState });
    } catch (err) {
      console.error('[GameStateStore] Failed to spend XP:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  /**
   * 일일 초기화 (dailyXP 리셋, 퀘스트 리셋)
   *
   * @returns {Promise<void>}
   * @throws {Error} 초기화 실패 시
   */
  initializeNewDay: async () => {
    try {
      const updatedState = await initializeNewDayInRepo();
      set({ gameState: updatedState });
    } catch (err) {
      console.error('[GameStateStore] Failed to initialize new day:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  /**
   * 퀘스트 진행도 업데이트
   *
   * @param {string} questType - 퀘스트 유형
   * @param {number} [amount=1] - 증가량
   * @returns {Promise<void>}
   * @throws {Error} 업데이트 실패 시
   */
  updateQuestProgress: async (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks' | 'use_timer', amount: number = 1) => {
    try {
      const updatedState = await updateQuestProgressInRepo(questType, amount);
      set({ gameState: updatedState });
    } catch (err) {
      console.error('[GameStateStore] Failed to update quest progress:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  /**
   * 인벤토리 아이템 추가
   *
   * @param {string} itemId - 아이템 ID
   * @param {number} [amount=1] - 추가 수량
   * @returns {Promise<void>}
   */
  addItem: async (itemId: string, amount: number = 1) => {
    try {
      const { gameState } = get();
      if (!gameState) return;

      const currentInventory = gameState.inventory || {};
      const currentAmount = currentInventory[itemId] || 0;
      const newInventory = { ...currentInventory, [itemId]: currentAmount + amount };

      // Update local state immediately for responsiveness
      const updatedState = { ...gameState, inventory: newInventory };
      set({ gameState: updatedState });

      // Persist changes (using a new repo function or generic update)
      // For now, we'll assume a generic update function exists or we'll add it
      const { updateGameState } = await import('@/data/repositories/gameStateRepository');
      await updateGameState({ inventory: newInventory });

    } catch (err) {
      console.error('[GameStateStore] Failed to add item:', err);
      set({ error: err as Error });
      // Revert on error would be ideal here
    }
  },

  /**
   * 인벤토리 아이템 사용
   *
   * @param {string} itemId - 아이템 ID
   * @returns {Promise<void>}
   * @throws {Error} 아이템 없음 또는 사용 실패 시
   */
  useItem: async (itemId: string) => {
    try {
      const { gameState } = get();
      if (!gameState) return;

      const currentInventory = gameState.inventory || {};
      const currentAmount = currentInventory[itemId] || 0;

      if (currentAmount <= 0) {
        throw new Error('Item not available');
      }

      const newInventory = { ...currentInventory, [itemId]: currentAmount - 1 };

      // Update local state
      const updatedState = { ...gameState, inventory: newInventory };
      set({ gameState: updatedState });

      // Persist
      const { updateGameState } = await import('@/data/repositories/gameStateRepository');
      await updateGameState({ inventory: newInventory });

    } catch (err) {
      console.error('[GameStateStore] Failed to use item:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  /**
   * 수동 갱신 (강제 리로드)
   *
   * @returns {Promise<void>}
   */
  refresh: async () => {
    await get().loadData();
  },

  /**
   * 상태 초기화
   *
   * @returns {void}
   */
  reset: () => {
    set({
      gameState: null,
      loading: false,
      error: null,
    });
  },
}));
