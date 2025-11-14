/**
 * Firebase 실시간 동기화 서비스
 * 다중 장치 간 데이터 동기화 및 충돌 해결
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  onValue,
  off,
  serverTimestamp,
  Database,
  update,
  get,
} from 'firebase/database';
import type { DailyData, GameState, Settings } from '../types/domain';
import { getLocalDate } from '../lib/utils';
import { addSyncLog } from './syncLogger';

let firebaseApp: FirebaseApp | null = null;
let firebaseDatabase: Database | null = null;
let isInitialized = false;

// ============================================================================
// Firebase 초기화
// ============================================================================

/**
 * Firebase 앱 초기화
 */
export function initializeFirebase(config: Settings['firebaseConfig']): boolean {
  if (!config) {
    console.warn('Firebase config is not provided');
    return false;
  }

  try {
    // 이미 초기화되어 있으면 재초기화
    if (firebaseApp) {
      console.log('Firebase already initialized, reinitializing...');
    }

    // Firebase 앱 초기화 (8개 필수 변수)
    firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      databaseURL: config.databaseURL,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });

    firebaseDatabase = getDatabase(firebaseApp);
    isInitialized = true;

    addSyncLog('firebase', 'sync', 'Firebase initialized successfully');
    console.log('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    addSyncLog('firebase', 'error', 'Failed to initialize Firebase', undefined, error as Error);
    isInitialized = false;
    return false;
  }
}

/**
 * Firebase 초기화 상태 확인
 */
export function isFirebaseInitialized(): boolean {
  return isInitialized && firebaseDatabase !== null;
}

/**
 * Firebase 연결 해제
 */
export function disconnectFirebase(): void {
  if (firebaseDatabase) {
    // 모든 리스너 제거
    const dbRef = ref(firebaseDatabase);
    off(dbRef);

    firebaseDatabase = null;
    firebaseApp = null;
    isInitialized = false;

    console.log('Firebase disconnected');
  }
}

// ============================================================================
// 데이터 동기화
// ============================================================================

interface SyncData<T> {
  data: T;
  updatedAt: number;
  deviceId: string;
}

/**
 * 디바이스 ID 생성 (브라우저별 고유 ID)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * 충돌 해결: Last-Write-Wins 전략
 * 최신 타임스탬프를 가진 데이터를 우선
 */
function resolveConflict<T>(
  localData: SyncData<T>,
  remoteData: SyncData<T>
): SyncData<T> {
  console.log('Conflict detected, resolving...');
  console.log('Local timestamp:', localData.updatedAt);
  console.log('Remote timestamp:', remoteData.updatedAt);

  // 타임스탬프가 더 최신인 것을 선택
  if (remoteData.updatedAt > localData.updatedAt) {
    console.log('Remote data is newer, using remote');
    return remoteData;
  } else if (localData.updatedAt > remoteData.updatedAt) {
    console.log('Local data is newer, keeping local');
    return localData;
  } else {
    // 타임스탬프가 같으면 디바이스 ID로 결정 (알파벳순)
    console.log('Same timestamp, using device ID as tiebreaker');
    return localData.deviceId > remoteData.deviceId ? localData : remoteData;
  }
}

/**
 * DailyData를 Firebase에 동기화
 */
export async function syncDailyDataToFirebase(
  date: string,
  dailyData: DailyData
): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  try {
    const userId = 'user'; // TODO: 실제 사용자 인증 구현 시 userId 사용
    const deviceId = getDeviceId();
    const dataRef = ref(firebaseDatabase, `users/${userId}/dailyData/${date}`);

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<DailyData> | null;

    const localSyncData: SyncData<DailyData> = {
      data: dailyData,
      updatedAt: Date.now(),
      deviceId,
    };

    // 충돌 확인 및 해결
    if (remoteData && remoteData.updatedAt > dailyData.updatedAt) {
      const resolved = resolveConflict(localSyncData, remoteData);

      if (resolved.deviceId !== deviceId) {
        console.log('Remote data is newer, skipping upload');
        return;
      }
    }

    // Firebase에 업로드
    await set(dataRef, localSyncData);
    addSyncLog('firebase', 'sync', `DailyData synced to Firebase: ${date}`, { taskCount: dailyData.tasks.length });
    console.log(`✅ DailyData synced to Firebase: ${date}`);
  } catch (error) {
    console.error('Failed to sync DailyData to Firebase:', error);
    addSyncLog('firebase', 'error', `Failed to sync DailyData for ${date}`, undefined, error as Error);
    throw error;
  }
}

/**
 * Firebase에서 DailyData 실시간 리스닝
 */
export function listenToDailyDataFromFirebase(
  date: string,
  onUpdate: (dailyData: DailyData) => void
): () => void {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  const userId = 'user';
  const dataRef = ref(firebaseDatabase, `users/${userId}/dailyData/${date}`);
  const deviceId = getDeviceId();

  const unsubscribe = onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const syncData = snapshot.val() as SyncData<DailyData>;

      // 자신의 디바이스에서 업로드한 데이터는 무시
      if (syncData.deviceId === deviceId) {
        return;
      }

      addSyncLog('firebase', 'sync', `Received DailyData update from Firebase for ${date}`);
      console.log('📥 Received DailyData update from Firebase');
      onUpdate(syncData.data);
    }
  });

  return () => off(dataRef);
}

/**
 * GameState를 Firebase에 동기화
 */
export async function syncGameStateToFirebase(gameState: GameState): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  try {
    const userId = 'user';
    const deviceId = getDeviceId();
    const dataRef = ref(firebaseDatabase, `users/${userId}/gameState`);

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<GameState> | null;

    const localSyncData: SyncData<GameState> = {
      data: gameState,
      updatedAt: Date.now(),
      deviceId,
    };

    // 충돌 확인 및 해결
    if (remoteData) {
      const resolved = resolveConflict(localSyncData, remoteData);

      if (resolved.deviceId !== deviceId) {
        console.log('Remote GameState is newer, skipping upload');
        return;
      }
    }

    // Firebase에 업로드
    await set(dataRef, localSyncData);
    addSyncLog('firebase', 'sync', 'GameState synced to Firebase', { level: gameState.level });
    console.log('✅ GameState synced to Firebase');
  } catch (error) {
    console.error('Failed to sync GameState to Firebase:', error);
    addSyncLog('firebase', 'error', 'Failed to sync GameState', undefined, error as Error);
    throw error;
  }
}

/**
 * Firebase에서 GameState 실시간 리스닝
 */
export function listenToGameStateFromFirebase(
  onUpdate: (gameState: GameState) => void
): () => void {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  const userId = 'user';
  const dataRef = ref(firebaseDatabase, `users/${userId}/gameState`);
  const deviceId = getDeviceId();

  const unsubscribe = onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const syncData = snapshot.val() as SyncData<GameState>;

      // 자신의 디바이스에서 업로드한 데이터는 무시
      if (syncData.deviceId === deviceId) {
        return;
      }

      console.log('📥 Received GameState update from Firebase');
      onUpdate(syncData.data);
    }
  });

  return () => off(dataRef);
}

/**
 * 전체 데이터 Firebase에서 가져오기 (초기 로드용)
 */
export async function fetchDataFromFirebase(): Promise<{
  dailyData: Record<string, DailyData>;
  gameState: GameState | null;
}> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  try {
    const userId = 'user';

    // DailyData 가져오기
    const dailyDataRef = ref(firebaseDatabase, `users/${userId}/dailyData`);
    const dailyDataSnapshot = await get(dailyDataRef);
    const dailyDataRaw = dailyDataSnapshot.val() || {};

    const dailyData: Record<string, DailyData> = {};
    for (const [date, syncData] of Object.entries(dailyDataRaw as Record<string, SyncData<DailyData>>)) {
      dailyData[date] = syncData.data;
    }

    // GameState 가져오기
    const gameStateRef = ref(firebaseDatabase, `users/${userId}/gameState`);
    const gameStateSnapshot = await get(gameStateRef);
    const gameStateRaw = gameStateSnapshot.val() as SyncData<GameState> | null;
    const gameState = gameStateRaw ? gameStateRaw.data : null;

    console.log('✅ Data fetched from Firebase');
    return { dailyData, gameState };
  } catch (error) {
    console.error('Failed to fetch data from Firebase:', error);
    throw error;
  }
}

/**
 * Firebase 동기화 활성화
 */
export function enableFirebaseSync(
  onDailyDataUpdate: (date: string, data: DailyData) => void,
  onGameStateUpdate: (data: GameState) => void
): () => void {
  if (!isFirebaseInitialized()) {
    throw new Error('Firebase is not initialized');
  }

  const today = getLocalDate();
  const unsubscribers: Array<() => void> = [];

  // 오늘 DailyData 리스닝
  unsubscribers.push(
    listenToDailyDataFromFirebase(today, (data) => onDailyDataUpdate(today, data))
  );

  // GameState 리스닝
  unsubscribers.push(
    listenToGameStateFromFirebase(onGameStateUpdate)
  );

  console.log('✅ Firebase sync enabled');

  // 모든 리스너 해제 함수 반환
  return () => {
    unsubscribers.forEach((unsub) => unsub());
    console.log('Firebase sync disabled');
  };
}
