/**
 * @file useEnergy.ts
 * @role 에너지 데이터 관리를 위한 커스텀 훅
 * @input 없음
 * @output energyLevels, 통계 데이터, 에너지 추가/삭제 함수
 * @dependencies useEnergyStore, energyRepository
 */

import { useEffect } from 'react';
import { useEnergyStore } from '../stores/energyStore';
import {
    calculateTimeBlockAverages as calculateBlockAvg,
    calculateAverageEnergy,
    getCurrentEnergy as getLatestEnergy,
} from '@/data/repositories/energyRepository';

/**
 * 에너지 데이터 관리 훅
 * 오늘의 에너지 레벨, 평균, 시간대별 통계를 제공합니다.
 *
 * @returns {Object} 에너지 데이터 및 조작 함수
 * @property {EnergyLevel[]} energyLevels - 오늘의 에너지 기록 목록
 * @property {boolean} loading - 로딩 상태
 * @property {number} currentEnergy - 현재 에너지 레벨
 * @property {number} todayAverage - 오늘 평균 에너지
 * @property {number} overallAverage - 전체 평균 에너지
 * @property {Function} addEnergyLevel - 에너지 기록 추가
 * @property {Function} deleteEnergyLevel - 에너지 기록 삭제
 */
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
