/**
 * @file useTaskControl.ts
 * @description FocusView의 작업 제어 + 타이머(자동완료/휴식) 로직을 캡슐화합니다.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import type { Task } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';

export type ToggleOptions = {
  readonly skipBonus?: boolean;
  readonly bonusReason?: 'autoTimer';
};

export interface UseTaskControlParams {
  readonly activeTaskId: string | null;
  readonly activeTaskStartTime: number | null;
  readonly isPaused: boolean;

  readonly startTask: (taskId: string) => void;
  readonly stopTask: () => void;

  readonly currentBlockTasks: readonly Task[];
  readonly allDailyTasks: readonly Task[];

  readonly onToggleTask: (taskId: string) => Promise<void> | void;

  /** 활성 작업을 중단했을 때 추가로 수행할 사이드이펙트(예: 메모 초기화) */
  readonly onActiveTaskStopped?: () => void;
}

export interface UseTaskControlResult {
  readonly now: number;

  readonly isBreakTime: boolean;
  readonly breakRemainingSeconds: number | null;

  readonly startBreakForNextTask: (completedTaskId: string | null) => void;
  readonly endBreak: () => void;
  readonly resetBreak: () => void;

  readonly handleToggleTaskWrapper: (taskId: string, options?: ToggleOptions) => Promise<void>;
}

export const useTaskControl = (params: UseTaskControlParams): UseTaskControlResult => {
  const [now, setNow] = useState(Date.now());
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [breakRemainingSeconds, setBreakRemainingSeconds] = useState<number | null>(null);
  const [pendingNextTaskId, setPendingNextTaskId] = useState<string | null>(null);

  // 현재 시각 상태 (타이머/슬롯 라벨용)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startBreakForNextTask = useCallback(
    (completedTaskId: string | null) => {
      const nextTask = params.currentBlockTasks.find(
        (t) => !t.completed && t.id !== completedTaskId,
      );

      setIsBreakTime(true);
      setBreakRemainingSeconds(60);
      setPendingNextTaskId(nextTask?.id ?? null);
    },
    [params.currentBlockTasks],
  );

  const endBreak = useCallback(() => {
    setIsBreakTime(false);
    setBreakRemainingSeconds(null);
    setPendingNextTaskId(null);
  }, []);

  const resetBreak = useCallback(() => {
    setIsBreakTime(false);
    setBreakRemainingSeconds(null);
    setPendingNextTaskId(null);
  }, []);

  const handleToggleTaskWrapper = useCallback(
    async (taskId: string, options?: ToggleOptions) => {
      const isCompletingActiveTask = taskId === params.activeTaskId;
      const task =
        params.currentBlockTasks.find((t) => t.id === taskId) ||
        params.allDailyTasks.find((t) => t.id === taskId) ||
        null;

      try {
        await params.onToggleTask(taskId);

        // 집중 모드에서 자동(타이머 만료) 완료 시에만 추가 XP 보너스 지급 (총 4배)
        if (
          isCompletingActiveTask &&
          task &&
          !task.completed &&
          options?.bonusReason === 'autoTimer' &&
          !options?.skipBonus
        ) {
          const bonusXP = calculateTaskXP(task) * 3;
          const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
          const gameStateStore = useGameStateStore.getState();
          await gameStateStore.addXP(bonusXP, task.timeBlock || undefined);
        }

        if (isCompletingActiveTask) {
          params.stopTask();
          params.onActiveTaskStopped?.();
          startBreakForNextTask(taskId);
        }
      } catch (error) {
        console.error('[FocusView] Failed to toggle task:', error);
        toast.error('작업 완료 처리 중 문제가 발생했습니다.');
      }
    },
    [
      params.activeTaskId,
      params.allDailyTasks,
      params.currentBlockTasks,
      params.onToggleTask,
      params.onActiveTaskStopped,
      params.stopTask,
      startBreakForNextTask,
    ],
  );

  // 작업 시간 경과 시 자동 완료 (보너스 XP 적용)
  useEffect(() => {
    if (!params.activeTaskId || !params.activeTaskStartTime || params.isPaused || isBreakTime) return;

    const activeTask =
      params.currentBlockTasks.find((t) => t.id === params.activeTaskId) ||
      params.allDailyTasks.find((t) => t.id === params.activeTaskId) ||
      null;

    if (!activeTask || activeTask.completed) return;

    const elapsedSeconds = Math.floor((now - params.activeTaskStartTime) / 1000);
    const totalSeconds = (activeTask.baseDuration || 0) * 60;

    if (totalSeconds > 0 && elapsedSeconds >= totalSeconds) {
      void handleToggleTaskWrapper(params.activeTaskId, { bonusReason: 'autoTimer' });
    }
  }, [
    now,
    params.activeTaskId,
    params.activeTaskStartTime,
    params.isPaused,
    params.currentBlockTasks,
    params.allDailyTasks,
    handleToggleTaskWrapper,
    isBreakTime,
  ]);

  // 휴식 타이머 관리
  useEffect(() => {
    if (!isBreakTime || breakRemainingSeconds === null) return;

    const interval = setInterval(() => {
      setBreakRemainingSeconds((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(interval);
          setIsBreakTime(false);

          if (pendingNextTaskId) {
            params.startTask(pendingNextTaskId);
          }

          setPendingNextTaskId(null);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isBreakTime, breakRemainingSeconds, pendingNextTaskId, params.startTask]);

  return {
    now,
    isBreakTime,
    breakRemainingSeconds,
    startBreakForNextTask,
    endBreak,
    resetBreak,
    handleToggleTaskWrapper,
  };
};
