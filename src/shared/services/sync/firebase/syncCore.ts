/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { ref, set, get, onValue } from 'firebase/database';
import { resolveConflictLWW, type SyncData } from './conflictResolver';
import { getDataHash, getServerTimestamp, getDeviceId, getFirebasePath } from './syncUtils';
import { getFirebaseDatabase, isFirebaseInitialized } from './firebaseClient';
import { addSyncLog } from '../syncLogger';
import { addToRetryQueue } from './syncRetryQueue';
import { sanitizeForFirebase } from '@/shared/utils/firebaseSanitizer';
import { recordRtdbGet, recordRtdbSet, recordRtdbError, recordRtdbOnValue, isRtdbInstrumentationEnabled } from './rtdbMetrics';

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

  /**
   * 데이터 직렬화 (선택적)
   * Firebase에 저장하기 전에 데이터를 변환하거나 필터링합니다.
   * (예: 민감한 정보 제거)
   */
  serialize?: (data: T) => any;
}

// ============================================================================
// 중복 동기화 방지를 위한 해시 캐시
// ============================================================================

const lastSyncHash: Record<string, string> = {};

// ============================================================================
// Pre-get single-flight + short TTL cache (read amplification 완화)
// ============================================================================

type CachedRemote = { value: unknown; cachedAt: number };
const remoteCache: Map<string, CachedRemote> = new Map();
const inFlightGet: Map<string, Promise<unknown>> = new Map();

function getRemoteCacheKey(path: string): string {
  return path;
}

async function getRemoteOnce(dataRef: ReturnType<typeof ref>, path: string): Promise<unknown> {
  const key = getRemoteCacheKey(path);
  const cached = remoteCache.get(key);
  const now = Date.now();

  // 2초 TTL: 연속 훅(템플릿/인박스)에서 pre-get 폭주 완화
  if (cached && now - cached.cachedAt < 2000) {
    return cached.value;
  }

  const existing = inFlightGet.get(key);
  if (existing) return existing;

  const p = get(dataRef)
    .then((snapshot) => snapshot.val())
    .then((val) => {
      remoteCache.set(key, { value: val, cachedAt: Date.now() });

      // Instrument only on actual network reads (cache hits should not count as bandwidth).
      if (isRtdbInstrumentationEnabled()) {
        recordRtdbGet(path, val);
      }
      return val;
    })
    .finally(() => {
      inFlightGet.delete(key);
    });

  inFlightGet.set(key, p);
  return p;
}

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
    if (!isFirebaseInitialized()) {
      // Firebase가 아직 초기화되지 않았으면 동기화 스킵 (로컬 작업은 계속 진행)
      return;
    }

    const db = getFirebaseDatabase();
    const userId = strategy.getUserId?.() || 'user';
    const deviceId = getDeviceId();

    const path = getFirebasePath(userId, strategy.collection, key);
    const dataRef = ref(db, path);

    // 1. Strategy별 커스텀 직렬화 (예: 민감 정보 제거)
    let dataToSync = data;
    if (strategy.serialize) {
      dataToSync = strategy.serialize(data);
    }

    // 2. Firebase는 undefined 값을 허용하지 않으므로 사전에 제거 (null로 변환)
    const sanitizedData = sanitizeForFirebase(dataToSync);

    // 중복 동기화 방지
    const dataHash = getDataHash(sanitizedData);
    const hashKey = `${strategy.collection}-${key || 'root'}`;

    if (lastSyncHash[hashKey] === dataHash) {
      return;
    }

    // 기존 데이터 확인 (single-flight + TTL cache로 다운로드 증폭 완화)
    const remoteRaw = await getRemoteOnce(dataRef, path);
    const remoteData = remoteRaw as SyncData<T> | null;

    const localSyncData: SyncData<T> = {
      data: sanitizedData,
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
    if (isRtdbInstrumentationEnabled()) {
      recordRtdbSet(path, localSyncData);
    }
    await set(dataRef, localSyncData);
    lastSyncHash[hashKey] = dataHash;

    const successMessage =
      strategy.getSuccessMessage?.(data, key) ||
      `${strategy.collection} synced to Firebase: ${key || ''}`;

    addSyncLog('firebase', 'sync', successMessage);
  } catch (error) {
    console.error(`Failed to sync ${strategy.collection} to Firebase:`, error);
    addSyncLog('firebase', 'error', `Failed to sync ${strategy.collection}`, undefined, error as Error);
    if (isRtdbInstrumentationEnabled()) {
      try {
        const userId = strategy.getUserId?.() || 'user';
        const path = getFirebasePath(userId, strategy.collection, key);
        recordRtdbError(path);
      } catch {
        // ignore
      }
    }

    // 재시도 큐에 추가
    const retryId = `${strategy.collection}-${key || 'root'}-${Date.now()}`;
    addToRetryQueue(
      retryId,
      strategy,
      data,
      key,
      () => syncToFirebase(strategy, data, key),
      3 // 최대 3회 재시도
    );

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
    if (!isFirebaseInitialized()) {
      return () => { };
    }

    const db = getFirebaseDatabase();
    const userId = strategy.getUserId?.() || 'user';
    const deviceId = getDeviceId();

    const path = getFirebasePath(userId, strategy.collection, key);
    const dataRef = ref(db, path);

    const unsubscribe = onValue(dataRef, snapshot => {
      const raw = snapshot.val() as unknown;
      if (isRtdbInstrumentationEnabled()) {
        recordRtdbOnValue(path, raw);
      }

      const syncData = raw as SyncData<T> | null;

      if (syncData && syncData.deviceId !== deviceId) {
        // 다른 디바이스에서 업데이트된 데이터
        addSyncLog('firebase', 'sync', `Received ${strategy.collection} update from Firebase`);
        onUpdate(syncData.data);
      }
    });

    return () => {
      try {
        unsubscribe();
      } catch (e) {
        console.warn(`Failed to unsubscribe ${strategy.collection}:`, e);
      }
    };
  } catch (error) {
    console.error(`Failed to listen to ${strategy.collection}:`, error);
    return () => { }; // no-op
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
    if (!isFirebaseInitialized()) {
      return null;
    }

    const db = getFirebaseDatabase();
    const userId = strategy.getUserId?.() || 'user';

    const path = getFirebasePath(userId, strategy.collection, key);
    const dataRef = ref(db, path);

    const snapshot = await get(dataRef);
    const syncData = snapshot.val() as SyncData<T> | null;

    if (isRtdbInstrumentationEnabled()) {
      recordRtdbGet(path, syncData);
    }

    const data = syncData ? syncData.data : null;
    if (data !== null && data !== undefined) {
      addSyncLog('firebase', 'load', `${strategy.collection} fetched${key ? ` (${key})` : ''}`, {
        key: key || 'root',
        collection: strategy.collection,
      });
    }

    return data;
  } catch (error) {
    console.error(`Failed to fetch ${strategy.collection} from Firebase:`, error);
    addSyncLog('firebase', 'error', `Failed to fetch ${strategy.collection}`, { key }, error as Error);
    return null;
  }
}
