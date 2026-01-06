/**
 * @file useInboxPlacement.ts
 * @description 인박스 triage 빠른 배치(today/tomorrow/next) 로직
 */

import { useCallback, useMemo } from 'react';
import { findSuggestedSlot, type SlotFindMode } from '@/shared/services/schedule/slotFinder';
import { useDailyData } from '@/shared/hooks/useDailyData';
import { notify } from '@/shared/lib/notify';
import { getLocalDate } from '@/shared/lib/utils';
import type { TimeBlockId } from '@/shared/types/domain';
import type { MutableRefObject } from 'react';

export interface InboxTaskForPlacement {
  id: string;
}

export interface LastUsedSlot {
  mode: SlotFindMode;
  date: string;
  blockId: string;
  hourSlot: number;
}

export interface UseInboxPlacementParams {
  triageFocusedTaskId: string | null;
  inboxTasks: readonly InboxTaskForPlacement[];
  placeTaskToSlot: (taskId: string, date: string, blockId: TimeBlockId, hourSlot: number) => Promise<void>;
  setLastUsedSlot: (slot: LastUsedSlot) => Promise<void>;
  isProcessingRef: MutableRefObject<boolean>;
}

export interface UseInboxPlacementResult {
  handleQuickPlace: (mode: SlotFindMode) => Promise<void>;
}

export const useInboxPlacement = (params: UseInboxPlacementParams): UseInboxPlacementResult => {
  const {
    triageFocusedTaskId,
    inboxTasks,
    placeTaskToSlot,
    setLastUsedSlot,
    isProcessingRef,
  } = params;

  const { dailyData } = useDailyData();
  const todayTasks = useMemo(() => dailyData?.tasks ?? [], [dailyData?.tasks]);
  const timeBlockStates = dailyData?.timeBlockStates;

  const handleQuickPlace = useCallback(
    async (mode: SlotFindMode) => {
      if (!triageFocusedTaskId || isProcessingRef.current) return;

      const task = inboxTasks.find((t) => t.id === triageFocusedTaskId);
      if (!task) return;

      isProcessingRef.current = true;

      try {
        const today = getLocalDate();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = getLocalDate(tomorrow);

        const suggestion = findSuggestedSlot({
          now: new Date(),
          mode,
          today: {
            tasks: todayTasks,
            timeBlockStates,
            dateISO: today,
          },
          tomorrow: {
            tasks: [],
            dateISO: tomorrowISO,
          },
          options: {
            skipLockedBlocks: true,
            avoidHourSlotCollisions: true,
          },
        });

        if (!suggestion) {
          notify.error('배치 가능한 슬롯이 없습니다');
          return;
        }

        await placeTaskToSlot(
          triageFocusedTaskId,
          suggestion.dateISO,
          suggestion.blockId as TimeBlockId,
          suggestion.hourSlot,
        );

        await setLastUsedSlot({
          mode,
          date: suggestion.dateISO,
          blockId: suggestion.blockId as string,
          hourSlot: suggestion.hourSlot,
        });

        notify.placement(suggestion.label);
      } catch (error) {
        console.error('Quick place failed:', error);
        notify.error('배치에 실패했습니다');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [triageFocusedTaskId, inboxTasks, todayTasks, timeBlockStates, placeTaskToSlot, setLastUsedSlot, isProcessingRef],
  );

  return { handleQuickPlace };
};
