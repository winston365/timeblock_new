/**
 * Firebase 실시간 동기화 서비스
 * 다중 장치 간 데이터 동기화 및 충돌 해결
 */

import { initializeApp, FirebaseApp, deleteApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  onValue,
  off,
  Database,
  get,
} from 'firebase/database';
import type { DailyData, GameState, Settings, ChatHistory, DailyTokenUsage } from '../types/domain';
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
    // 이미 초기화되어 있으면 기존 앱 삭제 후 재초기화
    if (firebaseApp) {
      console.log('Firebase already initialized, deleting old instance...');
      try {
        deleteApp(firebaseApp).catch(err => console.warn('Failed to delete old Firebase app:', err));
      } catch (e) {
        console.warn('Error during Firebase app deletion:', e);
      }
      firebaseApp = null;
      firebaseDatabase = null;
      isInitialized = false;
    }

    // Firebase 앱 초기화 (7개 필수 변수 + measurementId는 선택)
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

// 마지막 동기화 해시 (중복 방지)
const lastSyncHash: Record<string, string> = {};

/**
 * 데이터의 해시 생성 (간단한 JSON 기반)
 */
function getDataHash(data: unknown): string {
  return JSON.stringify(data);
}

/**
 * 서버 타임스탬프 생성 (Firebase serverTimestamp 사용)
 * 실제 저장 시에는 Firebase가 서버 시간으로 변환
 */
function getServerTimestamp(): number {
  // Firebase에 저장할 때는 serverTimestamp()를 사용하지만
  // 클라이언트에서 비교용으로는 Date.now() 사용
  return Date.now();
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
 * 충돌 해결: Last-Write-Wins 전략 (DailyData용)
 * 최신 타임스탬프를 가진 데이터를 우선
 */
function resolveConflictLWW<T>(
  localData: SyncData<T>,
  remoteData: SyncData<T>
): SyncData<T> {
  console.log('[LWW] Conflict detected, resolving...');
  console.log('[LWW] Local timestamp:', localData.updatedAt);
  console.log('[LWW] Remote timestamp:', remoteData.updatedAt);

  // 타임스탬프가 더 최신인 것을 선택
  if (remoteData.updatedAt > localData.updatedAt) {
    console.log('[LWW] Remote data is newer, using remote');
    return remoteData;
  } else if (localData.updatedAt > remoteData.updatedAt) {
    console.log('[LWW] Local data is newer, keeping local');
    return localData;
  } else {
    // 타임스탬프가 같으면 디바이스 ID로 결정 (알파벳순)
    console.log('[LWW] Same timestamp, using device ID as tiebreaker');
    return localData.deviceId > remoteData.deviceId ? localData : remoteData;
  }
}

/**
 * GameState 병합: Delta-based Merge 전략
 * totalXP, dailyXP, availableXP는 누적(additive)
 * dailyQuests는 progress 최대값 사용
 * 다른 필드는 최신값 사용
 */
function mergeGameState(
  localData: SyncData<GameState>,
  remoteData: SyncData<GameState>
): SyncData<GameState> {
  console.log('[Delta Merge] Merging GameState...');
  console.log('[Delta Merge] Local timestamp:', localData.updatedAt);
  console.log('[Delta Merge] Remote timestamp:', remoteData.updatedAt);

  const local = localData.data;
  const remote = remoteData.data;

  // 누적 필드: 두 값의 최대값 사용 (XP는 항상 증가)
  const mergedTotalXP = Math.max(local.totalXP, remote.totalXP);
  const mergedDailyXP = Math.max(local.dailyXP, remote.dailyXP);
  const mergedAvailableXP = Math.max(local.availableXP, remote.availableXP);
  const mergedLevel = Math.max(local.level, remote.level);

  // dailyQuests 병합: 각 퀘스트별로 progress 최대값 사용
  // dailyQuests가 배열이 아니면 빈 배열로 초기화
  const localQuests = Array.isArray(local.dailyQuests) ? local.dailyQuests : [];
  const remoteQuests = Array.isArray(remote.dailyQuests) ? remote.dailyQuests : [];

  const mergedQuests = [...localQuests];
  for (const remoteQuest of remoteQuests) {
    const localQuestIndex = mergedQuests.findIndex(q => q.id === remoteQuest.id);
    if (localQuestIndex >= 0) {
      // 같은 퀘스트가 있으면 progress 최대값 사용
      mergedQuests[localQuestIndex] = {
        ...mergedQuests[localQuestIndex],
        progress: Math.max(mergedQuests[localQuestIndex].progress, remoteQuest.progress),
        completed: mergedQuests[localQuestIndex].completed || remoteQuest.completed,
      };
    } else {
      // 없으면 추가
      mergedQuests.push(remoteQuest);
    }
  }

  // 나머지 필드는 최신 타임스탬프 기준으로 선택
  const useLocal = localData.updatedAt >= remoteData.updatedAt;
  const newerData = useLocal ? local : remote;

  const mergedGameState: GameState = {
    ...newerData,
    totalXP: mergedTotalXP,
    dailyXP: mergedDailyXP,
    availableXP: mergedAvailableXP,
    level: mergedLevel,
    dailyQuests: mergedQuests,
  };

  console.log('[Delta Merge] TotalXP:', local.totalXP, '/', remote.totalXP, '→', mergedTotalXP);
  console.log('[Delta Merge] DailyXP:', local.dailyXP, '/', remote.dailyXP, '→', mergedDailyXP);

  return {
    data: mergedGameState,
    updatedAt: Math.max(localData.updatedAt, remoteData.updatedAt),
    deviceId: useLocal ? localData.deviceId : remoteData.deviceId,
  };
}

/**
 * DailyData를 Firebase에 동기화
 */
export async function syncDailyDataToFirebase(
  date: string,
  dailyData: DailyData
): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    console.warn('Firebase is not initialized, skipping sync');
    return;
  }

  try {
    const userId = 'user'; // TODO: 실제 사용자 인증 구현 시 userId 사용
    const deviceId = getDeviceId();
    const dataRef = ref(firebaseDatabase, `users/${userId}/dailyData/${date}`);

    // 중복 동기화 방지
    const dataHash = getDataHash(dailyData);
    const hashKey = `dailyData-${date}`;
    if (lastSyncHash[hashKey] === dataHash) {
      console.log(`[Sync Skip] DailyData for ${date} unchanged, skipping Firebase sync`);
      return;
    }

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<DailyData> | null;

    const localSyncData: SyncData<DailyData> = {
      data: dailyData,
      updatedAt: getServerTimestamp(),
      deviceId,
    };

    // 충돌 확인 및 해결 (LWW 전략)
    if (remoteData) {
      const resolved = resolveConflictLWW(localSyncData, remoteData);

      if (resolved.deviceId !== deviceId) {
        console.log('[Sync Skip] Remote DailyData is newer, skipping upload');
        addSyncLog('firebase', 'sync', `DailyData sync skipped (remote newer): ${date}`);
        return;
      }
    }

    // Firebase에 업로드
    await set(dataRef, localSyncData);
    lastSyncHash[hashKey] = dataHash;

    addSyncLog('firebase', 'sync', `DailyData synced to Firebase: ${date}`, {
      taskCount: dailyData.tasks.length,
      completedTasks: dailyData.tasks.filter(t => t.completed).length
    });
    console.log(`✅ DailyData synced to Firebase: ${date} (${dailyData.tasks.length} tasks)`);
    console.log(`📍 Firebase path: users/${userId}/dailyData/${date}`);
  } catch (error) {
    console.error('Failed to sync DailyData to Firebase:', error);
    addSyncLog('firebase', 'error', `Failed to sync DailyData for ${date}`, undefined, error as Error);
    // 에러 발생해도 throw하지 않음 (로컬은 정상 작동)
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

  onValue(dataRef, (snapshot) => {
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
 * GameState를 Firebase에 동기화 (Delta-based Merge)
 */
export async function syncGameStateToFirebase(gameState: GameState): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    console.warn('Firebase is not initialized, skipping sync');
    return;
  }

  try {
    const userId = 'user';
    const deviceId = getDeviceId();
    const dataRef = ref(firebaseDatabase, `users/${userId}/gameState`);

    // 중복 동기화 방지
    const dataHash = getDataHash(gameState);
    const hashKey = 'gameState';
    if (lastSyncHash[hashKey] === dataHash) {
      console.log('[Sync Skip] GameState unchanged, skipping Firebase sync');
      return;
    }

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<GameState> | null;

    const localSyncData: SyncData<GameState> = {
      data: gameState,
      updatedAt: getServerTimestamp(),
      deviceId,
    };

    // 충돌 확인 및 병합 (Delta-based Merge)
    let dataToUpload = localSyncData;
    if (remoteData) {
      dataToUpload = mergeGameState(localSyncData, remoteData);
      addSyncLog('firebase', 'sync', 'GameState merged with remote', {
        localTotalXP: gameState.totalXP,
        remoteTotalXP: remoteData.data.totalXP,
        mergedTotalXP: dataToUpload.data.totalXP
      });
    }

    // Firebase에 업로드
    await set(dataRef, dataToUpload);
    lastSyncHash[hashKey] = getDataHash(dataToUpload.data);

    addSyncLog('firebase', 'sync', 'GameState synced to Firebase', {
      level: dataToUpload.data.level,
      totalXP: dataToUpload.data.totalXP,
      dailyXP: dataToUpload.data.dailyXP
    });
    console.log(`✅ GameState synced to Firebase (Level ${dataToUpload.data.level}, XP ${dataToUpload.data.totalXP})`);
    console.log(`📍 Firebase path: users/${userId}/gameState`);
  } catch (error) {
    console.error('Failed to sync GameState to Firebase:', error);
    addSyncLog('firebase', 'error', 'Failed to sync GameState', undefined, error as Error);
    // 에러 발생해도 throw하지 않음 (로컬은 정상 작동)
  }
}

/**
 * Firebase에서 GameState 실시간 리스닝 (Delta-based Merge)
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

  onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const remoteData = snapshot.val() as SyncData<GameState>;

      // 자신의 디바이스에서 업로드한 데이터는 무시
      if (remoteData.deviceId === deviceId) {
        return;
      }

      addSyncLog('firebase', 'sync', 'Received GameState update from Firebase', {
        remoteLevel: remoteData.data.level,
        remoteTotalXP: remoteData.data.totalXP
      });
      console.log('📥 Received GameState update from Firebase (Delta Merge will apply)');
      onUpdate(remoteData.data);
    }
  });

  return () => off(dataRef);
}

/**
 * Firebase 데이터 확인 (디버그용)
 * 콘솔에서 window.debugFirebase() 호출
 */
export async function debugFirebaseData(): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    console.error('❌ Firebase is not initialized');
    return;
  }

  try {
    const userId = 'user';

    // DailyData 확인
    const dailyDataRef = ref(firebaseDatabase, `users/${userId}/dailyData`);
    const dailyDataSnapshot = await get(dailyDataRef);
    const dailyDataValue = dailyDataSnapshot.val();

    // GameState 확인
    const gameStateRef = ref(firebaseDatabase, `users/${userId}/gameState`);
    const gameStateSnapshot = await get(gameStateRef);
    const gameStateValue = gameStateSnapshot.val();

    console.log('🔍 Firebase Data Debug:');
    console.log('📍 Path: users/user');
    console.log('📅 DailyData dates:', dailyDataValue ? Object.keys(dailyDataValue) : 'empty');
    console.log('🎮 GameState exists:', !!gameStateValue);

    if (dailyDataValue) {
      Object.entries(dailyDataValue).forEach(([date, data]: [string, any]) => {
        const taskCount = data?.data?.tasks?.length ?? 0;
        console.log(`  - ${date}: ${taskCount} tasks, updatedAt: ${data?.updatedAt}`);
      });
    }

    if (gameStateValue) {
      console.log('  GameState:', {
        level: gameStateValue.data?.level,
        totalXP: gameStateValue.data?.totalXP,
        dailyXP: gameStateValue.data?.dailyXP,
        updatedAt: gameStateValue.updatedAt
      });
    }

    console.log('🌐 Firebase Console: https://console.firebase.google.com/project/test1234-edcb6/database/test1234-edcb6-default-rtdb/data/users/user');
  } catch (error) {
    console.error('❌ Failed to debug Firebase data:', error);
  }
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

// ============================================================================
// Chat History & Token Usage Sync
// ============================================================================

/**
 * ChatHistory를 Firebase에 동기화
 */
export async function syncChatHistoryToFirebase(
  date: string,
  chatHistory: ChatHistory
): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    console.warn('Firebase is not initialized, skipping chat history sync');
    return;
  }

  try {
    const userId = 'user';
    const deviceId = getDeviceId();
    const dataRef = ref(firebaseDatabase, `users/${userId}/chatHistory/${date}`);

    // 중복 동기화 방지
    const dataHash = getDataHash(chatHistory);
    const hashKey = `chatHistory-${date}`;
    if (lastSyncHash[hashKey] === dataHash) {
      console.log(`[Sync Skip] ChatHistory for ${date} unchanged, skipping Firebase sync`);
      return;
    }

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<ChatHistory> | null;

    const localSyncData: SyncData<ChatHistory> = {
      data: chatHistory,
      updatedAt: getServerTimestamp(),
      deviceId,
    };

    // 충돌 확인 및 해결 (LWW 전략)
    if (remoteData) {
      const resolved = resolveConflictLWW(localSyncData, remoteData);

      if (resolved.deviceId !== deviceId) {
        console.log('[Sync Skip] Remote ChatHistory is newer, skipping upload');
        addSyncLog('firebase', 'sync', `ChatHistory sync skipped (remote newer): ${date}`);
        return;
      }
    }

    // Firebase에 업로드
    await set(dataRef, localSyncData);
    lastSyncHash[hashKey] = dataHash;

    addSyncLog('firebase', 'sync', `ChatHistory synced to Firebase: ${date}`, {
      messageCount: chatHistory.messages.length
    });
    console.log(`✅ ChatHistory synced to Firebase: ${date} (${chatHistory.messages.length} messages)`);
  } catch (error) {
    console.error('Failed to sync ChatHistory to Firebase:', error);
    addSyncLog('firebase', 'error', `Failed to sync ChatHistory for ${date}`, undefined, error as Error);
  }
}

/**
 * Firebase에서 ChatHistory 실시간 리스닝
 */
export function listenToChatHistoryFromFirebase(
  date: string,
  onUpdate: (chatHistory: ChatHistory) => void
): () => void {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  const userId = 'user';
  const dataRef = ref(firebaseDatabase, `users/${userId}/chatHistory/${date}`);
  const deviceId = getDeviceId();

  onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const syncData = snapshot.val() as SyncData<ChatHistory>;

      // 자신의 디바이스에서 업로드한 데이터는 무시
      if (syncData.deviceId === deviceId) {
        return;
      }

      addSyncLog('firebase', 'sync', `Received ChatHistory update from Firebase for ${date}`);
      console.log('📥 Received ChatHistory update from Firebase');
      onUpdate(syncData.data);
    }
  });

  return () => off(dataRef);
}

/**
 * DailyTokenUsage를 Firebase에 동기화
 */
export async function syncTokenUsageToFirebase(
  date: string,
  tokenUsage: DailyTokenUsage
): Promise<void> {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    console.warn('Firebase is not initialized, skipping token usage sync');
    return;
  }

  try {
    const userId = 'user';
    const deviceId = getDeviceId();
    const dataRef = ref(firebaseDatabase, `users/${userId}/tokenUsage/${date}`);

    // 중복 동기화 방지
    const dataHash = getDataHash(tokenUsage);
    const hashKey = `tokenUsage-${date}`;
    if (lastSyncHash[hashKey] === dataHash) {
      console.log(`[Sync Skip] TokenUsage for ${date} unchanged, skipping Firebase sync`);
      return;
    }

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<DailyTokenUsage> | null;

    const localSyncData: SyncData<DailyTokenUsage> = {
      data: tokenUsage,
      updatedAt: getServerTimestamp(),
      deviceId,
    };

    // 충돌 확인 및 해결 (LWW 전략)
    if (remoteData) {
      const resolved = resolveConflictLWW(localSyncData, remoteData);

      if (resolved.deviceId !== deviceId) {
        console.log('[Sync Skip] Remote TokenUsage is newer, skipping upload');
        addSyncLog('firebase', 'sync', `TokenUsage sync skipped (remote newer): ${date}`);
        return;
      }
    }

    // Firebase에 업로드
    await set(dataRef, localSyncData);
    lastSyncHash[hashKey] = dataHash;

    addSyncLog('firebase', 'sync', `TokenUsage synced to Firebase: ${date}`, {
      totalTokens: tokenUsage.totalTokens,
      messageCount: tokenUsage.messageCount
    });
    console.log(`✅ TokenUsage synced to Firebase: ${date} (Total: ${tokenUsage.totalTokens})`);
  } catch (error) {
    console.error('Failed to sync TokenUsage to Firebase:', error);
    addSyncLog('firebase', 'error', `Failed to sync TokenUsage for ${date}`, undefined, error as Error);
  }
}

/**
 * Firebase에서 DailyTokenUsage 실시간 리스닝
 */
export function listenToTokenUsageFromFirebase(
  date: string,
  onUpdate: (tokenUsage: DailyTokenUsage) => void
): () => void {
  if (!isFirebaseInitialized() || !firebaseDatabase) {
    throw new Error('Firebase is not initialized');
  }

  const userId = 'user';
  const dataRef = ref(firebaseDatabase, `users/${userId}/tokenUsage/${date}`);
  const deviceId = getDeviceId();

  onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const syncData = snapshot.val() as SyncData<DailyTokenUsage>;

      // 자신의 디바이스에서 업로드한 데이터는 무시
      if (syncData.deviceId === deviceId) {
        return;
      }

      addSyncLog('firebase', 'sync', `Received TokenUsage update from Firebase for ${date}`);
      console.log('📥 Received TokenUsage update from Firebase');
      onUpdate(syncData.data);
    }
  });

  return () => off(dataRef);
}
