/**
 * Firebase 동기화 서비스 - Facade
 * R7: 기존 파일을 Facade 패턴으로 전환 (하위 호환성 유지)
 *
 * 이 파일은 하위 호환성을 위한 facade입니다.
 * 실제 구현은 firebase/ 디렉토리의 모듈들에 있습니다.
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
 * DailyData를 Firebase에 동기화
 * @deprecated 새 코드에서는 syncToFirebase(dailyDataStrategy, data, key) 사용 권장
 */
export async function syncDailyDataToFirebase(
  date: string,
  dailyData: DailyData
): Promise<void> {
  await syncToFirebase(dailyDataStrategy, dailyData, date);
}

/**
 * Firebase에서 DailyData 실시간 리스닝
 * @deprecated 새 코드에서는 listenToFirebase(dailyDataStrategy, onUpdate, key) 사용 권장
 */
export function listenToDailyDataFromFirebase(
  date: string,
  onUpdate: (dailyData: DailyData) => void
): () => void {
  return listenToFirebase(dailyDataStrategy, onUpdate, date);
}

/**
 * GameState를 Firebase에 동기화 (Delta-based Merge)
 * @deprecated 새 코드에서는 syncToFirebase(gameStateStrategy, data) 사용 권장
 */
export async function syncGameStateToFirebase(gameState: GameState): Promise<void> {
  // GameState는 key 없이 root에 저장
  await syncToFirebase(gameStateStrategy, gameState);
}

/**
 * Firebase에서 GameState 실시간 리스닝
 * @deprecated 새 코드에서는 listenToFirebase(gameStateStrategy, onUpdate) 사용 권장
 */
export function listenToGameStateFromFirebase(
  onUpdate: (gameState: GameState) => void
): () => void {
  return listenToFirebase(gameStateStrategy, onUpdate);
}

/**
 * ChatHistory를 Firebase에 동기화
 * @deprecated 새 코드에서는 syncToFirebase(chatHistoryStrategy, data, key) 사용 권장
 */
export async function syncChatHistoryToFirebase(
  date: string,
  chatHistory: ChatHistory
): Promise<void> {
  await syncToFirebase(chatHistoryStrategy, chatHistory, date);
}

/**
 * Firebase에서 ChatHistory 실시간 리스닝
 * @deprecated 새 코드에서는 listenToFirebase(chatHistoryStrategy, onUpdate, key) 사용 권장
 */
export function listenToChatHistoryFromFirebase(
  date: string,
  onUpdate: (chatHistory: ChatHistory) => void
): () => void {
  return listenToFirebase(chatHistoryStrategy, onUpdate, date);
}

/**
 * DailyTokenUsage를 Firebase에 동기화
 * @deprecated 새 코드에서는 syncToFirebase(tokenUsageStrategy, data, key) 사용 권장
 */
export async function syncTokenUsageToFirebase(
  date: string,
  tokenUsage: DailyTokenUsage
): Promise<void> {
  await syncToFirebase(tokenUsageStrategy, tokenUsage, date);
}

/**
 * Firebase에서 TokenUsage 실시간 리스닝
 * @deprecated 새 코드에서는 listenToFirebase(tokenUsageStrategy, onUpdate, key) 사용 권장
 */
export function listenToTokenUsageFromFirebase(
  date: string,
  onUpdate: (tokenUsage: DailyTokenUsage) => void
): () => void {
  return listenToFirebase(tokenUsageStrategy, onUpdate, date);
}

/**
 * Firebase에서 전체 데이터 가져오기 (초기 로드용)
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

    console.log('✅ Data fetched from Firebase');
    return { dailyData, gameState };
  } catch (error) {
    console.error('Failed to fetch data from Firebase:', error);
    throw error;
  }
}

/**
 * Firebase 실시간 동기화 활성화
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

  console.log('✅ Firebase sync enabled');

  return () => {
    off(dailyDataRef);
    off(gameStateRef);
  };
}
