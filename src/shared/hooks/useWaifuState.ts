/**
 * WaifuState 훅
 * 와이푸 상태(호감도, 포즈, 상호작용) 관리
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
