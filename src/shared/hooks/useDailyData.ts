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
  const store = useDailyDataStore();
  const { dailyData, currentDate, loading, error } = store;

  // 날짜가 변경되었을 때만 로드 (store 내부에서 중복 체크)
  useEffect(() => {
    if (date !== currentDate) {
      console.log(`[useDailyData] Date changed: ${currentDate} → ${date}`);
      store.loadData(date);
    } else if (!dailyData && !loading) {
      console.log(`[useDailyData] No data for ${date}, loading...`);
      store.loadData(date);
    } else {
      console.log(`[useDailyData] Using existing data for ${date}`, {
        tasksCount: dailyData?.tasks?.length || 0,
        loading,
      });
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
