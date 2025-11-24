/**
 * GameState Repository
 *
 * @role 게임화 시스템 데이터 관리 (XP, 레벨, 퀘스트, 연속 출석 등)
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

import { db } from '../db/dexieClient';
import type { GameState, Quest, Task } from '@/shared/types/domain';
import { getLocalDate, getLevelFromXP } from '@/shared/lib/utils';
import { generateQuestTarget, calculateQuestReward } from '@/shared/utils/gamification';
import { gameStateStrategy } from '@/shared/services/sync/firebase/strategies';
import { loadData, saveData, type RepositoryConfig } from './baseRepository';

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
    dailyTimerCount: 0, // 오늘 타이머 사용 횟수
    inventory: {}, // 아이템 인벤토리 초기화

    // 점화 시스템
    dailyFreeIgnitions: 3,
    usedIgnitions: 0,
    lastIgnitionTime: null,
    lastIgnitionResetDate: new Date().toISOString().split('T')[0],
  }),
  sanitize: (data: GameState) => {
    // 필수 필드 초기화
    return {
      ...data,
      dailyQuests: Array.isArray(data.dailyQuests) ? data.dailyQuests : generateDailyQuests(),
      xpHistory: Array.isArray(data.xpHistory) ? data.xpHistory : [],
      timeBlockXPHistory: Array.isArray(data.timeBlockXPHistory) ? data.timeBlockXPHistory : [],
      completedTasksHistory: Array.isArray(data.completedTasksHistory) ? data.completedTasksHistory : [],
      timeBlockXP: data.timeBlockXP || {},
      dailyTimerCount: typeof data.dailyTimerCount === 'number' ? data.dailyTimerCount : 0,
      inventory: data.inventory || {},

      // 점화 시스템
      dailyFreeIgnitions: data.dailyFreeIgnitions ?? 3,
      usedIgnitions: data.usedIgnitions ?? 0,
      lastIgnitionTime: data.lastIgnitionTime ?? null,
      lastIgnitionResetDate: data.lastIgnitionResetDate ?? new Date().toISOString().split('T')[0],
    };
  },
  logPrefix: 'GameState',
};

// ============================================================================
// GameState CRUD
// ============================================================================

/**
 * 초기 GameState 생성
 *
 * @returns {GameState} 기본값으로 초기화된 게임 상태
 * @throws 없음
 * @sideEffects
 *   - generateDailyQuests 호출하여 초기 퀘스트 생성
 */
export function createInitialGameState(): GameState {
  return gameStateConfig.createInitial();
}

/**
 * GameState 로드
 *
 * @returns {Promise<GameState>} 게임 상태 객체 (없으면 초기값)
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - localStorage 폴백 시 IndexedDB에 데이터 복원
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원
 *   - 필수 필드 누락 시 초기화 및 저장
 *   - 날짜 변경 시 일일 초기화
 */
export async function loadGameState(): Promise<GameState> {
  try {
    // BaseRepository를 통한 기본 로드 (3-tier fallback)
    let data = await loadData(gameStateConfig, 'current');

    // 날짜 변경 체크 및 일일 초기화
    const today = getLocalDate();
    const needsReset = data.lastLogin !== today;

    if (needsReset) {
      console.log(`🔄 New day detected: ${data.lastLogin} → ${today}`);

      // 일일 초기화
      data.dailyXP = 0;
      data.availableXP = 0;
      data.dailyTimerCount = 0;
      data.dailyQuests = generateDailyQuests();
      data.lastLogin = today;
      data.questBonusClaimed = false;
      data.timeBlockXP = {};

      // 즉시 저장
      await saveGameState(data);
      console.log('✅ Daily reset completed');
    }

    // 일일퀘스트 검증 및 보완
    if (data.dailyQuests.length === 0) {
      data.dailyQuests = generateDailyQuests();
      await saveGameState(data);
    } else {
      let questsUpdated = false;

      // 준비된 할일 퀘스트가 없으면 추가
      const hasPrepareTasksQuest = data.dailyQuests.some(q => q.type === 'prepare_tasks');
      if (!hasPrepareTasksQuest) {
        const prepareTasksTarget = 10;
        const prepareTasksReward = 150;
        data.dailyQuests.push({
          id: `quest-prepare-${prepareTasksTarget}-tasks`,
          type: 'prepare_tasks',
          title: `⭐ 준비된 할일 ${prepareTasksTarget}개 만들기`,
          description: `방해물과 대처법을 모두 입력한 할일을 ${prepareTasksTarget}개 만드세요`,
          target: prepareTasksTarget,
          progress: 0,
          completed: false,
          reward: prepareTasksReward,
        });
        questsUpdated = true;
      }

      // 타이머 퀘스트가 없으면 추가
      const hasUseTimerQuest = data.dailyQuests.some(q => q.type === 'use_timer');
      if (!hasUseTimerQuest) {
        const useTimerTarget = 5;
        const useTimerReward = 100;
        data.dailyQuests.push({
          id: `quest-timer-${useTimerTarget}-tasks`,
          type: 'use_timer',
          title: `⏱️ 타이머 ${useTimerTarget}회 사용하기`,
          description: `타이머를 사용하여 ${useTimerTarget}개의 작업을 완료하세요`,
          target: useTimerTarget,
          progress: 0,
          completed: false,
          reward: useTimerReward,
        });
        questsUpdated = true;
      }

      if (questsUpdated) {
        await saveGameState(data);
      }
    }

    return data;
  } catch (error) {
    console.error('Failed to load game state:', error);
    return createInitialGameState();
  }
}

/**
 * GameState 저장
 *
 * @param {GameState} gameState - 저장할 게임 상태 객체
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 데이터 저장
 *   - localStorage에 백업
 *   - Firebase에 비동기 동기화
 *   - syncLogger에 로그 기록
 */
export async function saveGameState(gameState: GameState): Promise<void> {
  await saveData(gameStateConfig, 'current', gameState);
}

/**
 * GameState 부분 업데이트
 *
 * @param {Partial<GameState>} updates - 업데이트할 필드
 * @returns {Promise<GameState>} 업데이트된 게임 상태
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - saveGameState 호출
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
 *
 * @param {number} amount - 추가할 XP 양
 * @param {string} [blockId] - 블록 ID (블록별 XP 기록용, 선택)
 * @returns {Promise<GameState>} 업데이트된 게임 상태
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - totalXP, dailyXP, availableXP 증가
 *   - 레벨 재계산
 *   - 블록별 XP 기록
 *   - XP 토스트 표시 (브라우저 환경에서)
 *   - saveGameState 호출
 */
export async function addXP(
  amount: number,
  blockId?: string,
  reason: import('@/shared/services/gameplay/gameState').XPGainReason = 'other'
): Promise<import('@/shared/services/gameplay/gameState').GameStateChangeResult> {
  try {
    const gameState = await loadGameState();

    const now = new Date();
    const blockFromTime = getTimeBlockIdFromHour(now.getHours());

    // 레벨업 감지를 위해 기존 레벨 저장
    const previousLevel = gameState.level;

    gameState.totalXP += amount;
    gameState.dailyXP += amount;
    gameState.availableXP += amount;
    gameState.level = getLevelFromXP(gameState.totalXP);

    // 레벨업 감지
    const leveledUp = gameState.level > previousLevel;

    // 블록별 XP 기록
    const blockKey = blockFromTime || blockId;
    if (blockKey) {
      gameState.timeBlockXP[blockKey] = (gameState.timeBlockXP[blockKey] || 0) + amount;
    }

    await saveGameState(gameState);

    // 이벤트 생성 (UI 로직 분리)
    const events: import('@/shared/services/gameplay/gameState').GameStateEvent[] = [];

    // 0 XP는 이벤트 생성하지 않음 (무의미한 토스트 방지)
    if (amount > 0) {
      // XP 획득 이벤트
      events.push({
        type: 'xp_gained',
        amount,
        reason,
        blockId: blockKey,
      });
    }

    // 레벨업 이벤트
    if (leveledUp) {
      events.push({
        type: 'level_up',
        previousLevel,
        newLevel: gameState.level,
        totalXP: gameState.totalXP,
      });
    }

    return {
      gameState,
      events,
    };
  } catch (error) {
    console.error('Failed to add XP:', error);
    throw error;
  }
}

/**
 * XP 소비
 *
 * @param {number} amount - 소비할 XP 양
 * @returns {Promise<GameState>} 업데이트된 게임 상태
 * @throws {Error} XP 부족 또는 저장 실패 시
 * @sideEffects
 *   - availableXP 감소
 *   - saveGameState 호출
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
 *
 * @returns {Promise<GameState>} 초기화된 게임 상태
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - XP 히스토리에 어제 데이터 추가
 *   - dailyXP, timeBlockXP 초기화
 *   - 퀘스트 보너스 플래그 리셋
 *   - 연속 출석일 계산 및 업데이트
 *   - 새로운 일일 퀘스트 생성
 *   - 어제의 미완료 인박스 작업들을 오늘로 이동
 *   - 자동 생성 템플릿에서 작업 생성
 *   - saveGameState 호출
 */
export async function initializeNewDay(): Promise<GameState> {
  try {
    const gameState = await loadGameState();
    const today = getLocalDate();
    const yesterday = gameState.lastLogin; // 마지막 로그인 날짜 = 어제

    // 히스토리 필드 초기화 (Firebase에서 가져온 데이터에 없을 수 있음)
    if (!Array.isArray(gameState.xpHistory)) {
      gameState.xpHistory = [];
    }
    if (!Array.isArray(gameState.timeBlockXPHistory)) {
      gameState.timeBlockXPHistory = [];
    }
    if (!Array.isArray(gameState.completedTasksHistory)) {
      gameState.completedTasksHistory = [];
    }
    if (!gameState.timeBlockXP) {
      gameState.timeBlockXP = {};
    }

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
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDate(yesterdayDate);

    if (gameState.lastLogin === yesterdayStr) {
      gameState.streak += 1;
    } else if (gameState.lastLogin !== today) {
      gameState.streak = 1;
    }

    // 새로운 일일 퀘스트 생성
    gameState.dailyQuests = generateDailyQuests();

    // 어제의 미완료 인박스 작업들을 오늘로 이동
    await migrateUncompletedInboxTasks(yesterday, today);

    // 자동 생성 템플릿에서 작업 생성
    await generateTasksFromAutoTemplates();

    // 전역 목표 진행도 초기화 (매일 리셋)
    const { resetDailyGoalProgress } = await import('./globalGoalRepository');
    await resetDailyGoalProgress();
    console.log('✅ Global goal progress reset for new day');

    await saveGameState(gameState);
    return gameState;
  } catch (error) {
    console.error('Failed to initialize new day:', error);
    throw error;
  }
}

/**
 * 어제의 미완료 인박스 작업들을 오늘로 이동 (내부 헬퍼)
 *
 * @param {string} yesterdayDate - 어제 날짜 (YYYY-MM-DD)
 * @param {string} todayDate - 오늘 날짜 (YYYY-MM-DD)
 * @returns {Promise<void>}
 * @sideEffects
 *   - 어제의 미완료 인박스 작업들을 오늘의 DailyData에 추가
 */
async function migrateUncompletedInboxTasks(yesterdayDate: string, todayDate: string): Promise<void> {
  try {
    // dailyDataRepository를 동적으로 import (순환 참조 방지)
    const { loadDailyData, saveDailyData } = await import('./dailyDataRepository');

    // 어제의 DailyData 로드
    const yesterdayData = await loadDailyData(yesterdayDate);

    // 미완료 인박스 작업 찾기 (timeBlock이 null이고 완료되지 않은 작업들)
    const uncompletedInboxTasks = yesterdayData.tasks.filter(
      task => task.timeBlock === null && !task.completed
    );

    if (uncompletedInboxTasks.length === 0) {
      return; // 이동할 작업이 없으면 종료
    }

    // 오늘의 DailyData 로드
    const todayData = await loadDailyData(todayDate);

    // 미완료 인박스 작업들을 오늘로 이동 (중복 방지)
    const existingTaskIds = new Set(todayData.tasks.map(t => t.id));
    const tasksToMigrate = uncompletedInboxTasks.filter(task => !existingTaskIds.has(task.id));

    if (tasksToMigrate.length > 0) {
      todayData.tasks.push(...tasksToMigrate);
      await saveDailyData(todayDate, todayData.tasks, todayData.timeBlockStates);

      console.log(`✅ Migrated ${tasksToMigrate.length} uncompleted inbox tasks from ${yesterdayDate} to ${todayDate}`);
    }
  } catch (error) {
    console.error('Failed to migrate uncompleted inbox tasks:', error);
    // 마이그레이션 실패해도 앱은 계속 동작
  }
}

/**
 * 자동 생성 템플릿에서 작업 생성 (내부 헬퍼)
 *
 * @architecture Option A: Server-First Strategy
 *   - Firebase Function이 이미 실행했는지 먼저 체크
 *   - Function이 실행했다면 클라이언트는 생성하지 않음 (Observer 역할)
 *   - Function이 실행하지 않았거나 실패했다면 Fallback으로 로컬에서 생성
 */
async function generateTasksFromAutoTemplates(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // ========================================================================
    // Step 1: Firebase Function이 이미 실행했는지 체크
    // ========================================================================
    const { isFirebaseInitialized } = await import('@/shared/services/sync/firebaseService');

    if (isFirebaseInitialized()) {
      try {
        const { getDatabase, ref, get } = await import('firebase/database');
        const db = getDatabase();
        const systemStateRef = ref(db, 'users/user/system/lastTemplateGeneration');
        const snapshot = await get(systemStateRef);
        const lastGenData = snapshot.val();

        if (lastGenData && lastGenData.date === today && lastGenData.success) {
          console.log('✅ [Observer] Firebase Function already generated templates today', {
            date: today,
            source: lastGenData.source,
            timestamp: lastGenData.timestamp,
            generatedCount: lastGenData.generatedCount
          });

          // Firebase Function이 이미 실행했으므로 로컬 생성 스킵
          // 클라이언트는 Observer 역할: Firebase에서 데이터만 읽어옴
          return;
        }

        console.log('⚠️ [Fallback] Firebase Function has not run today, generating locally', {
          date: today,
          lastGenData: lastGenData || 'none'
        });
      } catch (firebaseError) {
        console.warn('Failed to check Firebase Function state, falling back to local generation', firebaseError);
      }
    } else {
      console.log('ℹ️ Firebase not initialized, generating locally');
    }

    // ========================================================================
    // Step 2: Fallback - 로컬에서 템플릿 생성
    // ========================================================================
    const { generateTasksFromAutoTemplates: generateTasks } = await import('./templateRepository');
    const tasks = await generateTasks();

    // 생성된 작업들을 dailyData에 추가
    if (tasks.length > 0) {
      const { addTask } = await import('./dailyDataRepository');
      for (const task of tasks) {
        await addTask(task);
      }

      console.log(`✅ [Client] Generated ${tasks.length} tasks from templates locally`);
    }

    // ========================================================================
    // Step 3: 로컬 생성 완료 상태를 Firebase에 기록 (선택적)
    // ========================================================================
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
          note: 'Generated locally (fallback)'
        });

        console.log('✅ Updated Firebase system state (client-generated)');
      } catch (updateError) {
        console.warn('Failed to update Firebase system state', updateError);
        // 상태 업데이트 실패는 무시 (작업 생성은 이미 완료됨)
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
 * 내부 헬퍼 함수
 */
function generateDailyQuests(): Quest[] {
  // 동적으로 목표값 생성
  const completeTasksTarget = generateQuestTarget('complete_tasks');
  const earnXPTarget = generateQuestTarget('earn_xp');
  const lockBlocksTarget = generateQuestTarget('lock_blocks');
  const perfectBlocksTarget = generateQuestTarget('perfect_blocks');
  const prepareTasksTarget = 3; // 준비된 할일 목표: 3개
  const useTimerTarget = 5; // 타이머 사용 목표: 5개

  // 각 퀘스트의 보상 계산
  const completeTasksReward = calculateQuestReward('complete_tasks');
  const earnXPReward = calculateQuestReward('earn_xp');
  const lockBlocksReward = calculateQuestReward('lock_blocks');
  const perfectBlocksReward = calculateQuestReward('perfect_blocks');
  const prepareTasksReward = 150; // 준비된 할일은 고정 보상
  const useTimerReward = 100; // 타이머 사용은 고정 보상

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
    {
      id: `quest-prepare-${prepareTasksTarget}-tasks`,
      type: 'prepare_tasks',
      title: `⭐ 준비된 할일 ${prepareTasksTarget}개 만들기`,
      description: `방해물과 대처법을 모두 입력한 할일을 ${prepareTasksTarget}개 만드세요`,
      target: prepareTasksTarget,
      progress: 0,
      completed: false,
      reward: prepareTasksReward,
    },
    {
      id: `quest-timer-${useTimerTarget}-tasks`,
      type: 'use_timer',
      title: `⏱️ 타이머 ${useTimerTarget}회 사용하기`,
      description: `타이머를 사용하여 ${useTimerTarget}개의 작업을 완료하세요`,
      target: useTimerTarget,
      progress: 0,
      completed: false,
      reward: useTimerReward,
    },
  ];
}

/**
 * 퀘스트 진행도 업데이트
 *
 * @param {Quest['type']} questType - 퀘스트 타입
 * @param {number} [amount=1] - 진행도 증가량
 * @returns {Promise<GameState>} 업데이트된 게임 상태
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - 해당 타입 퀘스트의 진행도 증가
 *   - 목표 달성 시 퀘스트 완료 처리 및 보상 XP 지급
 *   - saveGameState 호출
 */
export async function updateQuestProgress(questType: Quest['type'], amount: number = 1): Promise<GameState> {
  try {
    const gameState = await loadGameState();

    // use_timer 타입이면 dailyTimerCount 증가
    if (questType === 'use_timer') {
      gameState.dailyTimerCount = (gameState.dailyTimerCount || 0) + amount;
    }

    // 완료된 퀘스트들을 추적하여 XP 지급
    const completedQuests: Quest[] = [];

    gameState.dailyQuests.forEach(quest => {
      if (quest.type === questType && !quest.completed) {
        quest.progress = Math.min(quest.progress + amount, quest.target);

        if (quest.progress >= quest.target && !quest.completed) {
          quest.completed = true;
          completedQuests.push(quest);
        }
      }
    });

    await saveGameState(gameState);

      // 완료된 퀘스트들의 보상 XP를 addXP를 통해 지급 (토스트 메시지 및 quest_completed 이벤트 발생)
      for (const quest of completedQuests) {
        await addXP(quest.reward);
        // quest_completed 이벤트를 전달하여 토스트/알림 노출
        const { gameStateEventHandler } = await import('@/shared/services/gameplay/gameState');
        await gameStateEventHandler.handleEvents([{
          type: 'quest_completed',
          questId: quest.id,
          questTitle: quest.title,
          reward: quest.reward,
        }]);
      }

    return gameState;
  } catch (error) {
    console.error('Failed to update quest progress:', error);
    throw error;
  }
}

/**
 * 퀘스트 보너스 클레임
 *
 * @returns {Promise<GameState>} 업데이트된 게임 상태
 * @throws {Error} 이미 클레임했거나 완료된 퀘스트가 없거나 저장 실패 시
 * @sideEffects
 *   - 모든 퀘스트 완료 시 보너스 XP 지급 (+100)
 *   - questBonusClaimed 플래그 설정
 *   - saveGameState 호출
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
      gameState.questBonusClaimed = true;
      await saveGameState(gameState);

      // addXP를 통해 보너스 지급 (토스트 메시지 표시)
      await addXP(100);
    } else {
      gameState.questBonusClaimed = true;
      await saveGameState(gameState);
    }

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
 *
 * @param {Task} task - 완료된 작업 객체
 * @returns {Promise<void>}
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - completedTasksHistory 배열에 작업 추가 (최근 50개 유지)
 *   - saveGameState 호출
 */
export async function addToCompletedHistory(task: Task): Promise<void> {
  try {
    const gameState = await loadGameState();

    // completedTasksHistory 초기화 (안전장치)
    if (!Array.isArray(gameState.completedTasksHistory)) {
      gameState.completedTasksHistory = [];
    }

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
 *
 * @param {number} [days=7] - 조회할 일수
 * @returns {Promise<Array<{ date: string; xp: number }>>} 날짜별 XP 배열
 * @throws 없음
 * @sideEffects
 *   - loadGameState 호출
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
 *
 * @param {number} [days=5] - 조회할 일수
 * @returns {Promise<Array<{ date: string; blocks: Record<string, number> }>>} 날짜별 블록 XP 배열
 * @throws 없음
 * @sideEffects
 *   - loadGameState 호출
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

/**
 * 현재 시각의 시(hour)에 따라 타임블록 ID 반환
 * - 23~04시는 'other'로 분류
 */
function getTimeBlockIdFromHour(hour: number): string {
  if (hour >= 5 && hour < 8) return '5-8';
  if (hour >= 8 && hour < 11) return '8-11';
  if (hour >= 11 && hour < 14) return '11-14';
  if (hour >= 14 && hour < 17) return '14-17';
  if (hour >= 17 && hour < 20) return '17-20';
  if (hour >= 20 && hour < 23) return '20-23';
  return 'other';
}
