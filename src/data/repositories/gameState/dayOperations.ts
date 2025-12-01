/**
 * Day Operations
 *
 * @fileoverview 일일 데이터 관리 및 초기화 로직
 *
 * @role 일일 초기화, 데이터 마이그레이션, 템플릿 생성
 * @responsibilities
 *   - 일일 데이터 리셋 처리 (processDailyReset)
 *   - 연속 출석일 계산 (calculateStreak)
 *   - 미완료 인박스 작업 이동 (migrateUncompletedInboxTasks)
 *   - 자동 템플릿 기반 작업 생성 (generateTasksFromAutoTemplates)
 *
 * @dependencies
 *   - @/shared/lib/utils: getLocalDate (날짜 유틸)
 *   - ./questOperations: generateDailyQuests (퀘스트 생성)
 *   - ./historyOperations: addToXPHistory, addToBlockXPHistory (히스토리 관리)
 *   - ../dailyDataRepository: loadDailyData, saveDailyData, addTask (동적 임포트)
 *   - ../templateRepository: generateTasksFromAutoTemplates (동적 임포트)
 *   - @/shared/services/sync/firebaseService: isFirebaseInitialized (동적 임포트)
 */

import type { GameState } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { generateDailyQuests } from './questOperations';
import { addToXPHistory, addToBlockXPHistory } from './historyOperations';

/**
 * 일일 데이터 리셋 처리 (순수 함수)
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {string} today - 오늘 날짜
 * @returns {{ updatedState: GameState, needsReset: boolean }} 업데이트된 상태 및 리셋 여부
 */
export function processDailyReset(
  gameState: GameState,
  today: string
): { updatedState: GameState; needsReset: boolean } {
  if (gameState.lastLogin === today) {
    return { updatedState: gameState, needsReset: false };
  }

  let updatedState = { ...gameState };

  // 히스토리 필드 초기화
  if (!Array.isArray(updatedState.xpHistory)) {
    updatedState.xpHistory = [];
  }
  if (!Array.isArray(updatedState.timeBlockXPHistory)) {
    updatedState.timeBlockXPHistory = [];
  }

  // XP 히스토리에 어제 데이터 추가
  if (updatedState.dailyXP > 0) {
    updatedState = addToXPHistory(updatedState, updatedState.lastLogin, updatedState.dailyXP);
  }

  // 블록별 XP 히스토리 추가
  if (Object.keys(updatedState.timeBlockXP || {}).length > 0) {
    updatedState = addToBlockXPHistory(
      updatedState,
      updatedState.lastLogin,
      updatedState.timeBlockXP
    );
  }

  // 일일 초기화
  updatedState = {
    ...updatedState,
    dailyXP: 0,
    availableXP: 0,
    dailyTimerCount: 0,
    dailyQuests: generateDailyQuests(),
    lastLogin: today,
    questBonusClaimed: false,
    timeBlockXP: {},
  };

  return { updatedState, needsReset: true };
}

/**
 * 연속 출석일 계산
 *
 * @param {GameState} gameState - 현재 게임 상태
 * @param {string} today - 오늘 날짜
 * @returns {number} 새로운 연속 출석일
 */
export function calculateStreak(gameState: GameState, today: string): number {
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterdayDate);

  if (gameState.lastLogin === yesterdayStr) {
    return gameState.streak + 1;
  } else if (gameState.lastLogin !== today) {
    return 1;
  }

  return gameState.streak;
}

/**
 * 어제의 미완료 인박스 작업들을 오늘로 이동
 *
 * @param {string} yesterdayDate - 어제 날짜 (YYYY-MM-DD)
 * @param {string} todayDate - 오늘 날짜 (YYYY-MM-DD)
 * @returns {Promise<void>}
 */
export async function migrateUncompletedInboxTasks(
  yesterdayDate: string,
  todayDate: string
): Promise<void> {
  try {
    const { loadDailyData, saveDailyData } = await import('../dailyDataRepository');

    // 어제의 DailyData 로드
    const yesterdayData = await loadDailyData(yesterdayDate);

    // 미완료 인박스 작업 찾기
    const uncompletedInboxTasks = yesterdayData.tasks.filter(
      task => task.timeBlock === null && !task.completed
    );

    if (uncompletedInboxTasks.length === 0) {
      return;
    }

    // 오늘의 DailyData 로드
    const todayData = await loadDailyData(todayDate);

    // 미완료 인박스 작업들을 오늘로 이동 (중복 방지)
    const existingTaskIds = new Set(todayData.tasks.map(t => t.id));
    const tasksToMigrate = uncompletedInboxTasks.filter(task => !existingTaskIds.has(task.id));

    if (tasksToMigrate.length > 0) {
      todayData.tasks.push(...tasksToMigrate);
      await saveDailyData(todayDate, todayData.tasks, todayData.timeBlockStates);
    }
  } catch (error) {
    console.error('Failed to migrate uncompleted inbox tasks:', error);
  }
}

/**
 * 자동 생성 템플릿에서 작업 생성
 *
 * @architecture Option A: Server-First Strategy
 *   - Firebase Function이 이미 실행했는지 먼저 체크
 *   - Function이 실행했다면 클라이언트는 생성하지 않음
 *   - Function이 실행하지 않았거나 실패했다면 Fallback으로 로컬에서 생성
 */
export async function generateTasksFromAutoTemplates(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Step 1: Firebase Function 실행 여부 체크
    const { isFirebaseInitialized } = await import('@/shared/services/sync/firebaseService');

    if (isFirebaseInitialized()) {
      try {
        const { getDatabase, ref, get } = await import('firebase/database');
        const db = getDatabase();
        const systemStateRef = ref(db, 'users/user/system/lastTemplateGeneration');
        const snapshot = await get(systemStateRef);
        const lastGenData = snapshot.val();

        if (lastGenData && lastGenData.date === today && lastGenData.success) {
          return;
        }
      } catch (firebaseError) {
        console.warn(
          'Failed to check Firebase Function state, falling back to local generation',
          firebaseError
        );
      }
    }

    // Step 2: Fallback - 로컬에서 템플릿 생성
    const { generateTasksFromAutoTemplates: generateTasks } = await import('../templateRepository');
    const tasks = await generateTasks();

    // 생성된 작업들을 dailyData에 추가
    if (tasks.length > 0) {
      const { addTask } = await import('../dailyDataRepository');
      for (const task of tasks) {
        await addTask(task);
      }

    }

    // Step 3: 로컬 생성 완료 상태를 Firebase에 기록
    if (isFirebaseInitialized() && tasks.length > 0) {
      try {
        const { getDatabase, ref, set } = await import('firebase/database');
        const db = getDatabase();
        const systemStateRef = ref(db, 'users/user/system/lastTemplateGeneration');

        await set(systemStateRef, {
          date: today,
          success: true,
          source: 'client',
          timestamp: Date.now(),
          generatedCount: tasks.length,
          note: 'Generated locally (fallback)',
        });

      } catch (updateError) {
        console.warn('Failed to update Firebase system state', updateError);
      }
    }
  } catch (error) {
    console.error('Failed to generate tasks from auto-templates:', error);
  }
}
