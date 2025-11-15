/**
 * useEnergyState - 에너지 관리 훅
 *
 * @role 에너지 수준 기록, 조회, 시간대별/일별 통계 계산
 * @input 에너지 레벨, 시간, 활동 컨텍스트
 * @output 에너지 레벨 목록, 통계, 추가/삭제 함수
 * @external_dependencies
 *   - react: useState, useEffect, useCallback hooks
 *   - energyRepository: IndexedDB 및 Firebase 동기화
 */

import { useState, useEffect, useCallback } from 'react';
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

/**
 * 5일간 시간대별 에너지 통계
 */
export interface DailyTimeBlockEnergy {
  date: string;
  timeBlocks: Record<string, number>; // { '5-8': 75, '8-11': 80, ... }
}

/**
 * 전체 날짜의 평균 에너지 계산 (최근 30일)
 */
async function calculateOverallAverage(): Promise<number> {
  try {
    const recentData = await loadRecentEnergyLevels(30);
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

/**
 * 5일간 시간대별 에너지 통계 계산
 */
async function calculateRecentTimeBlockStats(days: number = 5): Promise<DailyTimeBlockEnergy[]> {
  try {
    const recentData = await loadRecentEnergyLevels(days);
    const result: DailyTimeBlockEnergy[] = [];

    // 날짜를 최근순으로 정렬
    const dates = Object.keys(recentData).sort().reverse();

    for (const date of dates) {
      const levels = recentData[date];
      const timeBlocks = calculateBlockAvg(levels);

      result.push({
        date,
        timeBlocks,
      });
    }

    return result;
  } catch (error) {
    console.error('Failed to calculate recent stats:', error);
    return [];
  }
}

/**
 * 에너지 상태 관리 훅
 *
 * @returns {object} 에너지 레벨 및 통계
 * @returns {EnergyLevel[]} energyLevels - 오늘의 에너지 레벨 기록 목록
 * @returns {boolean} loading - 로딩 상태
 * @returns {number} currentEnergy - 현재 에너지 레벨
 * @returns {number} todayAverage - 오늘 평균 에너지
 * @returns {number} overallAverage - 전체 기간 평균 에너지
 * @returns {Record<string, number>} timeBlockAverages - 시간대별 평균 에너지
 * @returns {DailyTimeBlockEnergy[]} recentTimeBlockStats - 5일간 시간대별 통계
 * @returns {(energy: number, context?: string, activity?: string) => void} addEnergyLevel - 에너지 레벨 추가
 * @returns {(timestamp: number) => void} deleteEnergyLevel - 에너지 레벨 삭제
 * @sideEffects IndexedDB 및 Firebase에 에너지 데이터 저장
 */
export function useEnergyState() {
  const [energyLevels, setEnergyLevels] = useState<EnergyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallAverage, setOverallAverage] = useState(0);
  const [recentTimeBlockStats, setRecentTimeBlockStats] = useState<DailyTimeBlockEnergy[]>([]);

  // 초기 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const today = getLocalDate();
        const levels = await loadEnergyLevels(today);
        setEnergyLevels(levels);

        // 전체 평균 및 5일간 통계 계산
        const [avgEnergy, stats] = await Promise.all([
          calculateOverallAverage(),
          calculateRecentTimeBlockStats(5),
        ]);

        setOverallAverage(avgEnergy);
        setRecentTimeBlockStats(stats);
      } catch (error) {
        console.error('Failed to load energy data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 에너지 추가
  const addEnergyLevel = useCallback(
    async (energy: number, context?: string, activity?: string) => {
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

        // 상태 업데이트
        const updatedLevels = await loadEnergyLevels(today);
        setEnergyLevels(updatedLevels);

        // 통계 재계산
        const [avgEnergy, stats] = await Promise.all([
          calculateOverallAverage(),
          calculateRecentTimeBlockStats(5),
        ]);

        setOverallAverage(avgEnergy);
        setRecentTimeBlockStats(stats);
      } catch (error) {
        console.error('Failed to add energy level:', error);
      }
    },
    []
  );

  // 에너지 삭제
  const deleteEnergyLevel = useCallback(
    async (timestamp: number) => {
      try {
        const today = getLocalDate();
        await deleteEnergyLevelFromRepo(today, timestamp);

        // 상태 업데이트
        const updatedLevels = await loadEnergyLevels(today);
        setEnergyLevels(updatedLevels);

        // 통계 재계산
        const [avgEnergy, stats] = await Promise.all([
          calculateOverallAverage(),
          calculateRecentTimeBlockStats(5),
        ]);

        setOverallAverage(avgEnergy);
        setRecentTimeBlockStats(stats);
      } catch (error) {
        console.error('Failed to delete energy level:', error);
      }
    },
    []
  );

  // 통계 계산
  const currentEnergy = getLatestEnergy(energyLevels);
  const todayAverage = calculateAverageEnergy(energyLevels);
  const timeBlockAverages = calculateBlockAvg(energyLevels);

  return {
    energyLevels,
    loading,
    currentEnergy,
    todayAverage,
    overallAverage,
    timeBlockAverages,
    recentTimeBlockStats,
    addEnergyLevel,
    deleteEnergyLevel,
  };
}
