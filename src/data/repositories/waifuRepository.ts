/**
 * WaifuState Repository
 *
 * @role 와이푸 상태 데이터의 영속성 관리 (CRUD, 호감도, 상호작용 로직)
 * @input WaifuState 객체, 작업 완료 이벤트, 클릭 이벤트
 * @output WaifuState 객체, 기분/대사 문자열
 * @external_dependencies
 *   - IndexedDB (db.waifuState): 메인 저장소
 *   - localStorage (STORAGE_KEYS.WAIFU_STATE): 백업 저장소
 *   - @/shared/types/domain: WaifuState 타입
 *   - @/shared/lib/constants: 상수 (호감도 증가량 등)
 *   - BaseRepository: 공통 Repository 패턴
 */

import { db } from '../db/dexieClient';
import type { WaifuState } from '@/shared/types/domain';
import { AFFECTION_XP_TARGET } from '@/shared/lib/constants';
import { loadGameState } from './gameStateRepository';
import { loadData, saveData, type RepositoryConfig } from './baseRepository';

// ============================================================================
// Repository Configuration
// ============================================================================

/**
 * WaifuState Repository 설정
 */
const waifuStateConfig: RepositoryConfig<WaifuState> = {
  table: db.waifuState,
  createInitial: () => ({
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
  }),
  logPrefix: 'WaifuState',
};

// ============================================================================
// WaifuState CRUD
// ============================================================================

/**
 * 초기 WaifuState 생성
 *
 * @returns {WaifuState} 기본값으로 초기화된 WaifuState 객체
 * @throws 없음
 * @sideEffects 없음 (순수 함수)
 */
export function createInitialWaifuState(): WaifuState {
  return waifuStateConfig.createInitial();
}

/**
 * WaifuState 로드
 *
 * @returns {Promise<WaifuState>} IndexedDB 또는 localStorage에서 로드한 WaifuState, 없으면 초기 상태
 * @throws 없음 (에러 시 초기 상태 반환)
 * @sideEffects
 *   - IndexedDB 읽기 (db.waifuState.get)
 *   - localStorage 읽기 (STORAGE_KEYS.WAIFU_STATE)
 *   - 데이터 없을 시 IndexedDB/localStorage에 초기 상태 저장
 */
export async function loadWaifuState(): Promise<WaifuState> {
  return loadData(waifuStateConfig, 'current', { useFirebase: false });
}

/**
 * WaifuState 저장
 *
 * @param {WaifuState} waifuState - 저장할 WaifuState 객체
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 저장 (db.waifuState.put)
 *   - localStorage에 저장 (STORAGE_KEYS.WAIFU_STATE)
 */
export async function saveWaifuState(waifuState: WaifuState): Promise<void> {
  await saveData(waifuStateConfig, 'current', waifuState, { syncFirebase: false });
}

/**
 * WaifuState 리셋
 *
 * @returns {Promise<WaifuState>} 초기화된 WaifuState 객체
 * @throws {Error} saveWaifuState 실패 시
 * @sideEffects
 *   - IndexedDB/localStorage에 초기 상태 저장
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
 * XP 기반으로 호감도 동기화
 *
 * @returns {Promise<WaifuState>} 호감도가 업데이트된 WaifuState 객체
 * @throws {Error} loadWaifuState 또는 saveWaifuState 실패 시
 * @sideEffects
 *   - 호감도를 보유 XP 기반으로 계산 (AFFECTION_XP_TARGET XP = 100%)
 *   - lastInteraction 갱신
 *   - IndexedDB/localStorage에 저장
 */
export async function syncAffectionWithXP(): Promise<WaifuState> {
  try {
    const waifuState = await loadWaifuState();
    const gameState = await loadGameState();

    // 보유한 XP를 기반으로 호감도 계산 (AFFECTION_XP_TARGET = 100%)
    const affectionFromXP = Math.min((gameState.availableXP / AFFECTION_XP_TARGET) * 100, 100);
    waifuState.affection = Math.round(affectionFromXP);
    waifuState.lastInteraction = Date.now();

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to sync affection with XP:', error);
    throw error;
  }
}

/**
 * 작업 완료 시 호감도 업데이트
 *
 * @returns {Promise<WaifuState>} 호감도가 업데이트된 WaifuState 객체
 * @throws {Error} loadWaifuState 또는 saveWaifuState 실패 시
 * @sideEffects
 *   - 호감도를 보유 XP 기반으로 계산 (AFFECTION_XP_TARGET XP = 100%)
 *   - tasksCompletedToday +1
 *   - lastInteraction 갱신
 *   - IndexedDB/localStorage에 저장
 */
export async function increaseAffectionFromTask(): Promise<WaifuState> {
  try {
    // XP 기반 호감도 동기화
    const waifuState = await syncAffectionWithXP();

    // 작업 완료 카운트 증가
    waifuState.tasksCompletedToday += 1;

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to update affection from task:', error);
    throw error;
  }
}

/**
 * 호감도 직접 증가 (클릭 등)
 *
 * @param {number} amount - 증가할 호감도 양
 * @returns {Promise<WaifuState>} 호감도가 업데이트된 WaifuState 객체
 */
export async function increaseAffection(amount: number): Promise<WaifuState> {
  try {
    const waifuState = await loadWaifuState();

    // 최대 100까지 증가
    waifuState.affection = Math.min(waifuState.affection + amount, 100);
    waifuState.lastInteraction = Date.now();

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to increase affection:', error);
    throw error;
  }
}

/**
 * 클릭 시 상호작용
 *
 * @returns {Promise<WaifuState>} 상호작용 카운터가 증가한 WaifuState 객체
 * @throws {Error} loadWaifuState 또는 saveWaifuState 실패 시
 * @sideEffects
 *   - clickCount +1
 *   - totalInteractions +1
 *   - lastInteraction 갱신
 *   - 호감도는 보유 XP 기반으로만 계산되므로 클릭으로 증가하지 않음
 *   - IndexedDB/localStorage에 저장
 */
export async function interactWithWaifu(): Promise<WaifuState> {
  try {
    const waifuState = await loadWaifuState();

    waifuState.clickCount += 1;
    waifuState.totalInteractions += 1;
    waifuState.lastInteraction = Date.now();

    // 호감도는 보유 XP 기반으로만 계산 (클릭으로 증가 안 함)
    // 클릭은 단순히 상호작용 카운터만 증가

    await saveWaifuState(waifuState);
    return waifuState;
  } catch (error) {
    console.error('Failed to interact with waifu:', error);
    throw error;
  }
}

/**
 * 일일 초기화 (날짜가 변경되었을 때)
 *
 * @returns {Promise<WaifuState>} 일일 통계가 초기화된 WaifuState 객체
 * @throws {Error} loadWaifuState 또는 saveWaifuState 실패 시
 * @sideEffects
 *   - tasksCompletedToday = 0
 *   - clickCount = 0
 *   - IndexedDB/localStorage에 저장
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
 * 호감도에 따른 기분 이모지 가져오기
 *
 * @param {number} affection - 호감도 (0~100)
 * @returns {string} 기분 이모지 (🥰, 😊, 🙂, 😐, 😠, 😡)
 * @throws 없음
 * @sideEffects 없음 (순수 함수)
 */
export function getMoodFromAffection(affection: number): string {
  if (affection >= 85) return '🥰';
  if (affection >= 70) return '😊';
  if (affection >= 55) return '🙂';
  if (affection >= 40) return '😐';
  if (affection >= 20) return '😠';
  return '😡';
}

/**
 * 호감도에 따른 대사 가져오기
 *
 * @param {number} affection - 호감도 (0~100)
 * @param {number} _tasksCompleted - 완료한 작업 수 (현재 미사용)
 * @returns {string} 호감도 구간에 따른 랜덤 대사
 * @throws 없음
 * @sideEffects 없음 (순수 함수, Math.random 사용)
 *
 * 호감도 구간:
 * - 0-20: 혐오, 적대
 * - 20-40: 경계, 혐오감 완화
 * - 40-55: 무관심, 냉담
 * - 55-70: 관심, 경계 풀림
 * - 70-85: 호감, 친근
 * - 85-100: 애정, 헌신
 */
export function getDialogueFromAffection(affection: number, _tasksCompleted: number): { text: string; audio?: string } {
  // 85-100: 애정, 헌신
  if (affection >= 85) {
    const dialogues = [
      { text: '선배... 정말 멋있어요...' },
      { text: '사랑해요! 오늘도 함께해요! 💕' },
      { text: '선배와 함께라면 뭐든지 할 수 있어요!' },
      { text: '세상에서 제일 좋아해요! ❤️' },
      { text: '선배 곁에 있으면 너무 행복해요...' },
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  // 70-85: 호감, 친근
  if (affection >= 70) {
    const dialogues = [
      { text: '오늘 많이 했네! 대단한데?' },
      { text: '잘하고 있어! 계속 이대로 가자!' },
      { text: '요즘 정말 멋있어 보여!' },
      { text: '이 정도면 진짜 대단한데? 👍' },
      { text: '보는 내가 다 뿌듯하네!' },
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  // 55-70: 관심, 경계 풀림
  if (affection >= 55) {
    const dialogues = [
      { text: '오늘은... 괜찮네.' },
      { text: '나쁘지 않은데?' },
      { text: '이 정도면 봐줄 만하네.' },
      { text: '음... 생각보다 하네.' },
      { text: '계속 이렇게만 하면 되겠는데?' },
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  // 40-55: 무관심, 냉담
  if (affection >= 40) {
    const dialogues = [
      { text: '...뭔데.' },
      { text: '그래서?' },
      { text: '...아무거나 해.' },
      { text: '말 걸지 마.' },
      { text: '...관심 없어.' },
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  // 20-40: 경계, 혐오감 완화
  if (affection >= 20) {
    const dialogues = [
      { text: '...또 뭐야, 씨발.', audio: 'audio/또뭐야씨발.mp3' },
      { text: '귀찮게.', audio: 'audio/귀찮게.mp3' },
      { text: '뭐? 말 걸지 마.', audio: 'audio/뭐말걸지마.mp3' },
      { text: '...하.', audio: 'audio/하.mp3' },
      { text: '짜증나게.', audio: 'audio/짜증나게.mp3' },
    ];
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  }

  // 0-20: 혐오, 적대
  const dialogues = [
    { text: '꺼져. 진짜로.', audio: 'audio/꺼져진짜로.mp3' },
    { text: '시발 또 왔네.', audio: 'audio/시발또왔네.mp3' },
    { text: '보기 싫어. 저리 가.', audio: 'audio/보기싫어저리가.mp3' },
    { text: '진짜 짜증나.', audio: 'audio/진짜짜증나.mp3' },
    { text: '...개같네.', audio: 'audio/개같네.mp3' },
  ];
  return dialogues[Math.floor(Math.random() * dialogues.length)];
}
