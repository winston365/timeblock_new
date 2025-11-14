/**
 * GameState 훅
 * 게임 상태(XP, 레벨, 퀘스트) 관리
 */

import { useState, useEffect, useCallback } from 'react';
import type { GameState } from '../types/domain';
import {
  loadGameState,
  addXP as addXPToRepo,
  spendXP as spendXPFromRepo,
  initializeNewDay as initializeNewDayInRepo,
  updateQuestProgress as updateQuestProgressInRepo,
} from '@/data/repositories';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadGameState();
      setGameState(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load game state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // XP 추가
  const addXP = useCallback(
    async (amount: number, blockId?: string) => {
      try {
        const updatedState = await addXPToRepo(amount, blockId);
        setGameState(updatedState);
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  // XP 소비
  const spendXP = useCallback(
    async (amount: number) => {
      try {
        const updatedState = await spendXPFromRepo(amount);
        setGameState(updatedState);
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  // 일일 초기화
  const initializeNewDay = useCallback(async () => {
    try {
      const updatedState = await initializeNewDayInRepo();
      setGameState(updatedState);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  // 퀘스트 진행도 업데이트
  const updateQuestProgress = useCallback(
    async (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks', amount: number = 1) => {
      try {
        const updatedState = await updateQuestProgressInRepo(questType, amount);
        setGameState(updatedState);
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  // 수동 갱신
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    gameState,
    loading,
    error,
    refresh,
    addXP,
    spendXP,
    initializeNewDay,
    updateQuestProgress,
  };
}

/**
 * XP 정보만 가져오는 훅
 */
export function useXP() {
  const { gameState, loading } = useGameState();

  return {
    totalXP: gameState?.totalXP ?? 0,
    dailyXP: gameState?.dailyXP ?? 0,
    availableXP: gameState?.availableXP ?? 0,
    level: gameState?.level ?? 1,
    loading,
  };
}

/**
 * 퀘스트 정보만 가져오는 훅
 */
export function useQuests() {
  const { gameState, loading, updateQuestProgress } = useGameState();

  return {
    quests: gameState?.dailyQuests ?? [],
    loading,
    updateQuestProgress,
  };
}
