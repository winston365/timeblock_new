/**
 * WaifuState 훅
 *
 * @role 와이푸 상태(호감도, 포즈, 상호작용) 관리 및 UI 동기화
 * @input 작업 완료, 와이푸 클릭 상호작용
 * @output 와이푸 상태, 호감도, 기분, 대사, 상호작용 함수
 * @external_dependencies
 *   - react: useState, useEffect, useCallback hooks
 *   - waifuRepository: 와이푸 데이터 CRUD 및 비즈니스 로직
 */

import { useState, useEffect, useCallback } from 'react';
import type { WaifuState } from '../types/domain';
import {
  loadWaifuState,
  increaseAffectionFromTask,
  interactWithWaifu,
  resetDailyWaifuStats,
  getMoodFromAffection,
  getDialogueFromAffection,
} from '@/data/repositories/waifuRepository';

/**
 * 와이푸 상태 관리 훅
 *
 * @returns {object} 와이푸 상태 및 관리 함수
 * @returns {WaifuState | null} waifuState - 현재 와이푸 상태 (호감도, 포즈 등)
 * @returns {boolean} loading - 로딩 상태
 * @returns {Error | null} error - 에러 상태
 * @returns {() => Promise<void>} refresh - 와이푸 상태 새로고침
 * @returns {() => Promise<void>} onTaskComplete - 작업 완료 시 호감도 증가
 * @returns {() => Promise<void>} onInteract - 와이푸 클릭 상호작용
 * @returns {() => Promise<void>} resetDaily - 일일 와이푸 통계 초기화
 * @returns {string} currentMood - 현재 기분 이모지 및 텍스트
 * @returns {string} currentDialogue - 현재 와이푸 대사
 * @throws {Error} 데이터 로드, 상태 업데이트 실패 시
 * @sideEffects waifuRepository를 통해 와이푸 상태 변경 및 저장
 */
export function useWaifuState() {
  const [waifuState, setWaifuState] = useState<WaifuState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadWaifuState();
      setWaifuState(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load waifu state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 작업 완료 시 호감도 증가
  const onTaskComplete = useCallback(async () => {
    try {
      const updatedState = await increaseAffectionFromTask();
      setWaifuState(updatedState);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  // 와이푸 클릭 상호작용
  const onInteract = useCallback(async () => {
    try {
      const updatedState = await interactWithWaifu();
      setWaifuState(updatedState);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  // 일일 초기화
  const resetDaily = useCallback(async () => {
    try {
      const updatedState = await resetDailyWaifuStats();
      setWaifuState(updatedState);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  // 수동 갱신
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // 현재 기분 가져오기
  const currentMood = waifuState ? getMoodFromAffection(waifuState.affection) : '😐 보통';

  // 현재 대사 가져오기
  const currentDialogue = waifuState
    ? getDialogueFromAffection(waifuState.affection, waifuState.tasksCompletedToday)
    : '안녕하세요!';

  return {
    waifuState,
    loading,
    error,
    refresh,
    onTaskComplete,
    onInteract,
    resetDaily,
    currentMood,
    currentDialogue,
  };
}
