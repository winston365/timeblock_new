/**
 * GameState Repository
 *
 * @role 게임화 시스템 데이터 관리 (XP, 퀘스트, 연속 출석 등)
 * @input GameState 객체, XP 값, Quest 타입, Task 객체
 * @output GameState 객체, Quest 배열, XP 히스토리
 * @external_dependencies
 *   - IndexedDB (db.gameState): 메인 저장소
 *   - localStorage (STORAGE_KEYS.GAME_STATE): 백업 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: GameState, Quest, Task 타입
 *   - @/shared/utils/gamification: 퀘스트 생성 및 보상 계산 로직
 *   - BaseRepository: 공통 Repository 패턴
 */

import { db } from '../../db/dexieClient';
import type { GameState, Quest, Task } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { gameStateStrategy } from '@/shared/services/sync/firebase/strategies';
import { loadData, saveData, type RepositoryConfig } from '../baseRepository';

// Domain operations
import {
  generateDailyQuests,
  validateAndCompleteQuests,
  incrementQuestProgress,
} from './questOperations';
import { processAddXP, processSpendXP } from './xpOperations';
import {
  addToCompletedTasksHistory,
  getXPHistoryFromState,
  getBlockXPHistoryFromState,
} from './historyOperations';
import {
  processDailyReset,
  calculateStreak,
  migrateUncompletedInboxTasks,
  generateTasksFromAutoTemplates,
} from './dayOperations';

// Re-export sub-modules for direct access
export {
  generateDailyQuests,
  validateAndCompleteQuests,
  incrementQuestProgress,
} from './questOperations';
export { processAddXP, processSpendXP } from './xpOperations';
export {
  addToXPHistory,
  addToBlockXPHistory,
  addToCompletedTasksHistory,
  getXPHistoryFromState,
  getBlockXPHistoryFromState,
} from './historyOperations';
export {
  processDailyReset,
  calculateStreak,
  migrateUncompletedInboxTasks,
  generateTasksFromAutoTemplates,
} from './dayOperations';

// ============================================================================
// Repository Configuration
// ============================================================================

/**
 * GameState Repository 설정
 */
const gameStateConfig: RepositoryConfig<GameState> = {
  table: db.gameState,
  firebaseStrategy: gameStateStrategy,
  createInitial: () => ({
    totalXP: 0,
    dailyXP: 0,
    availableXP: 0,
    streak: 0,
    lastLogin: getLocalDate(),
    questBonusClaimed: false,
    xpHistory: [],
    dailyQuests: generateDailyQuests(),
    timeBlockXP: {},
    timeBlockXPHistory: [],
    completedTasksHistory: [],
    dailyTimerCount: 0,
    inventory: {},
  }),
  sanitize: (data: GameState) => {
    const { level: _legacyLevel, ...rest } = data as GameState & { level?: number };
    void _legacyLevel;
    return {
      ...rest,
      dailyQuests: Array.isArray(rest.dailyQuests) ? rest.dailyQuests : generateDailyQuests(),
      xpHistory: Array.isArray(rest.xpHistory) ? rest.xpHistory : [],
      timeBlockXPHistory: Array.isArray(rest.timeBlockXPHistory) ? rest.timeBlockXPHistory : [],
      completedTasksHistory: Array.isArray(rest.completedTasksHistory)
        ? rest.completedTasksHistory
        : [],
      timeBlockXP: rest.timeBlockXP || {},
      dailyTimerCount: typeof rest.dailyTimerCount === 'number' ? rest.dailyTimerCount : 0,
      inventory: rest.inventory || {},
    };
  },
  logPrefix: 'GameState',
};

// ============================================================================
// GameState CRUD
// ============================================================================

/**
 * 초기 GameState 생성
 */
export function createInitialGameState(): GameState {
  return gameStateConfig.createInitial();
}

/**
 * GameState 로드
 */
export async function loadGameState(): Promise<GameState> {
  try {
    const data = await loadData(gameStateConfig, 'current');
    const today = getLocalDate();

    // 날짜 변경 체크 및 일일 초기화
    const { updatedState, needsReset } = processDailyReset(data, today);

    if (needsReset) {
      await saveGameState(updatedState);
      console.log('✅ Daily reset completed');
      return updatedState;
    }

    // 일일퀘스트 검증 및 보완
    if (data.dailyQuests.length === 0) {
      const withQuests = { ...data, dailyQuests: generateDailyQuests() };
      await saveGameState(withQuests);
      return withQuests;
    }

    const { quests, updated } = validateAndCompleteQuests(data.dailyQuests);
    if (updated) {
      const withValidatedQuests = { ...data, dailyQuests: quests };
      await saveGameState(withValidatedQuests);
      return withValidatedQuests;
    }

    return data;
  } catch (error) {
    console.error('Failed to load game state:', error);
    return createInitialGameState();
  }
}

/**
 * GameState 저장
 */
export async function saveGameState(gameState: GameState): Promise<void> {
  await saveData(gameStateConfig, 'current', gameState);
}

/**
 * GameState 부분 업데이트
 */
export async function updateGameState(updates: Partial<GameState>): Promise<GameState> {
  try {
    const gameState = await loadGameState();
    const updatedState = { ...gameState, ...updates };
    await saveGameState(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to update game state:', error);
    throw error;
  }
}

// ============================================================================
// XP 관리
// ============================================================================

/**
 * XP 추가
 */
export async function addXP(
  amount: number,
  blockId?: string,
  reason: import('@/shared/services/gameplay/gameState').XPGainReason = 'other'
): Promise<import('@/shared/services/gameplay/gameState').GameStateChangeResult> {
  try {
    const gameState = await loadGameState();
    const { updatedState, events } = processAddXP(gameState, amount, blockId, reason);
    await saveGameState(updatedState);
    return { gameState: updatedState, events };
  } catch (error) {
    console.error('Failed to add XP:', error);
    throw error;
  }
}

/**
 * XP 소비
 */
export async function spendXP(amount: number): Promise<GameState> {
  try {
    const gameState = await loadGameState();
    const result = processSpendXP(gameState, amount);

    if (!result.success || !result.updatedState) {
      throw new Error(result.error || 'Failed to spend XP');
    }

    await saveGameState(result.updatedState);
    return result.updatedState;
  } catch (error) {
    console.error('Failed to spend XP:', error);
    throw error;
  }
}

/**
 * 일일 초기화 (날짜가 변경되었을 때)
 */
export async function initializeNewDay(): Promise<GameState> {
  try {
    const gameState = await loadGameState();
    const today = getLocalDate();
    const yesterday = gameState.lastLogin;

    // 일일 리셋 처리
    let { updatedState } = processDailyReset(gameState, today);

    // 연속 출석일 계산
    updatedState = {
      ...updatedState,
      streak: calculateStreak(gameState, today),
    };

    // 어제의 미완료 인박스 작업들을 오늘로 이동
    await migrateUncompletedInboxTasks(yesterday, today);

    // 자동 생성 템플릿에서 작업 생성
    await generateTasksFromAutoTemplates();

    // 전역 목표 진행도 초기화
    const { resetDailyGoalProgress } = await import('../globalGoalRepository');
    await resetDailyGoalProgress();
    console.log('✅ Global goal progress reset for new day');

    await saveGameState(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to initialize new day:', error);
    throw error;
  }
}

// ============================================================================
// Quest 관리
// ============================================================================

/**
 * 퀘스트 진행도 업데이트
 */
export async function updateQuestProgress(
  questType: Quest['type'],
  amount: number = 1
): Promise<GameState> {
  try {
    const gameState = await loadGameState();

    // use_timer 타입이면 dailyTimerCount 증가
    let updatedTimerCount = gameState.dailyTimerCount;
    if (questType === 'use_timer') {
      updatedTimerCount = (gameState.dailyTimerCount || 0) + amount;
    }

    // 퀘스트 진행도 업데이트
    const { quests, completedQuests } = incrementQuestProgress(
      gameState.dailyQuests,
      questType,
      amount
    );

    const updatedState = {
      ...gameState,
      dailyQuests: quests,
      dailyTimerCount: updatedTimerCount,
    };

    await saveGameState(updatedState);

    // 완료된 퀘스트들의 보상 XP 지급
    for (const quest of completedQuests) {
      await addXP(quest.reward);
      const { gameStateEventHandler } = await import('@/shared/services/gameplay/gameState');
      await gameStateEventHandler.handleEvents([
        {
          type: 'quest_completed',
          questId: quest.id,
          questTitle: quest.title,
          reward: quest.reward,
        },
      ]);
    }

    return updatedState;
  } catch (error) {
    console.error('Failed to update quest progress:', error);
    throw error;
  }
}

/**
 * 퀘스트 보너스 클레임
 */
export async function claimQuestBonus(): Promise<GameState> {
  try {
    const gameState = await loadGameState();

    if (gameState.questBonusClaimed) {
      throw new Error('Quest bonus already claimed');
    }

    const completedQuests = gameState.dailyQuests.filter(q => q.completed);

    if (completedQuests.length === 0) {
      throw new Error('No completed quests');
    }

    // 모든 퀘스트 완료 시 추가 보너스
    if (completedQuests.length === gameState.dailyQuests.length) {
      const updatedState = { ...gameState, questBonusClaimed: true };
      await saveGameState(updatedState);
      await addXP(100);
      return updatedState;
    }

    const updatedState = { ...gameState, questBonusClaimed: true };
    await saveGameState(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to claim quest bonus:', error);
    throw error;
  }
}

// ============================================================================
// 히스토리 관리
// ============================================================================

/**
 * 완료 작업 히스토리에 추가
 */
export async function addToCompletedHistory(task: Task): Promise<void> {
  try {
    const gameState = await loadGameState();
    const updatedState = addToCompletedTasksHistory(gameState, task);
    await saveGameState(updatedState);
  } catch (error) {
    console.error('Failed to add to completed history:', error);
    throw error;
  }
}

/**
 * XP 히스토리 가져오기
 */
export async function getXPHistory(days: number = 7): Promise<Array<{ date: string; xp: number }>> {
  try {
    const gameState = await loadGameState();
    return getXPHistoryFromState(gameState, days);
  } catch (error) {
    console.error('Failed to get XP history:', error);
    return [];
  }
}

/**
 * 블록별 XP 히스토리 가져오기
 */
export async function getTimeBlockXPHistory(
  days: number = 5
): Promise<Array<{ date: string; blocks: Record<string, number> }>> {
  try {
    const gameState = await loadGameState();
    return getBlockXPHistoryFromState(gameState, days);
  } catch (error) {
    console.error('Failed to get timeblock XP history:', error);
    return [];
  }
}
