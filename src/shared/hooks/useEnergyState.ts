/**
 * useEnergyState - 에너지 관리 훅
 *
 * @role 에너지 수준 기록, 조회, 시간대별/일별 통계 계산
 * @input 에너지 레벨, 시간, 활동 컨텍스트
 * @output 에너지 레벨 목록, 통계, 추가/삭제 함수
 * @external_dependencies
 *   - react: useState, useEffect, useCallback hooks
 *   - localStorage: 에너지 데이터 영구 저장
 */

import { useState, useEffect, useCallback } from 'react';
import type { EnergyLevel } from '@/shared/types/domain';

const STORAGE_KEY_PREFIX = 'energyLevels_';

/**
 * 날짜 문자열 생성 (YYYY-MM-DD)
 */
function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * localStorage에서 에너지 데이터 로드
 */
function loadEnergyLevels(date: string): EnergyLevel[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${date}`;
    const data = localStorage.getItem(key);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load energy levels:', error);
    return [];
  }
}

/**
 * localStorage에 에너지 데이터 저장
 */
function saveEnergyLevels(date: string, levels: EnergyLevel[]): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${date}`;
    localStorage.setItem(key, JSON.stringify(levels));
  } catch (error) {
    console.error('Failed to save energy levels:', error);
  }
}

/**
 * 시간대별 평균 에너지 계산
 */
function calculateTimeBlockAverages(levels: EnergyLevel[]): Record<string, number> {
  const timeBlocks = [
    { id: '5-8', start: 5, end: 8 },
    { id: '8-11', start: 8, end: 11 },
    { id: '11-14', start: 11, end: 14 },
    { id: '14-17', start: 14, end: 17 },
    { id: '17-19', start: 17, end: 19 },
    { id: '19-24', start: 19, end: 24 },
  ];

  const result: Record<string, number> = {};

  for (const block of timeBlocks) {
    const blockLevels = levels.filter(
      (level) => level.hour >= block.start && level.hour < block.end
    );

    if (blockLevels.length > 0) {
      const avg = blockLevels.reduce((sum, level) => sum + level.energy, 0) / blockLevels.length;
      result[block.id] = Math.round(avg);
    }
  }

  return result;
}

/**
 * 전체 날짜의 평균 에너지 계산
 */
function calculateOverallAverage(): number {
  try {
    const allKeys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    let totalEnergy = 0;
    let count = 0;

    for (const key of allKeys) {
      const data = localStorage.getItem(key);
      if (!data) continue;

      const levels: EnergyLevel[] = JSON.parse(data);
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
 * 에너지 상태 관리 훅
 *
 * @returns {object} 에너지 레벨 및 통계
 * @returns {EnergyLevel[]} energyLevels - 오늘의 에너지 레벨 기록 목록
 * @returns {boolean} loading - 로딩 상태
 * @returns {number} currentEnergy - 현재 에너지 레벨
 * @returns {number} todayAverage - 오늘 평균 에너지
 * @returns {number} overallAverage - 전체 기간 평균 에너지
 * @returns {Record<string, number>} timeBlockAverages - 시간대별 평균 에너지
 * @returns {(energy: number, context?: string, activity?: string) => void} addEnergyLevel - 에너지 레벨 추가
 * @returns {(timestamp: number) => void} deleteEnergyLevel - 에너지 레벨 삭제
 * @sideEffects localStorage에 에너지 데이터 저장
 */
export function useEnergyState() {
  const [energyLevels, setEnergyLevels] = useState<EnergyLevel[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 로드
  useEffect(() => {
    const today = getDateString();
    const levels = loadEnergyLevels(today);
    setEnergyLevels(levels);
    setLoading(false);
  }, []);

  // 에너지 추가
  const addEnergyLevel = useCallback(
    (energy: number, context?: string, activity?: string) => {
      const now = new Date();
      const newLevel: EnergyLevel = {
        timestamp: now.getTime(),
        hour: now.getHours(),
        energy,
        context,
        activity,
      };

      const today = getDateString();
      const updatedLevels = [...energyLevels, newLevel];
      setEnergyLevels(updatedLevels);
      saveEnergyLevels(today, updatedLevels);
    },
    [energyLevels]
  );

  // 에너지 삭제
  const deleteEnergyLevel = useCallback(
    (timestamp: number) => {
      const today = getDateString();
      const updatedLevels = energyLevels.filter((level) => level.timestamp !== timestamp);
      setEnergyLevels(updatedLevels);
      saveEnergyLevels(today, updatedLevels);
    },
    [energyLevels]
  );

  // 통계 계산
  const currentEnergy = energyLevels.length > 0 ? energyLevels[energyLevels.length - 1].energy : 0;

  const todayAverage =
    energyLevels.length > 0
      ? Math.round(energyLevels.reduce((sum, level) => sum + level.energy, 0) / energyLevels.length)
      : 0;

  const overallAverage = calculateOverallAverage();

  const timeBlockAverages = calculateTimeBlockAverages(energyLevels);

  return {
    energyLevels,
    loading,
    currentEnergy,
    todayAverage,
    overallAverage,
    timeBlockAverages,
    addEnergyLevel,
    deleteEnergyLevel,
  };
}
