/**
 * Base Repository
 *
 * @role Repository들의 공통 패턴을 추상화한 베이스 유틸리티
 * @input RepositoryConfig, 데이터 객체, 키
 * @output 저장/로드된 데이터
 * @external_dependencies
 *   - IndexedDB (db): 메인 저장소
 *   - localStorage: 백업 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase, fetchFromFirebase)
 *   - syncLogger: 동기화 로그
 */

import { saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { fetchFromFirebase, type SyncStrategy } from '@/shared/services/sync/firebase/syncCore';

// ============================================================================
// Types
// ============================================================================

/**
 * Repository 설정 인터페이스
 *
 * @template T - 저장할 데이터 타입
 */
export interface RepositoryConfig<T> {
  /** Dexie 테이블 */
  table: any;
  /** localStorage 키 (선택: 없으면 localStorage 저장 안 함) */
  storageKey?: string;
  /** Firebase 동기화 전략 */
  firebaseStrategy?: SyncStrategy<T>;
  /** 초기 데이터 생성 함수 */
  createInitial: () => T;
  /** 데이터 정제 함수 (선택) */
  sanitize?: (data: any) => T;
  /** 로그 접두사 (선택, 기본값: 테이블 이름) */
  logPrefix?: string;
}

/**
 * Load 옵션 인터페이스
 */
export interface LoadOptions {
  /** Firebase fallback 사용 여부 (기본값: true) */
  useFirebase?: boolean;
  /** 데이터가 없을 때 초기값 저장 여부 (기본값: true) */
  saveInitial?: boolean;
}

/**
 * Save 옵션 인터페이스
 */
export interface SaveOptions {
  /** Firebase 동기화 여부 (기본값: true) */
  syncFirebase?: boolean;
  /** localStorage 저장 여부 (기본값: true) */
  saveLocalStorage?: boolean;
  /** 로그 기록 여부 (기본값: true) */
  logSync?: boolean;
}

// ============================================================================
// Core Repository Functions
// ============================================================================

/**
 * 데이터 로드 (3-tier fallback: IndexedDB → localStorage → Firebase)
 *
 * @template T - 데이터 타입
 * @param {RepositoryConfig<T>} config - Repository 설정
 * @param {string | number} key - 조회 키
 * @param {LoadOptions} [options] - 로드 옵션
 * @returns {Promise<T>} 로드된 데이터 또는 초기값
 *
 * @example
 * const gameState = await loadData(gameStateConfig, 'current');
 */
export async function loadData<T>(
  config: RepositoryConfig<T>,
  key: string | number,
  options: LoadOptions = {}
): Promise<T> {
  const { useFirebase = true, saveInitial = true } = options;
  const { table, storageKey, firebaseStrategy, createInitial, sanitize, logPrefix } = config;
  const prefix = logPrefix || table.name;

  try {
    // 1. IndexedDB에서 조회
    const data = await table.get(key);

    if (data) {
      const sanitized = sanitize ? sanitize(data) : data;
      addSyncLog('dexie', 'load', `${prefix} loaded from IndexedDB`, { key });
      return sanitized;
    }

    // 2. localStorage에서 조회 (storageKey가 있을 때만)
    if (storageKey) {
      const storageFullKey = typeof key === 'string' ? `${storageKey}${key}` : storageKey;
      const localData = getFromStorage<T | null>(storageFullKey, null);

      if (localData) {
        const sanitized = sanitize ? sanitize(localData) : localData;
        // localStorage 데이터를 IndexedDB에 복원
        await saveData(config, key, sanitized, { syncFirebase: false, logSync: false });
        addSyncLog('dexie', 'load', `${prefix} restored from localStorage`, { key });
        return sanitized;
      }
    }

    // 3. Firebase에서 조회 (firebaseStrategy가 있을 때만)
    if (useFirebase && firebaseStrategy && isFirebaseInitialized()) {
      const firebaseData = await fetchFromFirebase<T>(firebaseStrategy, key.toString());

      if (firebaseData) {
        const sanitized = sanitize ? sanitize(firebaseData) : firebaseData;
        // Firebase 데이터를 IndexedDB와 localStorage에 복원
        await saveData(config, key, sanitized, { syncFirebase: false });
        addSyncLog('firebase', 'load', `${prefix} loaded from Firebase`, { key });
        return sanitized;
      }
    }

    // 4. 초기값 반환
    const initial = createInitial();
    if (saveInitial) {
      await saveData(config, key, initial, { syncFirebase: false, logSync: false });
    }
    addSyncLog('dexie', 'load', `${prefix} created with initial data`, { key });
    return initial;
  } catch (error) {
    console.error(`Failed to load ${prefix} for key ${key}:`, error);
    addSyncLog('dexie', 'error', `Failed to load ${prefix}`, { key }, error as Error);
    return createInitial();
  }
}

/**
 * 데이터 저장 (3-way sync: IndexedDB + localStorage + Firebase)
 *
 * @template T - 데이터 타입
 * @param {RepositoryConfig<T>} config - Repository 설정
 * @param {string | number} key - 저장 키
 * @param {T} data - 저장할 데이터
 * @param {SaveOptions} [options] - 저장 옵션
 * @returns {Promise<void>}
 *
 * @example
 * await saveData(gameStateConfig, 'current', gameState);
 */
export async function saveData<T>(
  config: RepositoryConfig<T>,
  key: string | number,
  data: T,
  options: SaveOptions = {}
): Promise<void> {
  const { syncFirebase = true, saveLocalStorage = true, logSync = true } = options;
  const { table, storageKey, firebaseStrategy, logPrefix } = config;
  const prefix = logPrefix || table.name;

  try {
    // 1. IndexedDB에 저장
    await table.put({
      key,
      ...data,
    });

    // 2. localStorage에 저장 (storageKey가 있을 때만)
    if (saveLocalStorage && storageKey) {
      const storageFullKey = typeof key === 'string' ? `${storageKey}${key}` : storageKey;
      saveToStorage(storageFullKey, data);
    }

    // 3. SyncLog 기록
    if (logSync) {
      addSyncLog('dexie', 'save', `${prefix} saved`, { key });
    }


  } catch (error) {
    console.error(`Failed to save ${prefix} for key ${key}:`, error);
    addSyncLog('dexie', 'error', `Failed to save ${prefix}`, { key }, error as Error);
    throw error;
  }
}

/**
 * 데이터 업데이트 (부분 업데이트)
 *
 * @template T - 데이터 타입
 * @param {RepositoryConfig<T>} config - Repository 설정
 * @param {string | number} key - 업데이트 키
 * @param {Partial<T>} updates - 업데이트할 필드
 * @param {SaveOptions} [options] - 저장 옵션
 * @returns {Promise<T>} 업데이트된 데이터
 *
 * @example
 * const updated = await updateData(gameStateConfig, 'current', { level: 5 });
 */
export async function updateData<T>(
  config: RepositoryConfig<T>,
  key: string | number,
  updates: Partial<T>,
  options: SaveOptions = {}
): Promise<T> {
  try {
    // 기존 데이터 로드
    const existingData = await loadData(config, key, { saveInitial: false });

    // 업데이트 적용
    const updatedData = { ...existingData, ...updates };

    // 저장
    await saveData(config, key, updatedData, options);

    return updatedData;
  } catch (error) {
    console.error(`Failed to update ${config.logPrefix || config.table.name}:`, error);
    throw error;
  }
}

/**
 * 데이터 삭제
 *
 * @template T - 데이터 타입
 * @param {RepositoryConfig<T>} config - Repository 설정
 * @param {string | number} key - 삭제 키
 * @returns {Promise<void>}
 *
 * @example
 * await deleteData(templateConfig, 'template-123');
 */
export async function deleteData<T>(
  config: RepositoryConfig<T>,
  key: string | number
): Promise<void> {
  const { table, storageKey, logPrefix } = config;
  const prefix = logPrefix || table.name;

  try {
    // 1. IndexedDB에서 삭제
    await table.delete(key);

    // 2. localStorage에서 삭제 (storageKey가 있을 때만)
    if (storageKey) {
      const storageFullKey = typeof key === 'string' ? `${storageKey}${key}` : storageKey;
      localStorage.removeItem(storageFullKey);
    }

    addSyncLog('dexie', 'save', `${prefix} deleted`, { key });
  } catch (error) {
    console.error(`Failed to delete ${prefix} for key ${key}:`, error);
    addSyncLog('dexie', 'error', `Failed to delete ${prefix}`, { key }, error as Error);
    throw error;
  }
}

// ============================================================================
// Collection Helpers (배열 데이터용)
// ============================================================================

/**
 * 컬렉션 전체 로드 (배열 데이터용)
 *
 * @template T - 배열 요소 타입
 * @param {RepositoryConfig<T[]>} config - Repository 설정
 * @param {LoadOptions} [options] - 로드 옵션
 * @returns {Promise<T[]>} 로드된 배열
 *
 * @example
 * const templates = await loadCollection(templateConfig);
 */
export async function loadCollection<T>(
  config: RepositoryConfig<T[]>,
  options: LoadOptions = {}
): Promise<T[]> {
  const { table, sanitize } = config;

  try {
    // IndexedDB에서 배열로 조회
    const items = await table.toArray();

    if (items.length > 0) {
      addSyncLog('dexie', 'load', `${config.logPrefix || table.name} loaded from IndexedDB`, {
        count: items.length,
      });
      // sanitize는 T[] → T[]를 반환해야 하므로, 개별 아이템에 적용하지 않음
      return sanitize ? sanitize(items) : items;
    }

    // localStorage fallback (storageKey가 있을 때만)
    if (config.storageKey) {
      const localData = getFromStorage<T[] | null>(config.storageKey, null);
      if (localData && localData.length > 0) {
        // IndexedDB에 복원
        await table.bulkPut(localData);
        addSyncLog('dexie', 'load', `${config.logPrefix || table.name} restored from localStorage`, {
          count: localData.length,
        });
        return sanitize ? sanitize(localData) : localData;
      }
    }

    // Firebase fallback
    if (options.useFirebase !== false && config.firebaseStrategy && isFirebaseInitialized()) {
      const firebaseData = await fetchFromFirebase<T[]>(config.firebaseStrategy, 'all');
      if (firebaseData && firebaseData.length > 0) {
        await table.bulkPut(firebaseData);
        if (config.storageKey) {
          saveToStorage(config.storageKey, firebaseData);
        }
        addSyncLog('firebase', 'load', `${config.logPrefix || table.name} loaded from Firebase`, {
          count: firebaseData.length,
        });
        return sanitize ? sanitize(firebaseData) : firebaseData;
      }
    }

    // 초기값 반환
    return config.createInitial();
  } catch (error) {
    console.error(`Failed to load ${config.logPrefix || table.name} collection:`, error);
    return config.createInitial();
  }
}

/**
 * 컬렉션 전체 저장 (배열 데이터용)
 *
 * @template T - 배열 요소 타입
 * @param {RepositoryConfig<T[]>} config - Repository 설정
 * @param {T[]} items - 저장할 배열
 * @param {SaveOptions} [options] - 저장 옵션
 * @returns {Promise<void>}
 *
 * @example
 * await saveCollection(templateConfig, templates);
 */
export async function saveCollection<T>(
  config: RepositoryConfig<T[]>,
  items: T[],
  options: SaveOptions = {}
): Promise<void> {
  const { syncFirebase = true, saveLocalStorage = true, logSync = true } = options;
  const { table, storageKey, firebaseStrategy, logPrefix } = config;
  const prefix = logPrefix || table.name;

  try {
    // 1. IndexedDB에 저장 (전체 교체)
    await table.clear();
    if (items.length > 0) {
      await table.bulkPut(items);
    }

    // 2. localStorage에 저장 (storageKey가 있을 때만)
    if (saveLocalStorage && storageKey) {
      saveToStorage(storageKey, items);
    }

    // 3. SyncLog 기록
    if (logSync) {
      addSyncLog('dexie', 'save', `${prefix} collection saved`, { count: items.length });
    }


  } catch (error) {
    console.error(`Failed to save ${prefix} collection:`, error);
    addSyncLog('dexie', 'error', `Failed to save ${prefix} collection`, undefined, error as Error);
    throw error;
  }
}
