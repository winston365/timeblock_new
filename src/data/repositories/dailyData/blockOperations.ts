/**
 * DailyData Repository - TimeBlock Operations
 * 
 * @role TimeBlockState 상태 관리 (잠금, 완료 등)
 * @responsibilities
 *   - 블록 상태 업데이트 (updateBlockState)
 *   - 블록 잠금 토글 (toggleBlockLock)
 * @key_dependencies
 *   - coreOperations: loadDailyData, saveDailyData
 *   - @/shared/types/domain: TimeBlockState 타입
 */

import type { TimeBlockState } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { loadDailyData, saveDailyData } from './coreOperations';

// ============================================================================
// TimeBlockState CRUD
// ============================================================================

/**
 * 블록 상태 업데이트
 *
 * @param {string} blockId - 블록 ID
 * @param {Partial<TimeBlockState>} updates - 업데이트할 상태 필드
 * @param {string} [date] - 날짜 (기본값: 오늘)
 */
export async function updateBlockState(
  blockId: string,
  updates: Partial<TimeBlockState>,
  date: string = getLocalDate()
): Promise<void> {
  try {
    const dailyData = await loadDailyData(date);

    if (!dailyData.timeBlockStates[blockId]) {
      dailyData.timeBlockStates[blockId] = {
        isLocked: false,
        isPerfect: false,
        isFailed: false,
      };
    }

    dailyData.timeBlockStates[blockId] = {
      ...dailyData.timeBlockStates[blockId],
      ...updates,
    };

    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
  } catch (error) {
    console.error('Failed to update block state:', error);
    throw error;
  }
}

/**
 * 블록 잠금 토글
 *
 * @param {string} blockId - 블록 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<boolean>} 토글 후 잠금 상태
 */
export async function toggleBlockLock(blockId: string, date: string = getLocalDate()): Promise<boolean> {
  try {
    const dailyData = await loadDailyData(date);
    const blockState = dailyData.timeBlockStates[blockId];

    if (!blockState) {
      throw new Error(`Block state not found: ${blockId}`);
    }

    // 잠금하려는 경우: 블록에 작업이 있는지 검증
    if (!blockState.isLocked) {
      const blockTasks = dailyData.tasks.filter(task => task.timeBlock === blockId);

      if (blockTasks.length === 0) {
        throw new Error('빈 블록은 잠글 수 없습니다. 작업을 먼저 추가해주세요.');
      }
    }

    blockState.isLocked = !blockState.isLocked;

    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);

    return blockState.isLocked;
  } catch (error) {
    console.error('Failed to toggle block lock:', error);
    throw error;
  }
}
