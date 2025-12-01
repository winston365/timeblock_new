/**
 * @file energyStore.ts
 * @role 에너지 레벨 상태 관리 Zustand 스토어
 * @input energyRepository에서 로드된 에너지 데이터
 * @output 에너지 상태, 로딩/에러 상태, CRUD 액션
 * @dependencies zustand, energyRepository
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { EnergyLevel } from '@/shared/types/domain';
import {
    loadEnergyLevels,
    addEnergyLevel as addEnergyLevelToRepo,
    deleteEnergyLevel as deleteEnergyLevelFromRepo,
    loadRecentEnergyLevels,
    calculateTimeBlockAverages as calculateBlockAvg,
    calculateAverageEnergy,
    getCurrentEnergy as getLatestEnergy,
} from '@/data/repositories/energyRepository';
import { getLocalDate } from '@/shared/lib/utils';

export interface DailyTimeBlockEnergy {
    date: string;
    timeBlocks: Record<string, number>;
}

interface EnergyState {
    energyLevels: EnergyLevel[];
    loading: boolean;
    error: Error | null;
    overallAverage: number;
    recentTimeBlockStats: DailyTimeBlockEnergy[];

    // Computed properties (getters in the hook or derived state)
    // We store the raw data and compute derived state in the hook or selectors
}

interface EnergyActions {
    loadData: () => Promise<void>;
    addEnergyLevel: (energy: number, context?: string, activity?: string) => Promise<void>;
    deleteEnergyLevel: (timestamp: number) => Promise<void>;
}

// Helper functions for calculations
function calculateOverallAverageFromData(recentData: Record<string, EnergyLevel[]>): number {
    try {
        let totalEnergy = 0;
        let count = 0;
        for (const levels of Object.values(recentData)) {
            for (const level of levels) {
                totalEnergy += level.energy;
                count++;
            }
        }
        return count > 0 ? Math.round(totalEnergy / count) : 0;
    } catch (error) {
        console.error('Failed to calculate overall average:', error);
        return 0;
    }
}

function calculateRecentTimeBlockStatsFromData(
    recentData: Record<string, EnergyLevel[]>,
    days: number = 5
): DailyTimeBlockEnergy[] {
    try {
        const result: DailyTimeBlockEnergy[] = [];
        const dates = Object.keys(recentData).sort().reverse().slice(0, days);
        for (const date of dates) {
            const levels = recentData[date];
            const timeBlocks = calculateBlockAvg(levels);
            result.push({ date, timeBlocks });
        }
        return result;
    } catch (error) {
        console.error('Failed to calculate recent stats:', error);
        return [];
    }
}

export const useEnergyStore = create<EnergyState & EnergyActions>()(
    devtools(
        (set, get) => ({
            energyLevels: [],
            loading: false,
            error: null,
            overallAverage: 0,
            recentTimeBlockStats: [],

            loadData: async () => {
                set({ loading: true, error: null });
                try {
                    const today = getLocalDate();
                    const [levels, recentData] = await Promise.all([
                        loadEnergyLevels(today),
                        loadRecentEnergyLevels(30),
                    ]);

                    const avgEnergy = calculateOverallAverageFromData(recentData);
                    const stats = calculateRecentTimeBlockStatsFromData(recentData, 5);

                    set({
                        energyLevels: levels,
                        overallAverage: avgEnergy,
                        recentTimeBlockStats: stats,
                        loading: false,
                    });
                } catch (error) {
                    set({ error: error as Error, loading: false });
                }
            },

            addEnergyLevel: async (energy, context, activity) => {
                try {
                    const now = new Date();
                    const newLevel: EnergyLevel = {
                        timestamp: now.getTime(),
                        hour: now.getHours(),
                        energy,
                        context,
                        activity,
                    };

                    const today = getLocalDate();
                    await addEnergyLevelToRepo(today, newLevel);

                    // Reload data to ensure consistency
                    await get().loadData();
                } catch (error) {
                    set({ error: error as Error });
                }
            },

            deleteEnergyLevel: async (timestamp) => {
                try {
                    const today = getLocalDate();
                    await deleteEnergyLevelFromRepo(today, timestamp);

                    // Reload data
                    await get().loadData();
                } catch (error) {
                    set({ error: error as Error });
                }
            },
        }),
        { name: 'EnergyStore' }
    )
);
