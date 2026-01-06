/**
 * @file useScheduleSync.ts
 * @description ScheduleView의 워밍업/상태 초기화/자동 삽입 등 비-렌더 오케스트레이션 훅
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { UpdateTaskOptions } from '@/shared/stores/dailyDataStore/types';
import { TIME_BLOCKS, type DailyData, type Task, type TimeBlockId, type TimeBlockState, type WarmupPresetItem } from '@/shared/types/domain';
import { createNewTask } from '@/shared/utils/taskFactory';

import {
  fetchWarmupPreset,
  loadWarmupAutoGenerateEnabled,
  persistWarmupAutoGenerateEnabled,
  syncWarmupPreset,
} from '../services/scheduleOrchestrator';

export interface UseScheduleSyncParams {
  readonly currentHour: number;
  readonly dailyData: DailyData | null;

  readonly defaultWarmupPreset: readonly WarmupPresetItem[];
  readonly defaultWarmupAutoGenerateEnabled: boolean;

  readonly addTask: (task: Task) => Promise<void>;
  readonly updateTask: (taskId: string, updates: Partial<Task>, options?: UpdateTaskOptions) => Promise<void>;
  readonly updateBlockState: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;

  readonly closeWarmupModal: () => void;
}

export interface UseScheduleSyncResult {
  readonly warmupPreset: WarmupPresetItem[];
  readonly warmupAutoGenerateEnabled: boolean;

  readonly handleWarmupAutoGenerateToggle: (enabled: boolean) => void;
  readonly handleSaveWarmupPreset: (preset: WarmupPresetItem[]) => void;
  readonly handleApplyWarmupFromModal: (preset: WarmupPresetItem[]) => void;
}

const getNextWarmupTarget = (hour: number): { blockId: TimeBlockId; hourSlot: number } | null => {
  const targetHour = hour + 1;
  const blockForTargetHour = TIME_BLOCKS.find((b) => targetHour >= b.start && targetHour < b.end);
  if (blockForTargetHour) {
    return { blockId: blockForTargetHour.id as TimeBlockId, hourSlot: targetHour };
  }

  const nextBlock = TIME_BLOCKS.find((b) => b.start > hour);
  if (nextBlock) {
    return { blockId: nextBlock.id as TimeBlockId, hourSlot: nextBlock.start };
  }

  return null;
};

export const useScheduleSync = (params: UseScheduleSyncParams): UseScheduleSyncResult => {
  const [warmupPreset, setWarmupPreset] = useState<WarmupPresetItem[]>([...params.defaultWarmupPreset]);
  const [warmupAutoGenerateEnabled, setWarmupAutoGenerateEnabled] = useState<boolean>(
    params.defaultWarmupAutoGenerateEnabled,
  );

  const autoInsertedRef = useRef<Set<string>>(new Set());
  const lastAutoCheckRef = useRef<string | null>(null);

  const insertWarmupTasks = useCallback(
    async (blockId: TimeBlockId, hourSlot?: number, preset: readonly WarmupPresetItem[] = warmupPreset) => {
      const targetBlock = TIME_BLOCKS.find((b) => b.id === blockId);
      const targetHour = hourSlot ?? targetBlock?.start;
      if (!targetBlock || targetHour === undefined) return;

      for (const warmupItem of preset) {
        const newTask = createNewTask(warmupItem.text, {
          baseDuration: warmupItem.baseDuration,
          resistance: warmupItem.resistance,
          timeBlock: blockId,
          hourSlot: targetHour,
        });
        await params.addTask(newTask);
      }
    },
    [params.addTask, warmupPreset],
  );

  // 워밍업 프리셋 로드 (Firebase)
  useEffect(() => {
    let mounted = true;

    fetchWarmupPreset()
      .then((remotePreset) => {
        if (!mounted) return;
        if (remotePreset && remotePreset.length > 0) {
          setWarmupPreset(remotePreset);
        }
      })
      .catch((error) => {
        console.error('Failed to load warmup preset:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 워밍업 자동생성 플래그 로드 (Dexie systemState)
  useEffect(() => {
    let mounted = true;

    loadWarmupAutoGenerateEnabled(params.defaultWarmupAutoGenerateEnabled)
      .then((enabled) => {
        if (!mounted) return;
        setWarmupAutoGenerateEnabled(enabled);
      })
      .catch((error) => {
        console.error('Failed to load warmup auto-generate setting:', error);
      });

    return () => {
      mounted = false;
    };
  }, [params.defaultWarmupAutoGenerateEnabled]);

  // 매 시간 50분에 자동 체크 후 다음 시간대(같은 블록이든 다음 블록이든)에 삽입 (22:50~03:50 제외)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!warmupAutoGenerateEnabled) return;
      if (!params.dailyData) return;

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      if (minute !== 50) return;
      if ([22, 23, 0, 1, 2, 3].includes(hour)) return;

      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;
      if (lastAutoCheckRef.current === key) return;
      lastAutoCheckRef.current = key;

      const currentBlock = TIME_BLOCKS.find((b) => hour >= b.start && hour < b.end);
      if (!currentBlock) return;

      const currentBlockTasks = params.dailyData.tasks.filter((t) => t.timeBlock === currentBlock.id);
      const completedCount = currentBlockTasks.filter((t) => t.completed).length;
      if (completedCount > 0) return;

      // 대상 시간대: 현재 시간 +1 시간이 동일 블록 안에 있으면 그대로, 아니면 다음 블록 시작 시간
      const targetHour = hour + 1;
      let targetBlock = TIME_BLOCKS.find((b) => targetHour >= b.start && targetHour < b.end);
      let targetHourInBlock = targetHour;

      if (!targetBlock) {
        const nextIndex = TIME_BLOCKS.findIndex((b) => b.id === currentBlock.id) + 1;
        if (nextIndex >= TIME_BLOCKS.length) return;
        targetBlock = TIME_BLOCKS[nextIndex];
        targetHourInBlock = targetBlock.start;
      }

      const targetKey = `${targetBlock.id}-${targetHourInBlock}`;
      if (autoInsertedRef.current.has(targetKey)) return;

      const targetTasks = params.dailyData.tasks.filter(
        (t) => t.timeBlock === targetBlock.id && t.hourSlot === targetHourInBlock,
      );
      if (targetTasks.length > 2) return;

      insertWarmupTasks(targetBlock.id as TimeBlockId, targetHourInBlock, warmupPreset)
        .then(() => {
          autoInsertedRef.current.add(targetKey);
        })
        .catch((error) => {
          console.error('Failed to auto-insert warmup tasks:', error);
        });
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [insertWarmupTasks, params.dailyData, warmupAutoGenerateEnabled, warmupPreset]);

  // 지난 타임블록의 미완료 작업을 인박스로 이동 + 상태 처리
  useEffect(() => {
    const movePastIncompleteTasks = async () => {
      if (!params.dailyData) return;

      const currentTime = new Date();
      const currentHourValue = currentTime.getHours();
      const pastBlocksList = TIME_BLOCKS.filter((block) => currentHourValue >= block.end);

      const tasksToMove: Task[] = [];
      for (const block of pastBlocksList) {
        const incompleteTasks = params.dailyData.tasks.filter(
          (task) => task.timeBlock === block.id && !task.completed,
        );
        const blockState = params.dailyData.timeBlockStates[block.id];

        if (blockState?.isLocked && incompleteTasks.length > 0 && !blockState.isFailed) {
          try {
            const { updateBlockState: repoUpdateBlockState } = await import('@/data/repositories/dailyDataRepository');
            await repoUpdateBlockState(block.id, { isFailed: true });
          } catch (error) {
            console.error(`Failed to set isFailed for block ${block.id}:`, error);
          }
        }

        tasksToMove.push(...incompleteTasks);
      }

      for (const task of tasksToMove) {
        try {
          await params.updateTask(
            task.id,
            { timeBlock: null, hourSlot: undefined },
            { skipBehaviorTracking: true, ignoreLock: true },
          );
        } catch (error) {
          console.error(`Failed to move task ${task.id} to inbox:`, error);
        }
      }
    };

    void movePastIncompleteTasks();
  }, [params.currentHour, params.dailyData, params.updateTask]);

  // 타임블록 상태 초기화
  useEffect(() => {
    if (!params.dailyData) return;

    const missingBlocks = TIME_BLOCKS.filter((block) => !params.dailyData?.timeBlockStates[block.id]);
    if (missingBlocks.length === 0) return;

    (async () => {
      for (const block of missingBlocks) {
        try {
          await params.updateBlockState(block.id, {
            isLocked: false,
            isPerfect: false,
            isFailed: false,
          });
        } catch (error) {
          console.error('Failed to initialize block state:', error);
        }
      }
    })();
  }, [params.dailyData, params.updateBlockState]);

  const handleWarmupAutoGenerateToggle = useCallback((enabled: boolean) => {
    setWarmupAutoGenerateEnabled(enabled);

    persistWarmupAutoGenerateEnabled(enabled).catch((error) => {
      console.error('Failed to persist warmup auto-generate setting:', error);
    });
  }, []);

  const handleSaveWarmupPreset = useCallback(
    (preset: WarmupPresetItem[]) => {
      setWarmupPreset(preset);
      syncWarmupPreset(preset).catch((error) => console.error('Failed to sync warmup preset:', error));
      params.closeWarmupModal();
    },
    [params.closeWarmupModal],
  );

  const handleApplyWarmupFromModal = useCallback(
    (preset: WarmupPresetItem[]) => {
      const target = getNextWarmupTarget(params.currentHour);
      if (!target) return;

      insertWarmupTasks(target.blockId, target.hourSlot, preset).catch((error) => {
        console.error('Failed to apply warmup preset:', error);
      });

      syncWarmupPreset(preset).catch((error) => console.error('Failed to sync warmup preset:', error));
      params.closeWarmupModal();
    },
    [insertWarmupTasks, params.closeWarmupModal, params.currentHour],
  );

  return {
    warmupPreset,
    warmupAutoGenerateEnabled,
    handleWarmupAutoGenerateToggle,
    handleSaveWarmupPreset,
    handleApplyWarmupFromModal,
  };
};
