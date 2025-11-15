/**
 * GameState 저장소
 * 게임 상태(XP, 레벨, 퀘스트 등) 관리
 */

import { db } from '../db/dexieClient';
import type { GameState, Quest, Task } from '@/shared/types/domain';
import { getLocalDate, saveToStorage, getFromStorage, getLevelFromXP } from '@/shared/lib/utils';
import { STORAGE_KEYS } from '@/shared/lib/constants';
import { generateQuestTarget, calculateQuestReward } from '@/shared/utils/gamification';
import { syncGameStateToFirebase, isFirebaseInitialized } from '@/shared/services/firebaseService';
import { addSyncLog } from '@/shared/services/syncLogger';

// ============================================================================
// GameState CRUD
// ============================================================================

/**
 * 초기 GameState 생성
 */
export function createInitialGameState(): GameState {
  return {
    level: 1,
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
  };
}

/**
 * GameState 로드
 */
export async function loadGameState(): Promise<GameState> {
  try {
    // 1. IndexedDB에서 조회
    const data = await db.gameState.get('current');

    if (data) {
      // 일일퀘스트가 없거나 비어있으면 생성
      if (!data.dailyQuests || data.dailyQuests.length === 0) {
        data.dailyQuests = generateDailyQuests();
        await saveGameState(data);
      }
      return data;
    }

    // 2. localStorage에서 조회
    const localData = getFromStorage<GameState | null>(STORAGE_KEYS.GAME_STATE, null);

    if (localData) {
      // 일일퀘스트가 없거나 비어있으면 생성
      if (!localData.dailyQuests || localData.dailyQuests.length === 0) {
        localData.dailyQuests = generateDailyQuests();
      }
      // localStorage 데이터를 IndexedDB에 저장
      await saveGameState(localData);
      return localData;
    }

    // 3. 초기 상태 생성
    const initialState = createInitialGameState();
    await saveGameState(initialState);
    return initialState;
  } catch (error) {
    console.error('Failed to load game state:', error);
    return createInitialGameState();
  }
}

/**
 * GameState 저장
 */
export async function saveGameState(gameState: GameState): Promise<void> {
  try {
    // 1. IndexedDB에 저장
    await db.gameState.put({
      key: 'current',
      ...gameState,
    });

    // 2. localStorage에도 저장
    saveToStorage(STORAGE_KEYS.GAME_STATE, gameState);

    addSyncLog('dexie', 'save', 'GameState saved', {
      level: gameState.level,
      xp: gameState.totalXP,
      dailyXP: gameState.dailyXP
    });
    console.log(`✅ Game state saved (Level ${gameState.level}, XP ${gameState.totalXP})`);

    // 3. Firebase에 동기화 (비동기, 실패해도 로컬은 성공)
    if (isFirebaseInitialized()) {
      syncGameStateToFirebase(gameState).catch(err => {
        console.error('Firebase sync failed, but local save succeeded:', err);
      });
    }
  } catch (error) {
    console.error('Failed to save game state:', error);
    addSyncLog('dexie', 'error', 'Failed to save game state', undefined, error as Error);
    throw error;
  }
}

/**
 * GameState 리셋
 */
export async function resetGameState(): Promise<GameState> {
  const initialState = createInitialGameState();
  await saveGameState(initialState);
  return initialState;
}

// ============================================================================
// XP 관리
// ============================================================================

/**
 * XP 추가
 */
export async function addXP(amount: number, blockId?: string): Promise<GameState> {
  try {
    const gameState = await loadGameState();

    gameState.totalXP += amount;
    gameState.dailyXP += amount;
    gameState.availableXP += amount;
    gameState.level = getLevelFromXP(gameState.totalXP);

    // 블록별 XP 기록
    if (blockId) {
      gameState.timeBlockXP[blockId] = (gameState.timeBlockXP[blockId] || 0) + amount;
    }

    await saveGameState(gameState);

    // XP 토스트 표시 (동적 import로 순환 참조 방지)
    if (typeof window !== 'undefined') {
      import('@/shared/hooks/useXPToast').then((module) => {
        const message = amount === 15 ? '계획 잠금!' : amount === 40 ? '완벽한 블록 완료!' : '작업 완료!';
        module.useXPToastStore.getState().addToast(amount, message);
      }).catch(console.error);
    }

    return gameState;
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

    if (gameState.availableXP < amount) {
      throw new Error('Not enough XP');
    }

    gameState.availableXP -= amount;

    await saveGameState(gameState);
    return gameState;
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

    // XP 히스토리에 어제 데이터 추가
    if (gameState.lastLogin !== today && gameState.dailyXP > 0) {
      gameState.xpHistory.push({
        date: gameState.lastLogin,
        xp: gameState.dailyXP,
      });

      // 최근 7일만 유지
      if (gameState.xpHistory.length > 7) {
        gameState.xpHistory = gameState.xpHistory.slice(-7);
      }

      // 블록별 XP 히스토리 추가
      if (Object.keys(gameState.timeBlockXP).length > 0) {
        gameState.timeBlockXPHistory.push({
          date: gameState.lastLogin,
          blocks: { ...gameState.timeBlockXP },
        });

        // 최근 5일만 유지
        if (gameState.timeBlockXPHistory.length > 5) {
          gameState.timeBlockXPHistory = gameState.timeBlockXPHistory.slice(-5);
        }
      }
    }

    // 일일 초기화
    gameState.dailyXP = 0;
    gameState.timeBlockXP = {};
    gameState.questBonusClaimed = false;
    gameState.lastLogin = today;

    // 연속 출석일 계산
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDate(yesterday);

    if (gameState.lastLogin === yesterdayStr) {
      gameState.streak += 1;
    } else if (gameState.lastLogin !== today) {
      gameState.streak = 1;
    }

    // 새로운 일일 퀘스트 생성
    gameState.dailyQuests = generateDailyQuests();

    // 자동 생성 템플릿에서 작업 생성
    await generateTasksFromAutoTemplates();

    await saveGameState(gameState);
    return gameState;
  } catch (error) {
    console.error('Failed to initialize new day:', error);
    throw error;
  }
}

/**
 * 자동 생성 템플릿에서 작업 생성 (내부 헬퍼)
 */
async function generateTasksFromAutoTemplates(): Promise<void> {
  try {
    // templateRepository의 함수를 동적으로 import (순환 참조 방지)
    const { generateTasksFromAutoTemplates: generateTasks } = await import('./templateRepository');
    const tasks = await generateTasks();

    // 생성된 작업들을 dailyData에 추가
    if (tasks.length > 0) {
      const { addTask } = await import('./dailyDataRepository');
      for (const task of tasks) {
        await addTask(task);
      }
    }
  } catch (error) {
    console.error('Failed to generate tasks from auto-templates:', error);
  }
}

// ============================================================================
// Quest 관리
// ============================================================================

/**
 * 일일 퀘스트 생성 (동적 난이도)
 */
function generateDailyQuests(): Quest[] {
  // 동적으로 목표값 생성
  const completeTasksTarget = generateQuestTarget('complete_tasks');
  const earnXPTarget = generateQuestTarget('earn_xp');
  const lockBlocksTarget = generateQuestTarget('lock_blocks');
  const perfectBlocksTarget = generateQuestTarget('perfect_blocks');

  // 각 퀘스트의 보상 계산
  const completeTasksReward = calculateQuestReward('complete_tasks');
  const earnXPReward = calculateQuestReward('earn_xp');
  const lockBlocksReward = calculateQuestReward('lock_blocks');
  const perfectBlocksReward = calculateQuestReward('perfect_blocks');

  return [
    {
      id: `quest-complete-${completeTasksTarget}`,
      type: 'complete_tasks',
      title: `작업 ${completeTasksTarget}개 완료하기`,
      description: `오늘 작업을 ${completeTasksTarget}개 완료하세요`,
      target: completeTasksTarget,
      progress: 0,
      completed: false,
      reward: completeTasksReward,
    },
    {
      id: `quest-earn-${earnXPTarget}xp`,
      type: 'earn_xp',
      title: `${earnXPTarget} XP 획득하기`,
      description: `오늘 ${earnXPTarget} XP를 획득하세요`,
      target: earnXPTarget,
      progress: 0,
      completed: false,
      reward: earnXPReward,
    },
    {
      id: `quest-lock-${lockBlocksTarget}-blocks`,
      type: 'lock_blocks',
      title: `블록 ${lockBlocksTarget}개 잠그기`,
      description: `타임블록을 ${lockBlocksTarget}개 잠그세요`,
      target: lockBlocksTarget,
      progress: 0,
      completed: false,
      reward: lockBlocksReward,
    },
    {
      id: `quest-perfect-${perfectBlocksTarget}-block`,
      type: 'perfect_blocks',
      title: `완벽한 블록 ${perfectBlocksTarget}개 달성`,
      description: `블록을 ${perfectBlocksTarget}개 완벽하게 완료하세요`,
      target: perfectBlocksTarget,
      progress: 0,
      completed: false,
      reward: perfectBlocksReward,
    },
  ];
}

/**
 * 퀘스트 진행도 업데이트
 */
export async function updateQuestProgress(questType: Quest['type'], amount: number = 1): Promise<GameState> {
  try {
    const gameState = await loadGameState();

    gameState.dailyQuests.forEach(quest => {
      if (quest.type === questType && !quest.completed) {
        quest.progress = Math.min(quest.progress + amount, quest.target);

        if (quest.progress >= quest.target) {
          quest.completed = true;
          gameState.availableXP += quest.reward;
        }
      }
    });

    await saveGameState(gameState);
    return gameState;
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
      gameState.availableXP += 100;
    }

    gameState.questBonusClaimed = true;

    await saveGameState(gameState);
    return gameState;
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

    gameState.completedTasksHistory.unshift(task);

    // 최근 50개만 유지
    if (gameState.completedTasksHistory.length > 50) {
      gameState.completedTasksHistory = gameState.completedTasksHistory.slice(0, 50);
    }

    await saveGameState(gameState);
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
    return gameState.xpHistory.slice(-days);
  } catch (error) {
    console.error('Failed to get XP history:', error);
    return [];
  }
}

/**
 * 블록별 XP 히스토리 가져오기
 */
export async function getTimeBlockXPHistory(days: number = 5): Promise<Array<{ date: string; blocks: Record<string, number> }>> {
  try {
    const gameState = await loadGameState();
    return gameState.timeBlockXPHistory.slice(-days);
  } catch (error) {
    console.error('Failed to get timeblock XP history:', error);
    return [];
  }
}
