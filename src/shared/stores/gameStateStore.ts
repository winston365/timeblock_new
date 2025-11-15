/**
 * GameState Zustand Store
 * 게임 상태 전역 관리
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

interface GameStateStore {
  // 상태
  gameState: GameState | null;
  loading: boolean;
  error: Error | null;

  // 액션
  loadData: () => Promise<void>;
  addXP: (amount: number, blockId?: string) => Promise<void>;
  spendXP: (amount: number) => Promise<void>;
  initializeNewDay: () => Promise<void>;
  updateQuestProgress: (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks', amount?: number) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  // 초기 상태
  gameState: null,
  loading: false,
  error: null,

  // 데이터 로드
  loadData: async () => {
    try {
      set({ loading: true, error: null });
      const data = await loadGameState();
      console.log('[GameStateStore] Loaded game state:', data);
      set({ gameState: data, loading: false });
    } catch (err) {
      console.error('[GameStateStore] Failed to load game state:', err);
      set({ error: err as Error, loading: false });
    }
  },

  // XP 추가
  addXP: async (amount: number, blockId?: string) => {
    try {
      const updatedState = await addXPToRepo(amount, blockId);
      set({ gameState: updatedState });
    } catch (err) {
      console.error('[GameStateStore] Failed to add XP:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // XP 소비
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

  // 일일 초기화
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

  // 퀘스트 진행도 업데이트
  updateQuestProgress: async (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks', amount: number = 1) => {
    try {
      const updatedState = await updateQuestProgressInRepo(questType, amount);
      set({ gameState: updatedState });
    } catch (err) {
      console.error('[GameStateStore] Failed to update quest progress:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // 수동 갱신
  refresh: async () => {
    await get().loadData();
  },

  // 상태 초기화
  reset: () => {
    set({
      gameState: null,
      loading: false,
      error: null,
    });
  },
}));
