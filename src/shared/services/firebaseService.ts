/**
 * Firebase Synchronization Service - Facade
 *
 * @role Firebase 동기화 기능에 대한 하위 호환성 인터페이스를 제공합니다.
 *       레거시 코드를 위한 Facade 패턴으로, 실제 구현은 firebase/ 디렉토리 모듈에 위임합니다.
 * @input DailyData, GameState, ChatHistory, DailyTokenUsage, 날짜 키
 * @output Promise<void> (동기화 완료), 구독 해제 함수, Firebase 데이터 객체
 * @external_dependencies
 *   - firebase/database: Firebase Realtime Database SDK
 *   - ./firebase/syncCore: 제네릭 동기화 코어 로직
 *   - ./firebase/strategies: 데이터 타입별 동기화 전략
 *   - ./firebase/firebaseClient: Firebase 클라이언트 관리
 */

// ============================================================================
// Re-export from new modules
// ============================================================================

export {
  initializeFirebase,
  isFirebaseInitialized,
  disconnectFirebase,
} from './firebase/firebaseClient';

export { debugFirebaseData } from './firebase/firebaseDebug';

export type { SyncData } from './firebase/conflictResolver';

// ============================================================================
// Import dependencies for legacy functions
// ============================================================================

import { syncToFirebase, listenToFirebase, fetchFromFirebase } from './firebase/syncCore';
import {
  dailyDataStrategy,
  gameStateStrategy,
  chatHistoryStrategy,
  tokenUsageStrategy,
} from './firebase/strategies';
import type { DailyData, GameState, ChatHistory, DailyTokenUsage } from '@/shared/types/domain';

// ============================================================================
// Legacy Function Wrappers - 하위 호환성 유지
// ============================================================================

/**
 * DailyData를 Firebase에 동기화합니다.
 *
 * @deprecated 새 코드에서는 syncToFirebase(dailyDataStrategy, data, key) 사용 권장
 * @param {string} date - 날짜 키 (YYYY-MM-DD 형식)
 * @param {DailyData} dailyData - 동기화할 일일 데이터
 * @returns {Promise<void>} 동기화 완료 Promise
 * @throws {Error} Firebase 초기화 실패 또는 네트워크 오류
 * @sideEffects
 *   - Firebase Realtime Database에 데이터 저장
 *   - syncLogger에 동기화 로그 추가
 */
export async function syncDailyDataToFirebase(
  date: string,
  dailyData: DailyData
): Promise<void> {
  await syncToFirebase(dailyDataStrategy, dailyData, date);
}

/**
 * Firebase에서 DailyData 실시간 리스닝을 시작합니다.
 *
 * @deprecated 새 코드에서는 listenToFirebase(dailyDataStrategy, onUpdate, key) 사용 권장
 * @param {string} date - 날짜 키 (YYYY-MM-DD 형식)
 * @param {Function} onUpdate - 데이터 업데이트 시 호출될 콜백
 * @returns {Function} 리스닝 해제 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 등록
 *   - 다른 디바이스에서 업데이트 시 onUpdate 콜백 실행
 */
export function listenToDailyDataFromFirebase(
  date: string,
  onUpdate: (dailyData: DailyData) => void
): () => void {
  return listenToFirebase(dailyDataStrategy, onUpdate, date);
}

/**
 * GameState를 Firebase에 동기화합니다 (Delta-based Merge 전략 사용).
 *
 * @deprecated 새 코드에서는 syncToFirebase(gameStateStrategy, data) 사용 권장
 * @param {GameState} gameState - 동기화할 게임 상태
 * @returns {Promise<void>} 동기화 완료 Promise
 * @throws {Error} Firebase 초기화 실패 또는 네트워크 오류
 * @sideEffects
 *   - Firebase Realtime Database에 데이터 저장 (충돌 시 병합)
 *   - syncLogger에 동기화 로그 추가
 */
export async function syncGameStateToFirebase(gameState: GameState): Promise<void> {
  // GameState는 key 없이 root에 저장
  await syncToFirebase(gameStateStrategy, gameState);
}

/**
 * Firebase에서 GameState 실시간 리스닝을 시작합니다.
 *
 * @deprecated 새 코드에서는 listenToFirebase(gameStateStrategy, onUpdate) 사용 권장
 * @param {Function} onUpdate - 게임 상태 업데이트 시 호출될 콜백
 * @returns {Function} 리스닝 해제 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 등록
 *   - 다른 디바이스에서 업데이트 시 onUpdate 콜백 실행
 */
export function listenToGameStateFromFirebase(
  onUpdate: (gameState: GameState) => void
): () => void {
  return listenToFirebase(gameStateStrategy, onUpdate);
}

/**
 * ChatHistory를 Firebase에 동기화합니다.
 *
 * @deprecated 새 코드에서는 syncToFirebase(chatHistoryStrategy, data, key) 사용 권장
 * @param {string} date - 날짜 키 (YYYY-MM-DD 형식)
 * @param {ChatHistory} chatHistory - 동기화할 채팅 히스토리
 * @returns {Promise<void>} 동기화 완료 Promise
 * @throws {Error} Firebase 초기화 실패 또는 네트워크 오류
 * @sideEffects
 *   - Firebase Realtime Database에 데이터 저장
 *   - syncLogger에 동기화 로그 추가
 */
export async function syncChatHistoryToFirebase(
  date: string,
  chatHistory: ChatHistory
): Promise<void> {
  await syncToFirebase(chatHistoryStrategy, chatHistory, date);
}

/**
 * Firebase에서 ChatHistory 실시간 리스닝을 시작합니다.
 *
 * @deprecated 새 코드에서는 listenToFirebase(chatHistoryStrategy, onUpdate, key) 사용 권장
 * @param {string} date - 날짜 키 (YYYY-MM-DD 형식)
 * @param {Function} onUpdate - 채팅 히스토리 업데이트 시 호출될 콜백
 * @returns {Function} 리스닝 해제 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 등록
 *   - 다른 디바이스에서 업데이트 시 onUpdate 콜백 실행
 */
export function listenToChatHistoryFromFirebase(
  date: string,
  onUpdate: (chatHistory: ChatHistory) => void
): () => void {
  return listenToFirebase(chatHistoryStrategy, onUpdate, date);
}

/**
 * DailyTokenUsage를 Firebase에 동기화합니다.
 *
 * @deprecated 새 코드에서는 syncToFirebase(tokenUsageStrategy, data, key) 사용 권장
 * @param {string} date - 날짜 키 (YYYY-MM-DD 형식)
 * @param {DailyTokenUsage} tokenUsage - 동기화할 토큰 사용량 데이터
 * @returns {Promise<void>} 동기화 완료 Promise
 * @throws {Error} Firebase 초기화 실패 또는 네트워크 오류
 * @sideEffects
 *   - Firebase Realtime Database에 데이터 저장
 *   - syncLogger에 동기화 로그 추가
 */
export async function syncTokenUsageToFirebase(
  date: string,
  tokenUsage: DailyTokenUsage
): Promise<void> {
  await syncToFirebase(tokenUsageStrategy, tokenUsage, date);
}

/**
 * Firebase에서 TokenUsage 실시간 리스닝을 시작합니다.
 *
 * @deprecated 새 코드에서는 listenToFirebase(tokenUsageStrategy, onUpdate, key) 사용 권장
 * @param {string} date - 날짜 키 (YYYY-MM-DD 형식)
 * @param {Function} onUpdate - 토큰 사용량 업데이트 시 호출될 콜백
 * @returns {Function} 리스닝 해제 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 등록
 *   - 다른 디바이스에서 업데이트 시 onUpdate 콜백 실행
 */
export function listenToTokenUsageFromFirebase(
  date: string,
  onUpdate: (tokenUsage: DailyTokenUsage) => void
): () => void {
  return listenToFirebase(tokenUsageStrategy, onUpdate, date);
}

/**
 * Firebase에서 전체 데이터를 가져옵니다 (초기 로드용).
 *
 * @returns {Promise<{dailyData: Record<string, DailyData>; gameState: GameState | null}>}
 *          모든 DailyData와 GameState 객체
 * @throws {Error} Firebase 초기화 실패 또는 데이터 읽기 오류
 * @sideEffects
 *   - Firebase Database에서 데이터 읽기
 *   - 콘솔에 성공/실패 로그 출력
 */
export async function fetchDataFromFirebase(): Promise<{
  dailyData: Record<string, DailyData>;
  gameState: GameState | null;
}> {
  try {
    const { getFirebaseDatabase } = await import('./firebase/firebaseClient');
    const { ref, get } = await import('firebase/database');

    const db = getFirebaseDatabase();
    const userId = 'user';

    // DailyData 가져오기
    const dailyDataRef = ref(db, `users/${userId}/dailyData`);
    const dailyDataSnapshot = await get(dailyDataRef);
    const dailyDataValue = dailyDataSnapshot.val() || {};

    // GameState 가져오기
    const gameStateRef = ref(db, `users/${userId}/gameState`);
    const gameStateSnapshot = await get(gameStateRef);
    const gameStateValue = gameStateSnapshot.val();

    // SyncData 래퍼 제거하고 실제 데이터만 반환
    const dailyData: Record<string, DailyData> = {};
    Object.entries(dailyDataValue).forEach(([date, syncData]: [string, any]) => {
      if (syncData && syncData.data) {
        dailyData[date] = syncData.data;
      }
    });

    const gameState = gameStateValue ? gameStateValue.data : null;

    return { dailyData, gameState };
  } catch (error) {
    console.error('Failed to fetch data from Firebase:', error);
    throw error;
  }
}

/**
 * Firebase 실시간 동기화를 활성화합니다.
 * DailyData 컬렉션과 GameState를 실시간으로 감시합니다.
 *
 * @param {Function} onDailyDataUpdate - DailyData 업데이트 시 호출될 콜백 (날짜 키 전달)
 * @param {Function} onGameStateUpdate - GameState 업데이트 시 호출될 콜백
 * @returns {Function} 모든 리스너를 해제하는 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 2개 등록 (dailyData, gameState)
 *   - 다른 디바이스에서 변경 시 콜백 실행
 *   - 콘솔에 활성화 로그 출력
 */
export function enableFirebaseSync(
  onDailyDataUpdate: (date: string) => void,
  onGameStateUpdate: () => void
): () => void {
  // DailyData 전체 컬렉션 리스닝
  const { getFirebaseDatabase } = require('./firebase/firebaseClient');
  const { ref, onValue, off } = require('firebase/database');

  const db = getFirebaseDatabase();
  const userId = 'user';
  const { getDeviceId } = require('./firebase/syncUtils');
  const deviceId = getDeviceId();

  const dailyDataRef = ref(db, `users/${userId}/dailyData`);
  const gameStateRef = ref(db, `users/${userId}/gameState`);

  onValue(dailyDataRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((date) => {
        const syncData = data[date];
        if (syncData && syncData.deviceId !== deviceId) {
          onDailyDataUpdate(date);
        }
      });
    }
  });

  onValue(gameStateRef, (snapshot) => {
    const syncData = snapshot.val();
    if (syncData && syncData.deviceId !== deviceId) {
      onGameStateUpdate();
    }
  });


  return () => {
    off(dailyDataRef);
    off(gameStateRef);
  };
}
