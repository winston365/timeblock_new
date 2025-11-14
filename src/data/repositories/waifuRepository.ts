/**
 * WaifuState 저장소
 * 와이푸 상태(호감도, 포즈, 상호작용) 관리
 */

import { db } from '../db/dexieClient';
import type { WaifuState } from '@/shared/types/domain';
import { saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { STORAGE_KEYS, AFFECTION_PER_TASK } from '@/shared/lib/constants';

// ============================================================================
// WaifuState CRUD
// ============================================================================

/**
 * 초기 WaifuState 생성
 */
export function createInitialWaifuState(): WaifuState {
  return {
    affection: 0,
    currentPose: 'default',
    lastInteraction: Date.now(),
    tasksCompletedToday: 0,
    totalInteractions: 0,
    lastIdleWarning: null,
    unlockedPoses: ['default'],
    lastAffectionTier: 'neutral',
    clickCount: 0,
    poseLockedUntil: null,
  };
}

/**
 * WaifuState 로드
 */
export async function loadWaifuState(): Promise<WaifuState> {
  try {
    // 1. IndexedDB에서 조회
    const data = await db.waifuState.get('current');

    if (data) {
      return data;
    }

    // 2. localStorage에서 조회
    const localData = getFromStorage<WaifuState | null>(STORAGE_KEYS.WAIFU_STATE, null);

    if (localData) {
      // localStorage 데이터를 IndexedDB에 저장
      await saveWaifuState(localData);
      return localData;
    }

    // 3. 초기 상태 생성
    const initialState = createInitialWaifuState();
    await saveWaifuState(initialState);
    return initialState;
  } catch (error) {
    console.error('Failed to load waifu state:', error);
    return createInitialWaifuState();
  }
}

/**
 * WaifuState 저장
 */
export async function saveWaifuState(waifuState: WaifuState): Promise<void> {
  try {
    // 1. IndexedDB에 저장
    await db.waifuState.put({
      key: 'current',
      ...waifuState,
    });

    // 2. localStorage에도 저장
    saveToStorage(STORAGE_KEYS.WAIFU_STATE, waifuState);

    console.log('✅ Waifu state saved');
  } catch (error) {
    console.error('Failed to save waifu state:', error);
    throw error;
  }
}

/**
 * WaifuState 리셋
 */
export async function resetWaifuState(): Promise<WaifuState> {
  const initialState = createInitialWaifuState();
  await saveWaifuState(initialState);
  return initialState;
}

// ============================================================================
// 호감도 관리
// ============================================================================

/**
 * 작업 완료 시 호감도 증가
 */
export async function increaseAffectionFromTask(): Promise<WaifuState> {
  try {
    const waifuState = await loadWaifuState();

    waifuState.affection = Math.min(waifuState.affection + AFFECTION_PER_TASK, 100);
    waifuState.tasksCompletedToday += 1;
    waifuState.lastInteraction = Date.now();

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to increase affection from task:', error);
    throw error;
  }
}

/**
 * 클릭 시 상호작용
 */
export async function interactWithWaifu(): Promise<WaifuState> {
  try {
    const waifuState = await loadWaifuState();

    waifuState.clickCount += 1;
    waifuState.totalInteractions += 1;
    waifuState.lastInteraction = Date.now();

    // 10회 클릭마다 호감도 1 증가
    if (waifuState.clickCount % 10 === 0) {
      waifuState.affection = Math.min(waifuState.affection + 1, 100);
    }

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to interact with waifu:', error);
    throw error;
  }
}

/**
 * 일일 초기화 (날짜가 변경되었을 때)
 */
export async function resetDailyWaifuStats(): Promise<WaifuState> {
  try {
    const waifuState = await loadWaifuState();

    waifuState.tasksCompletedToday = 0;
    waifuState.clickCount = 0;

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to reset daily waifu stats:', error);
    throw error;
  }
}

// ============================================================================
// 기분 계산
// ============================================================================

/**
 * 호감도에 따른 기분 가져오기
 */
export function getMoodFromAffection(affection: number): string {
  if (affection >= 80) return '🥰 매우 행복';
  if (affection >= 60) return '😊 행복';
  if (affection >= 40) return '😌 보통';
  if (affection >= 20) return '😐 무표정';
  return '😔 우울';
}

/**
 * 호감도에 따른 대사 가져오기
 */
export function getDialogueFromAffection(affection: number, _tasksCompleted: number): string {
  if (affection >= 80) {
    const dialogues = [
      '오늘도 정말 열심히 하시네요! 대단해요! ✨',
      '당신과 함께 있으니 매일이 즐거워요! 💖',
      '이렇게 노력하는 당신이 정말 자랑스러워요!',
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  if (affection >= 60) {
    const dialogues = [
      '오늘도 화이팅이에요! 😊',
      '작업을 하나씩 완료하는 모습이 멋져요!',
      '함께 열심히 해봐요!',
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  if (affection >= 40) {
    const dialogues = [
      '오늘은 어떤 작업을 하실 건가요?',
      '조금씩 해나가면 돼요.',
      '천천히 해도 괜찮아요.',
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  if (affection >= 20) {
    const dialogues = [
      '조금 더 힘내볼까요?',
      '오늘은 작업 하나라도 완료해보는 건 어때요?',
      '...괜찮으시죠?',
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  const dialogues = [
    '...요즘 많이 힘드신가 봐요.',
    '조금씩이라도 시작해보는 게 어때요?',
    '저도... 걱정돼요.',
  ];
  return dialogues[Math.floor(Math.random() * dialogues.length)];
}
