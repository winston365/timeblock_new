/**
 * GameState 훅
 * 게임 상태(XP, 레벨, 퀘스트) 관리
 *
 * Zustand store를 사용하여 전역 상태 관리 및 동기화 문제 해결
 */

import { useEffect } from 'react';
import { useGameStateStore } from '../stores/gameStateStore';

export function useGameState() {
  const {
    gameState,
    loading,
    error,
    loadData,
    addXP,
    spendXP,
    initializeNewDay,
    updateQuestProgress,
    refresh,
  } = useGameStateStore();

  // 초기 로드
  useEffect(() => {
    if (!gameState) {
      console.log('[useGameState] Loading game state');
      loadData();
    }
  }, [gameState, loadData]);

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
