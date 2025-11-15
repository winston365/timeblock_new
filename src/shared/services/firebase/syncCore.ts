/**
 * 제네릭 동기화 코어
 * R8: 중복 기능 통합 - 모든 데이터 타입의 동기화 로직 일반화
 * R5: Side Effects 격리 - Firebase I/O와 Pure 로직 분리
 */

import { ref, set, get, onValue, off, type Database } from 'firebase/database';
import type { SyncData } from './conflictResolver';
import { resolveConflictLWW } from './conflictResolver';
import { getDataHash, getServerTimestamp, getDeviceId, getFirebasePath } from './syncUtils';
import { getFirebaseDatabase } from './firebaseClient';
import { addSyncLog } from '../syncLogger';

// ============================================================================
// Types
// ============================================================================

export interface SyncStrategy<T> {
  /**
   * 데이터 컬렉션 이름 (예: 'dailyData', 'gameState')
   */
  collection: string;

  /**
   * 충돌 해결 전략 (선택적, 기본: LWW)
   */
  resolveConflict?: (local: SyncData<T>, remote: SyncData<T>) => SyncData<T>;

  /**
   * 동기화 성공 시 로그 메시지 생성
   */
  getSuccessMessage?: (data: T, key?: string) => string;

  /**
   * userId 가져오기 (기본: 'user')
   */
  getUserId?: () => string;
}

// ============================================================================
// 중복 동기화 방지를 위한 해시 캐시
// ============================================================================

const lastSyncHash: Record<string, string> = {};

// ============================================================================
// Generic Sync Functions - R8: 중복 제거
// ============================================================================

/**
 * 제네릭 동기화 함수 - Firebase에 데이터 업로드
 * @template T 데이터 타입
 * @param strategy 동기화 전략
 * @param data 동기화할 데이터
 * @param key 데이터 키 (선택적, 없으면 컬렉션 전체)
 */
export async function syncToFirebase<T>(
  strategy: SyncStrategy<T>,
  data: T,
  key?: string
): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    const userId = strategy.getUserId?.() || 'user';
    const deviceId = getDeviceId();

    const path = getFirebasePath(userId, strategy.collection, key);
    const dataRef = ref(db, path);

    // 중복 동기화 방지
    const dataHash = getDataHash(data);
    const hashKey = `${strategy.collection}-${key || 'root'}`;

    if (lastSyncHash[hashKey] === dataHash) {
      console.log(`[Sync Skip] ${strategy.collection} unchanged, skipping Firebase sync`);
      return;
    }

    // 기존 데이터 확인
    const snapshot = await get(dataRef);
    const remoteData = snapshot.val() as SyncData<T> | null;

    const localSyncData: SyncData<T> = {
      data,
      updatedAt: getServerTimestamp(),
      deviceId,
    };

    // 충돌 확인 및 해결
    if (remoteData) {
      const resolveConflict = strategy.resolveConflict || resolveConflictLWW;
      const resolved = resolveConflict(localSyncData, remoteData);

      if (resolved.deviceId !== deviceId) {
        console.log(`[Sync Skip] Remote ${strategy.collection} is newer, skipping upload`);
        addSyncLog('firebase', 'sync', `${strategy.collection} sync skipped (remote newer): ${key || ''}`);
        return;
      }
    }

    // Firebase에 업로드
    await set(dataRef, localSyncData);
    lastSyncHash[hashKey] = dataHash;

    const successMessage =
      strategy.getSuccessMessage?.(data, key) ||
      `${strategy.collection} synced to Firebase: ${key || ''}`;

    addSyncLog('firebase', 'sync', successMessage);
    console.log(`✅ ${successMessage}`);
    console.log(`📍 Firebase path: ${path}`);
  } catch (error) {
    console.error(`Failed to sync ${strategy.collection} to Firebase:`, error);
    addSyncLog('firebase', 'error', `Failed to sync ${strategy.collection}`, undefined, error as Error);
    // 에러 발생해도 throw하지 않음 (로컬은 정상 작동)
  }
}

/**
 * 제네릭 실시간 리스닝 함수 - Firebase에서 데이터 변경 감지
 * @template T 데이터 타입
 * @param strategy 동기화 전략
 * @param onUpdate 데이터 업데이트 콜백
 * @param key 데이터 키 (선택적)
 * @returns 리스닝 해제 함수
 */
export function listenToFirebase<T>(
  strategy: SyncStrategy<T>,
  onUpdate: (data: T) => void,
  key?: string
): () => void {
  try {
    const db = getFirebaseDatabase();
    const userId = strategy.getUserId?.() || 'user';
    const deviceId = getDeviceId();

    const path = getFirebasePath(userId, strategy.collection, key);
    const dataRef = ref(db, path);

    onValue(dataRef, snapshot => {
      const syncData = snapshot.val() as SyncData<T> | null;

      if (syncData && syncData.deviceId !== deviceId) {
        // 다른 디바이스에서 업데이트된 데이터
        addSyncLog('firebase', 'sync', `Received ${strategy.collection} update from Firebase`);
        console.log(`📥 Received ${strategy.collection} update from Firebase`);
        onUpdate(syncData.data);
      }
    });

    return () => off(dataRef);
  } catch (error) {
    console.error(`Failed to listen to ${strategy.collection}:`, error);
    return () => {}; // no-op
  }
}

/**
 * 제네릭 데이터 가져오기 - Firebase에서 일회성 읽기
 * @template T 데이터 타입
 * @param strategy 동기화 전략
 * @param key 데이터 키 (선택적)
 * @returns 데이터 또는 null
 */
export async function fetchFromFirebase<T>(
  strategy: SyncStrategy<T>,
  key?: string
): Promise<T | null> {
  try {
    const db = getFirebaseDatabase();
    const userId = strategy.getUserId?.() || 'user';

    const path = getFirebasePath(userId, strategy.collection, key);
    const dataRef = ref(db, path);

    const snapshot = await get(dataRef);
    const syncData = snapshot.val() as SyncData<T> | null;

    return syncData ? syncData.data : null;
  } catch (error) {
    console.error(`Failed to fetch ${strategy.collection} from Firebase:`, error);
    return null;
  }
}
