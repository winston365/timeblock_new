import type { DailyData, Task } from '@/shared/types/domain';
import type { DailyDataStore } from './types';

export const selectDailyData = (state: DailyDataStore): DailyData | null => state.dailyData;

export const selectTasks = (state: DailyDataStore): readonly Task[] => state.dailyData?.tasks ?? [];

export const selectCurrentDate = (state: DailyDataStore): string => state.currentDate;

export const selectIsDailyDataLoading = (state: DailyDataStore): boolean => state.loading;

export const selectDailyDataError = (state: DailyDataStore): Error | null => state.error;
