import { create } from 'zustand';

import type { DailyData, Task, TimeBlockState } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import {
  assertDailyDataExists,
  createBlockRollbackState,
  createOptimisticBlockUpdate,
  createUpdatedDailyData,
} from '@/shared/lib/storeUtils';
import { loadDailyData, saveDailyData, updateBlockState as updateBlockStateInRepo } from '@/data/repositories';
import { toStandardError } from '@/shared/lib/standardError';

import type { DailyDataStore } from './types';
import { createTaskOperations } from './taskOperations';
import { createXpOperations } from './xpOperations';

export const useDailyDataStore = create<DailyDataStore>((set, get) => ({
  dailyData: null,
  currentDate: getLocalDate(),
  loading: false,
  error: null,

  loadData: async (date?: string, force?: boolean) => {
    const targetDate = date || getLocalDate();
    const { currentDate, dailyData, loading } = get();

    if (!force) {
      if (currentDate === targetDate && dailyData && !loading) return;
      if (loading) return;
    }

    try {
      set({ loading: true, error: null, currentDate: targetDate });
      const data = await loadDailyData(targetDate);
      set({ dailyData: data, loading: false });
    } catch (err) {
      const standardError = toStandardError({
        code: 'DAILY_DATA_LOAD_FAILED',
        error: err,
        context: { targetDate, force },
      });
      console.error('[DailyDataStore] ❌ Failed to load daily data:', standardError);
      set({ error: standardError, loading: false });
    }
  },

  saveData: async (tasks: Task[], timeBlockStates: DailyData['timeBlockStates']) => {
    const { currentDate, dailyData } = get();

    try {
      await saveDailyData(currentDate, tasks, timeBlockStates, dailyData?.hourSlotTags);
      set({
        dailyData: {
          tasks,
          goals: dailyData?.goals || [],
          timeBlockStates,
          hourSlotTags: dailyData?.hourSlotTags || {},
          updatedAt: Date.now(),
        },
      });
    } catch (err) {
      const standardError = toStandardError({
        code: 'DAILY_DATA_SAVE_FAILED',
        error: err,
        context: { currentDate },
      });
      console.error('[DailyDataStore] Failed to save daily data:', standardError);
      set({ error: standardError });
    }
  },

  updateBlockState: async (blockId: string, updates: Partial<TimeBlockState>) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const originalBlockStates = dailyData.timeBlockStates;
    set(createOptimisticBlockUpdate(dailyData, blockId, updates));

    try {
      await updateBlockStateInRepo(blockId, updates, currentDate);
    } catch (err) {
      console.error('[DailyDataStore] Failed to update block state, rolling back:', err);
      set(createBlockRollbackState(dailyData, originalBlockStates, err as Error));
      throw err;
    }
  },

  setHourSlotTag: async (hour: number, tagId: string | null) => {
    const { currentDate, dailyData } = get();
    assertDailyDataExists(dailyData, '[DailyDataStore] No dailyData available');

    const prevTags = dailyData.hourSlotTags || {};
    const nextTags = { ...prevTags };

    if (tagId) {
      nextTags[hour] = tagId;
    } else {
      delete nextTags[hour];
    }

    const optimistic = createUpdatedDailyData(dailyData, { hourSlotTags: nextTags });
    set({ dailyData: optimistic });

    try {
      await saveDailyData(currentDate, dailyData.tasks, dailyData.timeBlockStates, nextTags);
    } catch (err) {
      set({ dailyData });
      console.error('[DailyDataStore] Failed to update hour slot tag:', err);
      throw err;
    }
  },

  refresh: async () => {
    const { currentDate, loadData } = get();
    await loadData(currentDate, true);
  },

  reset: () => {
    set({
      dailyData: null,
      currentDate: getLocalDate(),
      loading: false,
      error: null,
    });
  },

  ...createTaskOperations(set, get),
  ...createXpOperations(set, get),
}));
