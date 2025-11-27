/**
 * GameState 훅
 *
 * @role 게임 상태(XP, 퀘스트) 관리 및 전역 동기화
 * @input XP 획득/소비, 퀘스트 진행, 일일 초기화
 * @output 게임 상태, XP, 퀘스트 목록 및 관리 함수
 * @external_dependencies
 *   - react: useEffect, useRef hooks
 *   - gameStateStore: Zustand 기반 전역 상태 관리 스토어
 */

import { useEffect, useRef } from 'react';
import { useGameStateStore } from '../stores/gameStateStore';

/**
 * 게임 상태 관리 훅
 *
 * @returns {object} 게임 상태 및 관리 함수
 * @returns {GameState | null} gameState - 현재 게임 상태 (XP, 퀘스트 등)
 * @returns {boolean} loading - 로딩 상태
 * @returns {Error | null} error - 에러 상태
 * @returns {() => Promise<void>} refresh - 게임 상태 새로고침
 * @returns {(amount: number, blockId?: string) => Promise<void>} addXP - XP 추가
 * @returns {(amount: number) => Promise<void>} spendXP - XP 소비
 * @returns {() => Promise<void>} initializeNewDay - 새로운 날 초기화
 * @returns {(questType: string, amount?: number) => Promise<void>} updateQuestProgress - 퀘스트 진행도 업데이트
 * @throws {Error} XP 부족, 데이터 로드 실패 시
 * @sideEffects gameStateStore를 통해 전역 게임 상태 변경
 */
export function useGameState() {
  const store = useGameStateStore();
  const { gameState, loading, error } = store;
  const hasInitialized = useRef(false);

  // 초기 로드 - 한 번만 실행
  useEffect(() => {
    if (!hasInitialized.current && !gameState) {
      hasInitialized.current = true;
      store.loadData();
    }
  }, []); // 빈 배열로 한 번만 실행

  return {
    gameState,
    loading,
    error,
    refresh: store.refresh,
    addXP: store.addXP,
    spendXP: store.spendXP,
    initializeNewDay: store.initializeNewDay,
    updateQuestProgress: store.updateQuestProgress,
  };
}

/**
 * 퀘스트 정보만 가져오는 훅
 *
 * @returns {object} 퀘스트 관련 정보 및 함수
 * @returns {Array} quests - 일일 퀘스트 목록
 * @returns {boolean} loading - 로딩 상태
 * @returns {(questType: string, amount?: number) => Promise<void>} updateQuestProgress - 퀘스트 진행도 업데이트
 * @sideEffects updateQuestProgress 호출 시 전역 상태 변경
 */
export function useQuests() {
  const { gameState, loading, updateQuestProgress } = useGameState();

  return {
    quests: gameState?.dailyQuests ?? [],
    loading,
    updateQuestProgress,
  };
}
