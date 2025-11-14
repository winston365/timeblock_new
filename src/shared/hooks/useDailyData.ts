/**
 * DailyData 훅
 * 일일 데이터(작업, 블록 상태) 관리
 */

import { useState, useEffect, useCallback } from 'react';
import type { DailyData, Task, TimeBlockState } from '../types/domain';
import {
  loadDailyData,
  saveDailyData,
  addTask as addTaskToRepo,
  updateTask as updateTaskInRepo,
  deleteTask as deleteTaskFromRepo,
  toggleTaskCompletion as toggleTaskInRepo,
  updateBlockState as updateBlockStateInRepo,
  toggleBlockLock as toggleBlockLockInRepo,
} from '@/data/repositories';
import { getLocalDate } from '../lib/utils';

export function useDailyData(date: string = getLocalDate()) {
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadDailyData(date);
      setDailyData(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load daily data:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 데이터 저장
  const saveData = useCallback(
    async (tasks: Task[], timeBlockStates: DailyData['timeBlockStates']) => {
      if (!dailyData) return;

      try {
        await saveDailyData(date, tasks, timeBlockStates);
        setDailyData({ tasks, timeBlockStates, updatedAt: Date.now() });
      } catch (err) {
        setError(err as Error);
        console.error('Failed to save daily data:', err);
      }
    },
    [date, dailyData]
  );

  // Task 추가
  const addTask = useCallback(
    async (task: Task) => {
      try {
        await addTaskToRepo(task, date);
        await loadData();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [date, loadData]
  );

  // Task 업데이트
  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      try {
        await updateTaskInRepo(taskId, updates, date);
        await loadData();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [date, loadData]
  );

  // Task 삭제
  const deleteTask = useCallback(
    async (taskId: string) => {
      try {
        await deleteTaskFromRepo(taskId, date);
        await loadData();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [date, loadData]
  );

  // Task 완료 토글
  const toggleTaskCompletion = useCallback(
    async (taskId: string) => {
      try {
        await toggleTaskInRepo(taskId, date);
        await loadData();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [date, loadData]
  );

  // 블록 상태 업데이트
  const updateBlockState = useCallback(
    async (blockId: string, updates: Partial<TimeBlockState>) => {
      try {
        await updateBlockStateInRepo(blockId, updates, date);
        await loadData();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [date, loadData]
  );

  // 블록 잠금 토글
  const toggleBlockLock = useCallback(
    async (blockId: string) => {
      try {
        await toggleBlockLockInRepo(blockId, date);
        await loadData();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [date, loadData]
  );

  return {
    dailyData,
    loading,
    error,
    refresh: loadData,
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
