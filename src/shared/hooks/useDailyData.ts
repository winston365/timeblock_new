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
  addXP,
  spendXP,
  updateQuestProgress,
  increaseAffectionFromTask,
  loadGameState,
} from '@/data/repositories';
import { getLocalDate, calculateTaskXP } from '../lib/utils';
import { isBlockPerfect, isBlockFailed, BLOCK_LOCK_COST, PERFECT_BLOCK_REWARD } from '../utils/gamification';

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
        // 현재 task 상태 확인
        const currentData = await loadDailyData(date);
        const task = currentData.tasks.find(t => t.id === taskId);

        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }

        const wasCompleted = task.completed;

        // Task 완료 토글
        const updatedTask = await toggleTaskInRepo(taskId, date);

        // 완료 -> 미완료가 아니라, 미완료 -> 완료로 변경된 경우에만 XP & 퀘스트 & 와이푸 호감도 업데이트
        if (!wasCompleted && updatedTask.completed) {
          // XP 추가
          const xpAmount = calculateTaskXP(updatedTask);
          await addXP(xpAmount, updatedTask.timeBlock || undefined);

          // 퀘스트 업데이트
          await updateQuestProgress('complete_tasks', 1);
          await updateQuestProgress('earn_xp', xpAmount);

          // 와이푸 호감도 증가
          await increaseAffectionFromTask();
        }

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

  // 블록 잠금 토글 (XP 관리 포함)
  const toggleBlockLock = useCallback(
    async (blockId: string) => {
      try {
        const currentData = await loadDailyData(date);
        const blockState = currentData.timeBlockStates[blockId];
        const blockTasks = currentData.tasks.filter((t) => t.timeBlock === blockId);

        if (!blockState) {
          throw new Error(`Block state not found: ${blockId}`);
        }

        // 잠금 -> 해제
        if (blockState.isLocked) {
          // 완벽 완료 체크
          const isPerfect = isBlockPerfect(currentData.tasks, blockId);
          const isFailed = isBlockFailed(currentData.tasks, blockId, true);

          // 완벽 완료 시 보상
          if (isPerfect) {
            await addXP(PERFECT_BLOCK_REWARD, blockId);
            await updateQuestProgress('perfect_blocks', 1);
          }

          // 블록 상태 업데이트
          await updateBlockStateInRepo(
            blockId,
            { isLocked: false, isPerfect, isFailed },
            date
          );
        }
        // 해제 -> 잠금
        else {
          // XP 소비 가능 여부 확인
          const gameState = await loadGameState();
          if (gameState.availableXP < BLOCK_LOCK_COST) {
            throw new Error(`블록 잠금에 필요한 XP가 부족합니다. (필요: ${BLOCK_LOCK_COST} XP)`);
          }

          // 블록에 작업이 없으면 잠금 불가
          if (blockTasks.length === 0) {
            throw new Error('작업이 없는 블록은 잠금할 수 없습니다.');
          }

          // XP 소비
          await spendXP(BLOCK_LOCK_COST);

          // 블록 잠금
          await updateBlockStateInRepo(blockId, { isLocked: true }, date);

          // 퀘스트 업데이트
          await updateQuestProgress('lock_blocks', 1);
        }

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
