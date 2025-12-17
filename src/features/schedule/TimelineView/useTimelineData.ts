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
import type { Task } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';

/** 타임라인 시간 범위 (05:00 ~ 23:00) */
export const TIMELINE_START_HOUR = 5;
export const TIMELINE_END_HOUR = 23;
export const TIMELINE_TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 18시간

/** 픽셀 상수 */
export const HOUR_HEIGHT = 60; // 1시간당 60px
export const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60; // 1분당 1px

/** 3시간 블록 구분선 위치 (시작 시간) */
export const BLOCK_BOUNDARIES = [5, 8, 11, 14, 17, 20, 23];

/** 타임라인 작업 블록 정보 */
export interface TimelineTaskItem {
  task: Task;
  top: number;       // 시작 위치 (px)
  height: number;    // 블록 높이 (px)
  hour: number;      // 시간대
  orderInHour: number; // 같은 시간대 내 순서 (0-based)
}

/** 시간대별 작업 그룹 */
export interface HourGroup {
  hour: number;
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

  // 현재 시간 기준으로 지난 블록의 끝 시간 계산
  const currentHour = new Date().getHours();
  const currentBlock = TIME_BLOCKS.find(b => currentHour >= b.start && currentHour < b.end);
  // 지난 블록 숨기기 모드일 때: 현재 블록의 시작 시간부터 표시
  const visibleStartHour = showPastBlocks 
    ? TIMELINE_START_HOUR 
    : (currentBlock ? currentBlock.start : TIMELINE_START_HOUR);

  // 시간대별 작업 그룹화 및 정렬
  const hourGroups = useMemo<HourGroup[]>(() => {
    const tasks = dailyData?.tasks ?? [];
    const groups: Map<number, Task[]> = new Map();

    // visibleStartHour ~ 22:00 시간대만 처리 (지난 블록 숨기기 적용)
    for (let h = visibleStartHour; h < TIMELINE_END_HOUR; h++) {
      groups.set(h, []);
    }

    // 작업을 시간대별로 분류 (visibleStartHour 이후만)
    tasks.forEach(task => {
      if (task.hourSlot !== undefined && task.hourSlot >= visibleStartHour && task.hourSlot < TIMELINE_END_HOUR) {
        const hourTasks = groups.get(task.hourSlot);
        if (hourTasks) {
          hourTasks.push(task);
        }
      }
    });

    // 각 시간대 내에서 order로 정렬
    const result: HourGroup[] = [];
    for (let h = visibleStartHour; h < TIMELINE_END_HOUR; h++) {
      const hourTasks = groups.get(h) ?? [];
      hourTasks.sort((a, b) => {
        const orderA = a.order ?? new Date(a.createdAt).getTime();
        const orderB = b.order ?? new Date(b.createdAt).getTime();
        return orderA - orderB;
      });
      const totalDuration = hourTasks.reduce(
        (sum, t) => sum + (t.adjustedDuration || t.baseDuration || TASK_DEFAULTS.baseDuration),
        0
      );
      result.push({ hour: h, tasks: hourTasks, totalDuration });
    }

    return result;
  }, [dailyData?.tasks, visibleStartHour]);

  // 타임라인 아이템 (위치 계산) - visibleStartHour 기준
  const timelineItems = useMemo<TimelineTaskItem[]>(() => {
    const items: TimelineTaskItem[] = [];

    hourGroups.forEach(group => {
      let cumulativeTop = (group.hour - visibleStartHour) * HOUR_HEIGHT;

      group.tasks.forEach((task, index) => {
        const duration = task.adjustedDuration || task.baseDuration || TASK_DEFAULTS.baseDuration;
        const height = Math.max(duration * PIXELS_PER_MINUTE, 20); // 최소 20px

        items.push({
          task,
          top: cumulativeTop,
          height,
          hour: group.hour,
          orderInHour: index,
        });

        cumulativeTop += height;
      });
    });

    return items;
  }, [hourGroups, visibleStartHour]);

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
    hourGroups,
    timelineItems,
    currentTimePosition,
    totalHeight: visibleHours * HOUR_HEIGHT,
    visibleStartHour,
    showPastBlocks,
    toggleShowPastBlocks,
  };
}
