/**
 * useProgressUndo.ts
 *
 * @file 진행도 변경 Undo 훅
 * @description
 *   - T27: 5초 Undo 구현
 *   - 진행도 변경 후 5초 내 Undo 가능
 *   - 토스트로 Undo 버튼 제공
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { useToastStore } from '@/shared/stores/toastStore';
import { PROGRESS_UNDO } from '../constants/goalConstants';
import {
  getGoalsLastProgressChange,
  setGoalsLastProgressChange,
} from '../utils/goalSystemState';
import type { GoalsProgressChange } from '@/shared/constants/defaults';

interface UseProgressUndoReturn {
  /** 마지막 진행도 변경 */
  lastChange: GoalsProgressChange | null;
  /** Undo 실행 */
  executeUndo: () => Promise<void>;
  /** 진행도 변경 기록 */
  recordChange: (goalId: string, previousProgress: number, newProgress: number) => void;
  /** Undo 가능 여부 */
  canUndo: boolean;
  /** Undo 남은 시간 (밀리초) */
  remainingTime: number;
}

/**
 * 진행도 변경 Undo 훅
 */
export function useProgressUndo(): UseProgressUndoReturn {
  const [lastChange, setLastChange] = useState<GoalsProgressChange | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const setProgress = useWeeklyGoalStore((s) => s.setProgress);
  const addToast = useToastStore((s) => s.addToast);

  // 타이머 정리
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    let mounted = true;

    const loadLastChange = async () => {
      const change = await getGoalsLastProgressChange();
      if (mounted && change) {
        const elapsed = Date.now() - new Date(change.changedAt).getTime();
        if (elapsed < PROGRESS_UNDO.TIMEOUT_MS) {
          setLastChange(change);
          setRemainingTime(PROGRESS_UNDO.TIMEOUT_MS - elapsed);
        } else {
          // 만료된 변경 기록 삭제
          await setGoalsLastProgressChange(null);
        }
      }
    };

    void loadLastChange();

    return () => {
      mounted = false;
      clearTimers();
    };
  }, [clearTimers]);

  // 남은 시간 타이머
  useEffect(() => {
    if (remainingTime <= 0) {
      setLastChange(null);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 100) {
          setLastChange(null);
          void setGoalsLastProgressChange(null);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [remainingTime > 0]);

  // 진행도 변경 기록
  const recordChange = useCallback(
    (goalId: string, previousProgress: number, newProgress: number) => {
      clearTimers();

      const change: GoalsProgressChange = {
        goalId,
        previousProgress,
        newProgress,
        changedAt: new Date().toISOString(),
      };

      setLastChange(change);
      setRemainingTime(PROGRESS_UNDO.TIMEOUT_MS);
      void setGoalsLastProgressChange(change);

      // 5초 후 자동 만료
      timeoutRef.current = setTimeout(() => {
        setLastChange(null);
        void setGoalsLastProgressChange(null);
      }, PROGRESS_UNDO.TIMEOUT_MS);
    },
    [clearTimers]
  );

  // Undo 실행
  const executeUndo = useCallback(async () => {
    if (!lastChange) return;

    try {
      await setProgress(lastChange.goalId, lastChange.previousProgress);
      addToast('✅ 변경이 취소되었습니다.', 'success', 2000);
      
      // 상태 초기화
      clearTimers();
      setLastChange(null);
      setRemainingTime(0);
      await setGoalsLastProgressChange(null);
    } catch (error) {
      console.error('[useProgressUndo] Failed to undo:', error);
      addToast('취소 실패', 'error', 2000);
    }
  }, [lastChange, setProgress, addToast, clearTimers]);

  const canUndo = lastChange !== null && remainingTime > 0;

  return {
    lastChange,
    executeUndo,
    recordChange,
    canUndo,
    remainingTime,
  };
}
