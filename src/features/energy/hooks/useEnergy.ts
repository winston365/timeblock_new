import { useEffect } from 'react';
import { useEnergyStore } from '../stores/energyStore';
import {
    calculateTimeBlockAverages as calculateBlockAvg,
    calculateAverageEnergy,
    getCurrentEnergy as getLatestEnergy,
} from '@/data/repositories/energyRepository';

export function useEnergy() {
    const {
        energyLevels,
        loading,
        error,
        overallAverage,
        recentTimeBlockStats,
        loadData,
        addEnergyLevel,
        deleteEnergyLevel,
    } = useEnergyStore();

    // Initial load
    useEffect(() => {
        loadData();
    }, []); // Only load once on mount

    // Derived state
    const currentEnergy = getLatestEnergy(energyLevels);
    const todayAverage = calculateAverageEnergy(energyLevels);
    const timeBlockAverages = calculateBlockAvg(energyLevels);

    return {
        energyLevels,
        loading,
        error,
        currentEnergy,
        todayAverage,
        overallAverage,
        timeBlockAverages,
        recentTimeBlockStats,
        addEnergyLevel,
        deleteEnergyLevel,
        refresh: loadData,
    };
}
