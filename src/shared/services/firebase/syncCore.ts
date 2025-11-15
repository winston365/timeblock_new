/**
 * Generic Synchronization Core
 *
 * @role 모든 데이터 타입에 대한 제네릭 동기화 로직을 제공합니다.
 *       Firebase I/O 작업과 Pure 충돌 해결 로직을 분리하여 재사용 가능한 API를 제공합니다.
 * @input SyncStrategy<T>, 동기화할 데이터, 데이터 키 (선택적)
 * @output Promise<void> (동기화 완료), 리스너 해제 함수, 데이터 객체
 * @external_dependencies
 *   - firebase/database: Firebase Realtime Database SDK (ref, set, get, onValue, off)
 *   - ./conflictResolver: 충돌 해결 로직 (resolveConflictLWW)
 *   - ./syncUtils: 동기화 유틸리티 함수들
 *   - ./firebaseClient: Firebase 클라이언트 관리
 *   - ../syncLogger: 동기화 로그 시스템
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
 * 제네릭 동기화 함수 - Firebase에 데이터를 업로드합니다.
 * 중복 동기화를 방지하고 충돌 시 전략에 따라 해결합니다.
 *
 * @template T 데이터 타입
 * @param {SyncStrategy<T>} strategy - 동기화 전략 (컬렉션명, 충돌 해결 함수 등)
 * @param {T} data - 동기화할 데이터
 * @param {string} key - 데이터 키 (선택적, 없으면 컬렉션 루트)
 * @returns {Promise<void>} 동기화 완료 Promise
 * @throws 없음 (에러는 내부적으로 처리되며, 로컬 작업은 계속 진행)
 * @sideEffects
 *   - Firebase Realtime Database에 데이터 저장
 *   - lastSyncHash 캐시 업데이트
 *   - syncLogger에 동기화 로그 추가
 *   - 콘솔에 성공/실패 로그 출력
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
  } catch (error) {
    console.error(`Failed to sync ${strategy.collection} to Firebase:`, error);
    addSyncLog('firebase', 'error', `Failed to sync ${strategy.collection}`, undefined, error as Error);
    // 에러 발생해도 throw하지 않음 (로컬은 정상 작동)
  }
}

/**
 * 제네릭 실시간 리스닝 함수 - Firebase에서 데이터 변경을 감지합니다.
 * 다른 디바이스에서 업데이트된 데이터를 자동으로 수신합니다.
 *
 * @template T 데이터 타입
 * @param {SyncStrategy<T>} strategy - 동기화 전략
 * @param {Function} onUpdate - 데이터 업데이트 시 호출될 콜백 함수
 * @param {string} key - 데이터 키 (선택적)
 * @returns {Function} 리스닝 해제 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 등록
 *   - 다른 디바이스에서 변경 시 onUpdate 콜백 실행
 *   - syncLogger에 수신 로그 추가
 *   - 콘솔에 수신 로그 출력
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
 * 제네릭 데이터 가져오기 - Firebase에서 일회성 읽기를 수행합니다.
 *
 * @template T 데이터 타입
 * @param {SyncStrategy<T>} strategy - 동기화 전략
 * @param {string} key - 데이터 키 (선택적)
 * @returns {Promise<T | null>} 데이터 또는 null (데이터가 없는 경우)
 * @throws 없음 (에러는 내부적으로 처리되며 null 반환)
 * @sideEffects
 *   - Firebase Database에서 데이터 읽기
 *   - 콘솔에 에러 로그 출력 (실패 시)
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
