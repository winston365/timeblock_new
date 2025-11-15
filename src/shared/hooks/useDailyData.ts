/**
 * DailyData 훅
 * 일일 데이터(작업, 블록 상태) 관리
 *
 * Zustand store를 사용하여 전역 상태 관리 및 동기화 문제 해결
 */

import { useEffect } from 'react';
import { useDailyDataStore } from '../stores/dailyDataStore';
import { getLocalDate } from '../lib/utils';

export function useDailyData(date: string = getLocalDate()) {
  const {
    dailyData,
    currentDate,
    loading,
    error,
    loadData,
    saveData,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    updateBlockState,
    toggleBlockLock,
    refresh,
  } = useDailyDataStore();

  // 날짜가 변경되거나 초기 로드 시 데이터 로드
  useEffect(() => {
    if (date !== currentDate || !dailyData) {
      console.log(`[useDailyData] Loading data for ${date} (current: ${currentDate})`);
      loadData(date);
    }
  }, [date, currentDate, dailyData, loadData]);

  return {
    dailyData,
    loading,
    error,
    refresh,
    saveData,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    updateBlockState,
    toggleBlockLock,
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
