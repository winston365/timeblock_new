/**
 * DailyData 훅
 * 일일 데이터(작업, 블록 상태) 관리
 *
 * Zustand store를 사용하여 전역 상태 관리 및 동기화 문제 해결
 */

import { useEffect, useRef } from 'react';
import { useDailyDataStore } from '../stores/dailyDataStore';
import { getLocalDate } from '../lib/utils';

export function useDailyData(date: string = getLocalDate()) {
  const store = useDailyDataStore();
  const { dailyData, currentDate, loading, error } = store;
  const hasInitialized = useRef(false);

  // 초기 로드 - 한 번만 실행
  useEffect(() => {
    const needsLoad = !hasInitialized.current || date !== currentDate || !dailyData;
    
    if (needsLoad) {
      console.log(`[useDailyData] Loading data for ${date}`);
      hasInitialized.current = true;
      store.loadData(date);
    }
  }, [date]); // date만 의존성으로 유지

  return {
    dailyData,
    loading,
    error,
    refresh: store.refresh,
    saveData: store.saveData,
    addTask: store.addTask,
    updateTask: store.updateTask,
    deleteTask: store.deleteTask,
    toggleTaskCompletion: store.toggleTaskCompletion,
    updateBlockState: store.updateBlockState,
    toggleBlockLock: store.toggleBlockLock,
  };
}

/**
 * 인박스 작업만 가져오는 훅
 */
export function useInboxTasks(date: string = getLocalDate()) {
  const { dailyData, loading, error } = useDailyData(date);

  const inboxTasks = dailyData?.tasks.filter(task => !task.timeBlock) ?? [];

  return { inboxTasks, loading, error };
}

/**
 * 완료된 작업만 가져오는 훅
 */
export function useCompletedTasks(date: string = getLocalDate()) {
  const { dailyData, loading, error } = useDailyData(date);

  const completedTasks = dailyData?.tasks.filter(task => task.completed) ?? [];

  return { completedTasks, loading, error };
}

/**
 * 특정 블록의 작업만 가져오는 훅
 */
export function useBlockTasks(blockId: string, date: string = getLocalDate()) {
  const { dailyData, loading, error } = useDailyData(date);

  const blockTasks = dailyData?.tasks.filter(task => task.timeBlock === blockId) ?? [];

  return { blockTasks, loading, error };
}
