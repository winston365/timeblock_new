/**
 * DailyData 훅
 *
 * @role 일일 데이터(작업, 블록 상태) 관리 및 전역 동기화
 * @input 날짜, 작업 CRUD, 블록 상태 업데이트
 * @output 일일 데이터, 작업 목록, 블록 상태 및 관리 함수
 * @external_dependencies
 *   - react: useEffect, useState hook
 *   - dailyDataStore: Zustand 기반 전역 상태 관리 스토어
 *   - utils: 날짜 유틸리티 함수
 *   - repositories: getRecentCompletedTasks
 */

import { useEffect, useState } from 'react';
import { useDailyDataStore } from '../stores/dailyDataStore';
import { getLocalDate } from '../lib/utils';
import { getRecentCompletedTasks } from '@/data/repositories';
import type { Task } from '@/shared/types/domain';

/**
 * 일일 데이터 관리 훅
 *
 * @param {string} [date] - 조회할 날짜 (YYYY-MM-DD), 기본값: 오늘
 * @returns {object} 일일 데이터 및 관리 함수
 * @returns {DailyData | null} dailyData - 일일 데이터 (작업, 블록 상태)
 * @returns {boolean} loading - 로딩 상태
 * @returns {Error | null} error - 에러 상태
 * @returns {() => Promise<void>} refresh - 데이터 새로고침
 * @returns {(tasks: Task[], timeBlockStates: object) => Promise<void>} saveData - 데이터 저장
 * @returns {(task: Task) => Promise<void>} addTask - 작업 추가
 * @returns {(taskId: string, updates: Partial<Task>, options?: { skipBehaviorTracking?: boolean }) => Promise<void>} updateTask - 작업 업데이트
 * @returns {(taskId: string) => Promise<void>} deleteTask - 작업 삭제
 * @returns {(taskId: string) => Promise<void>} toggleTaskCompletion - 작업 완료 토글
 * @returns {(blockId: string, updates: Partial<TimeBlockState>) => Promise<void>} updateBlockState - 블록 상태 업데이트
 * @returns {(blockId: string) => Promise<void>} toggleBlockLock - 블록 잠금 토글
 * @throws {Error} 데이터 로드, 저장 실패 시
 * @sideEffects dailyDataStore를 통해 전역 일일 데이터 변경
 */
export function useDailyData(date: string = getLocalDate()) {
  const store = useDailyDataStore();
  const { dailyData, currentDate, loading, error } = store;

  // 날짜가 변경되었을 때만 로드 (store 내부에서 중복 체크)
  useEffect(() => {
    if (date !== currentDate) {
      store.loadData(date);
    } else if (!dailyData && !loading) {
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
 * 완료된 작업만 가져오는 훅 (최근 7일)
 *
 * @param {number} [days=7] - 조회할 일수 (기본값: 7일)
 * @returns {object} 완료된 작업 정보
 * @returns {Task[]} completedTasks - 완료된 작업 목록 (최근 순)
 * @returns {boolean} loading - 로딩 상태
 * @returns {Error | null} error - 에러 상태
 * @sideEffects
 *   - 최근 N일의 완료된 작업을 비동기로 로드
 */
export function useCompletedTasks(days: number = 20) {
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCompletedTasks() {
      try {
        setLoading(true);
        const tasks = await getRecentCompletedTasks(days);
        if (isMounted) {
          setCompletedTasks(tasks);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load completed tasks:', err);
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCompletedTasks();

    return () => {
      isMounted = false;
    };
  }, [days]);

  return { completedTasks, loading, error };
}
