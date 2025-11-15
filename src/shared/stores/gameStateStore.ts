/**
 * GameState Zustand Store
 *
 * @role 게임 상태(XP, 레벨, 퀘스트)의 전역 상태 관리 및 자동 일일 초기화
 * @input XP 획득/소비, 퀘스트 진행, 날짜 변경 감지
 * @output 게임 상태, XP, 레벨, 퀘스트 목록 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - repositories: 게임 상태, XP, 퀘스트 데이터 레포지토리
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
  addXP: (amount: number, blockId?: string) => Promise<void>;
  spendXP: (amount: number) => Promise<void>;
  initializeNewDay: () => Promise<void>;
  updateQuestProgress: (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks', amount?: number) => Promise<void>;
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
 *   - XP 증감 및 레벨 업 처리
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

  // 데이터 로드 (자동 날짜 확인)
  loadData: async () => {
    try {
      set({ loading: true, error: null });
      let data = await loadGameState();

      // 날짜가 바뀌었는지 확인
      const today = getLocalDate();
      if (data.lastLogin !== today) {
        data = await initializeNewDayInRepo();
      }

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
  updateQuestProgress: async (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks', amount: number = 1) => {
    try {
      const updatedState = await updateQuestProgressInRepo(questType, amount);
      set({ gameState: updatedState });
    } catch (err) {
      console.error('[GameStateStore] Failed to update quest progress:', err);
      set({ error: err as Error });
      throw err;
    }
  },

  // 수동 갱신 (강제 리로드)
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
