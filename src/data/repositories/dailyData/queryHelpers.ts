/**
 * DailyData Repository - Query Helpers
 * 
 * @role 조회 전용 헬퍼 함수들 (인박스, 완료 작업, 블록 작업, 최근 데이터 등)
 * @responsibilities
 *   - 인박스 작업 조회 (getInboxTasks)
 *   - 완료된 작업 조회 (getCompletedTasks)
 *   - 블록별 작업 조회 (getBlockTasks)
 *   - 최근 N일 데이터 조회 (getRecentDailyData)
 *   - 최근 완료/미완료 작업 조회
 * @key_dependencies
 *   - db.completedInbox: 완료된 인박스 작업 테이블
 *   - coreOperations: loadDailyData
 *   - inboxRepository: loadInboxTasks
 */

import { db } from '../../db/dexieClient';
import type { DailyData, Task } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { loadDailyData } from './coreOperations';

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * 인박스 작업 가져오기 (Global Inbox)
 *
 * @deprecated 이제 globalInbox 테이블을 사용합니다. loadInboxTasks()를 직접 사용하세요.
 * @param {string} [_date] - 날짜 (사용되지 않음)
 * @returns {Promise<Task[]>} 전역 인박스 작업 배열
 */
export async function getInboxTasks(_date: string = getLocalDate()): Promise<Task[]> {
  // Global inbox를 사용하므로 date 파라미터는 무시됨
  const { loadInboxTasks } = await import('../inboxRepository');
  return loadInboxTasks();
}

/**
 * 완료된 작업 가져오기
 *
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task[]>} 완료된 작업 배열
 */
export async function getCompletedTasks(date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => task.completed);
}

/**
 * 특정 블록의 작업 가져오기
 *
 * @param {string} blockId - 블록 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task[]>} 해당 블록에 할당된 작업 배열
 */
export async function getBlockTasks(blockId: string, date: string = getLocalDate()): Promise<Task[]> {
  const dailyData = await loadDailyData(date);
  return dailyData.tasks.filter(task => task.timeBlock === blockId);
}

/**
 * 최근 N일의 데이터 가져오기
 *
 * @param {number} days - 조회할 일수
 * @returns {Promise<Array<DailyData & { date: string }>>} 날짜 포함 일일 데이터 배열
 */
export async function getRecentDailyData(days: number): Promise<Array<DailyData & { date: string }>> {
  try {
    const dates: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(getLocalDate(date));
    }

    const dataPromises = dates.map(async date => {
      const data = await loadDailyData(date);
      return { date, ...data };
    });

    return await Promise.all(dataPromises);
  } catch (error) {
    console.error('Failed to get recent daily data:', error);
    return [];
  }
}

/**
 * 최근 N일의 완료된 작업 가져오기
 *
 * @param {number} [days=7] - 조회할 일수 (기본값: 7일)
 * @returns {Promise<Task[]>} 완료된 작업 배열 (최근 순으로 정렬)
 */
export async function getRecentCompletedTasks(days: number = 7): Promise<Task[]> {
  try {
    const recentData = await getRecentDailyData(days);
    const allCompletedTasks: Task[] = [];

    // 모든 날짜의 완료된 작업 수집 (dailyData에서)
    recentData.forEach(dailyDataWithDate => {
      const completedTasks = dailyDataWithDate.tasks.filter(task => task.completed);
      allCompletedTasks.push(...completedTasks);
    });

    // completedInbox 테이블에서 완료 작업 포함 (날짜 필터 적용)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const completedInboxTasks = await db.completedInbox.toArray();
    const recentCompletedInboxTasks = completedInboxTasks.filter(task => {
      if (!task.completedAt) return false;
      return new Date(task.completedAt) >= cutoffDate;
    });
    allCompletedTasks.push(...recentCompletedInboxTasks);

    // completedAt 기준으로 최근 순 정렬
    return allCompletedTasks.sort((a, b) => {
      if (!a.completedAt || !b.completedAt) return 0;
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
  } catch (error) {
    console.error('Failed to get recent completed tasks:', error);
    return [];
  }
}

/**
 * 최근 N일의 미완료 인박스 작업 가져오기
 *
 * @param {number} [_days=7] - 조회할 일수 (기본값: 7일) - Global Inbox에서는 무시됨
 * @returns {Promise<Task[]>} 미완료 인박스 작업 배열
 */
export async function getRecentUncompletedInboxTasks(_days: number = 7): Promise<Task[]> {
  try {
    // Global inbox를 사용하므로 날짜 범위 검색은 불필요
    const { loadInboxTasks } = await import('../inboxRepository');
    const allInboxTasks = await loadInboxTasks();

    // 미완료 작업만 필터링
    return allInboxTasks.filter(task => !task.completed);
  } catch (error) {
    console.error('Failed to get uncompleted inbox tasks:', error);
    return [];
  }
}
