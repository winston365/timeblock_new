/**
 * Energy Repository
 *
 * @role 에너지 레벨 데이터 관리 (CRUD, 통계 계산)
 * @input EnergyLevel 객체, 날짜 문자열
 * @output EnergyLevel 배열, 통계 데이터
 * @external_dependencies
 *   - IndexedDB (db.energyLevels): 메인 저장소
 *   - localStorage: 백업 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: EnergyLevel 타입
 */

import { db } from '../db/dexieClient';
import type { EnergyLevel } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { energyLevelsStrategy } from '@/shared/services/sync/firebase/strategies';



// ============================================================================
// EnergyLevel CRUD
// ============================================================================

/**
 * 특정 날짜의 에너지 레벨 목록 로드
 *
 * @param {string} [date] - 조회할 날짜 (기본값: 오늘)
 * @returns {Promise<EnergyLevel[]>} 에너지 레벨 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - localStorage 폴백 시 IndexedDB에 데이터 복원
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원
 *   - syncLogger에 로그 기록
 */
export async function loadEnergyLevels(date: string = getLocalDate()): Promise<EnergyLevel[]> {
  try {
    // 1. IndexedDB에서 먼저 조회
    const levels = await db.energyLevels
      .where('date')
      .equals(date)
      .sortBy('timestamp');

    if (levels && levels.length > 0) {
      addSyncLog('dexie', 'load', `EnergyLevels loaded for ${date}`, { count: levels.length });
      return levels;
    }

    // 2. Firebase에서 조회 (IndexedDB 실패 시)
    if (isFirebaseInitialized()) {
      const firebaseLevels = await fetchFromFirebase<EnergyLevel[]>(energyLevelsStrategy, date);

      if (firebaseLevels && firebaseLevels.length > 0) {
        // Firebase 데이터를 IndexedDB에 저장
        await saveEnergyLevels(date, firebaseLevels);

        addSyncLog('firebase', 'load', `Loaded ${firebaseLevels.length} energy levels for ${date} from Firebase`);
        return firebaseLevels;
      }
    }

    // 4. 데이터가 없으면 빈 배열 반환
    addSyncLog('dexie', 'load', `No energy levels found for ${date}`);
    return [];
  } catch (error) {
    console.error(`Failed to load energy levels for ${date}:`, error);
    addSyncLog('dexie', 'error', `Failed to load energy levels for ${date}`, undefined, error as Error);
    return [];
  }
}

/**
 * 에너지 레벨 목록 저장
 *
 * @param {string} [date] - 저장할 날짜 (기본값: 오늘)
 * @param {EnergyLevel[]} levels - 에너지 레벨 배열
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 데이터 저장
 *   - localStorage에 백업
 *   - Firebase에 비동기 동기화
 *   - syncLogger에 로그 기록
 */
export async function saveEnergyLevels(
  date: string = getLocalDate(),
  levels: EnergyLevel[]
): Promise<void> {
  try {
    // 1. IndexedDB에 저장 (기존 데이터 삭제 후 재저장)
    await db.transaction('rw', db.energyLevels, async () => {
      // 해당 날짜의 기존 데이터 삭제
      await db.energyLevels.where('date').equals(date).delete();

      // 새 데이터 저장 (id 필드 추가)
      const levelsWithId = levels.map(level => ({
        ...level,
        id: `${date}_${level.timestamp}`,
        date,
      }));

      if (levelsWithId.length > 0) {
        await db.energyLevels.bulkAdd(levelsWithId);
      }
    });

    addSyncLog('dexie', 'save', `EnergyLevels saved for ${date}`, { count: levels.length });


  } catch (error) {
    console.error(`Failed to save energy levels for ${date}:`, error);
    addSyncLog('dexie', 'error', `Failed to save energy levels for ${date}`, undefined, error as Error);
    throw error;
  }
}

/**
 * 에너지 레벨 추가
 *
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @param {EnergyLevel} level - 추가할 에너지 레벨
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - 기존 에너지 레벨 목록에 새 레벨 추가
 *   - IndexedDB 및 localStorage 업데이트
 *   - Firebase 동기화
 */
export async function addEnergyLevel(
  date: string = getLocalDate(),
  level: EnergyLevel
): Promise<void> {
  const levels = await loadEnergyLevels(date);
  levels.push(level);
  await saveEnergyLevels(date, levels);
}

/**
 * 에너지 레벨 삭제
 *
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @param {number} timestamp - 삭제할 레벨의 타임스탬프
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - 해당 타임스탬프의 에너지 레벨 제거
 *   - IndexedDB 및 localStorage 업데이트
 *   - Firebase 동기화
 */
export async function deleteEnergyLevel(
  date: string = getLocalDate(),
  timestamp: number
): Promise<void> {
  const levels = await loadEnergyLevels(date);
  const filtered = levels.filter(l => l.timestamp !== timestamp);
  await saveEnergyLevels(date, filtered);
}

// ============================================================================
// 통계 계산
// ============================================================================

/**
 * 최근 N일간의 에너지 레벨 데이터 로드 (병렬 처리)
 *
 * @param {number} days - 조회할 일 수
 * @returns {Promise<Record<string, EnergyLevel[]>>} 날짜별 에너지 레벨 맵
 * @sideEffects
 *   - 모든 날짜를 병렬로 로드하여 성능 최적화
 */
export async function loadRecentEnergyLevels(days: number = 5): Promise<Record<string, EnergyLevel[]>> {
  const today = new Date();

  // 날짜 문자열 배열 생성
  const dateStrings = Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    return getLocalDate(date);
  });

  // 모든 날짜를 병렬로 로드
  const levelsPromises = dateStrings.map(dateStr => loadEnergyLevels(dateStr));
  const levelsArray = await Promise.all(levelsPromises);

  // 결과를 Record 형태로 변환
  const result: Record<string, EnergyLevel[]> = {};
  dateStrings.forEach((dateStr, index) => {
    result[dateStr] = levelsArray[index];
  });

  return result;
}

/**
 * 시간대별 평균 에너지 계산
 *
 * @param {EnergyLevel[]} levels - 에너지 레벨 배열
 * @returns {Record<string, number>} 시간대 ID별 평균 에너지
 */
export function calculateTimeBlockAverages(levels: EnergyLevel[]): Record<string, number> {
  const blockSums: Record<string, { sum: number; count: number }> = {};

  // 시간대 매핑
  const hourToBlock: Record<number, string> = {};
  for (let h = 5; h < 8; h++) hourToBlock[h] = '5-8';
  for (let h = 8; h < 11; h++) hourToBlock[h] = '8-11';
  for (let h = 11; h < 14; h++) hourToBlock[h] = '11-14';
  for (let h = 14; h < 17; h++) hourToBlock[h] = '14-17';
  for (let h = 17; h < 19; h++) hourToBlock[h] = '17-19';
  for (let h = 19; h < 24; h++) hourToBlock[h] = '19-24';

  // 각 레벨을 시간대별로 분류
  for (const level of levels) {
    const blockId = hourToBlock[level.hour];
    if (!blockId) continue;

    if (!blockSums[blockId]) {
      blockSums[blockId] = { sum: 0, count: 0 };
    }

    blockSums[blockId].sum += level.energy;
    blockSums[blockId].count += 1;
  }

  // 평균 계산
  const averages: Record<string, number> = {};
  for (const [blockId, data] of Object.entries(blockSums)) {
    averages[blockId] = Math.round(data.sum / data.count);
  }

  return averages;
}

/**
 * 전체 평균 에너지 계산
 *
 * @param {EnergyLevel[]} levels - 에너지 레벨 배열
 * @returns {number} 평균 에너지
 */
export function calculateAverageEnergy(levels: EnergyLevel[]): number {
  if (levels.length === 0) return 0;

  const sum = levels.reduce((acc, level) => acc + level.energy, 0);
  return Math.round(sum / levels.length);
}

/**
 * 현재 에너지 (가장 최근 기록)
 *
 * @param {EnergyLevel[]} levels - 에너지 레벨 배열
 * @returns {number} 현재 에너지
 */
export function getCurrentEnergy(levels: EnergyLevel[]): number {
  if (levels.length === 0) return 0;

  const sorted = [...levels].sort((a, b) => b.timestamp - a.timestamp);
  return sorted[0].energy;
}
