/**
 * @file useTimelineData.ts
 * @role 타임라인 뷰를 위한 작업 데이터 변환 훅
 * @responsibilities
 *   - dailyDataStore에서 tasks 구독
 *   - hourSlot 기준 그룹화 및 order 정렬
 *   - 시간대별 작업 블록 위치/높이 계산
 * @dependencies dailyDataStore, Task 타입, systemRepository
 */

import { useMemo, useState, useEffect } from 'react';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { TIME_BLOCKS, type Task } from '@/shared/types/domain';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';
import { getBucketStartHour } from '../utils/timeBlockBucket';
import { getBlockById, getEffectiveTimeBlockIdForTask } from '@/shared/utils/timeBlockUtils';

/** 타임라인 시간 범위 (TIME_BLOCKS 기준) */
export const TIMELINE_START_HOUR = TIME_BLOCKS[0]?.start ?? 0;
export const TIMELINE_END_HOUR = TIME_BLOCKS[TIME_BLOCKS.length - 1]?.end ?? 24;
export const TIMELINE_TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;

/** 픽셀 상수 */
export const HOUR_HEIGHT = 60; // 1시간당 60px
export const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60; // 1분당 1px

/** TIME_BLOCKS 구분선 위치 (시작 시간) */
export const BLOCK_BOUNDARIES = [
  ...TIME_BLOCKS.map((b) => b.start),
  TIMELINE_END_HOUR,
];

/** 타임라인 작업 블록 정보 */
export interface TimelineTaskItem {
  task: Task;
  top: number;       // 시작 위치 (px)
  height: number;    // 블록 높이 (px)
  bucketStartHour: number; // 버킷 시작 시간
  orderInBucket: number; // 같은 버킷 내 순서 (0-based)
}

/** 버킷별 작업 그룹 */
export interface BucketGroup {
  bucketStartHour: number;
  tasks: Task[];
  totalDuration: number;
}

/**
 * 타임라인 데이터 훅
 * @returns timelineItems (위치 계산된 작업 목록), hourGroups (시간대별 그룹)
 */
export function useTimelineData() {
  const dailyData = useDailyDataStore(state => state.dailyData);
  
  // 타임라인 전용 showPastBlocks 상태 (독립적으로 관리)
  const [showPastBlocks, setShowPastBlocks] = useState(false); // 기본값: 지난 블록 숨김

  // systemRepository에서 초기값 로드
  useEffect(() => {
    const loadState = async () => {
      try {
        const state = await getSystemState<boolean>(SYSTEM_KEYS.TIMELINE_SHOW_PAST);
        if (state === true) {
          setShowPastBlocks(true);
        }
      } catch (error) {
        console.error('Failed to load timeline showPastBlocks:', error);
      }
    };
    loadState();
  }, []);

  // 토글 함수
  const toggleShowPastBlocks = async () => {
    const newValue = !showPastBlocks;
    setShowPastBlocks(newValue);
    try {
      await setSystemState(SYSTEM_KEYS.TIMELINE_SHOW_PAST, newValue);
    } catch (error) {
      console.error('Failed to save timeline showPastBlocks:', error);
    }
  };

  // 현재 시간 기준으로 지난 버킷의 시작 시간 계산
  const currentHour = new Date().getHours();
  const currentBucketStartHour = getBucketStartHour(currentHour);
  // 지난 블록 숨기기 모드일 때: 현재 버킷부터 표시
  const visibleStartHour = showPastBlocks
    ? TIMELINE_START_HOUR
    : Math.max(TIMELINE_START_HOUR, currentBucketStartHour);

  // 버킷별 작업 그룹화 및 정렬
  const bucketGroups = useMemo<BucketGroup[]>(() => {
    const tasks = dailyData?.tasks ?? [];
    const groups: Map<number, Task[]> = new Map();

    const bucketStartHours = TIME_BLOCKS
      .map((b) => b.start)
      .filter((start) => start >= visibleStartHour && start < TIMELINE_END_HOUR);

    bucketStartHours.forEach((start) => {
      groups.set(start, []);
    });

    // 작업을 TIME_BLOCKS 버킷(타임블록)별로 분류 (visibleStartHour 이후만)
    tasks.forEach((task) => {
      const effectiveBlockId = getEffectiveTimeBlockIdForTask(task);
      const effectiveBlock = getBlockById(effectiveBlockId);
      if (!effectiveBlock) return;

      const bucketStart = effectiveBlock.start;
      if (bucketStart < visibleStartHour || bucketStart >= TIMELINE_END_HOUR) return;

      const bucketTasks = groups.get(bucketStart);
      bucketTasks?.push(task);
    });

    // 각 버킷 내에서 hourSlot(세부) -> order로 정렬
    const result: BucketGroup[] = [];
    for (const h of Array.from(groups.keys()).sort((a, b) => a - b)) {
      const bucketTasks = groups.get(h) ?? [];
      bucketTasks.sort((a, b) => {
        const hourSlotA = typeof a.hourSlot === 'number' ? a.hourSlot : -1;
        const hourSlotB = typeof b.hourSlot === 'number' ? b.hourSlot : -1;
        if (hourSlotA !== hourSlotB) return hourSlotA - hourSlotB;
        const orderA = a.order ?? new Date(a.createdAt).getTime();
        const orderB = b.order ?? new Date(b.createdAt).getTime();
        return orderA - orderB;
      });
      const totalDuration = bucketTasks.reduce(
        (sum, t) => sum + (t.adjustedDuration || t.baseDuration || TASK_DEFAULTS.baseDuration),
        0
      );
      result.push({ bucketStartHour: h, tasks: bucketTasks, totalDuration });
    }

    return result;
  }, [dailyData?.tasks, visibleStartHour]);

  // 타임라인 아이템 (위치 계산) - visibleStartHour 기준
  const timelineItems = useMemo<TimelineTaskItem[]>(() => {
    const items: TimelineTaskItem[] = [];

    bucketGroups.forEach((group) => {
      let cumulativeTop = (group.bucketStartHour - visibleStartHour) * HOUR_HEIGHT;

      group.tasks.forEach((task, index) => {
        const duration = task.adjustedDuration || task.baseDuration || TASK_DEFAULTS.baseDuration;
        const height = Math.max(duration * PIXELS_PER_MINUTE, 20); // 최소 20px

        items.push({
          task,
          top: cumulativeTop,
          height,
          bucketStartHour: group.bucketStartHour,
          orderInBucket: index,
        });

        cumulativeTop += height;
      });
    });

    return items;
  }, [bucketGroups, visibleStartHour]);

  // 현재 시간 위치 계산 - visibleStartHour 기준
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if (hour < visibleStartHour || hour >= TIMELINE_END_HOUR) {
      return null;
    }

    const position = (hour - visibleStartHour) * HOUR_HEIGHT + minute * PIXELS_PER_MINUTE;
    return position;
  }, [visibleStartHour]); // visibleStartHour 변경 시 재계산

  // 표시되는 시간 범위 계산
  const visibleHours = TIMELINE_END_HOUR - visibleStartHour;

  return {
    bucketGroups,
    timelineItems,
    currentTimePosition,
    totalHeight: visibleHours * HOUR_HEIGHT,
    visibleStartHour,
    showPastBlocks,
    toggleShowPastBlocks,
  };
}
