/**
 * Sync Logger Service
 *
 * @role Dexie 및 Firebase 동기화 이벤트를 추적하고 Dexie(IndexedDB)에 영구 저장합니다.
 *       실시간 로그 구독 기능을 제공하여 UI에서 동기화 상태를 모니터링할 수 있습니다.
 * @input SyncType ('dexie' | 'firebase'), SyncAction ('save' | 'load' | 'sync' | 'error'),
 *        메시지, 데이터, 에러 객체
 * @output SyncLogEntry 배열 (최대 100개 유지, Dexie에 영구 저장)
 * @external_dependencies
 *   - Dexie (systemState): 로그 영구 저장
 * @note localStorage 대신 Dexie systemState 테이블 사용 (앱 전체 일관성)
 */

import { db } from '@/data/db/dexieClient';
import { generateId } from '@/shared/lib/utils';

export type SyncType = 'dexie' | 'firebase';
export type SyncAction = 'save' | 'load' | 'sync' | 'error' | 'retry' | 'info';

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: SyncType;
  action: SyncAction;
  message: string;
  data?: string;
  error?: string;
}

// Dexie systemState 키
const STORAGE_KEY = 'syncLogs';

// 메모리 내 로그 캐시 (최대 10,000개)
const MAX_LOGS = 10_000;
let syncLogs: SyncLogEntry[] = [];
let pendingLogs: SyncLogEntry[] = [];
let logListeners: Array<(logs: SyncLogEntry[]) => void> = [];
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Dexie에서 로그 로드 (비동기)
 */
async function loadLogsFromStorage(): Promise<SyncLogEntry[]> {
  try {
    const record = await db.systemState.get(STORAGE_KEY);
    if (!record || !record.value) return [];
    return record.value as SyncLogEntry[];
  } catch (error) {
    console.error('Failed to load sync logs from Dexie:', error);
    return [];
  }
}

/**
 * Dexie에 로그 저장 (비동기, fire-and-forget)
 */
function saveLogsToStorage(logs: SyncLogEntry[]): void {
  db.systemState.put({ key: STORAGE_KEY, value: logs }).catch(error => {
    console.error('Failed to save sync logs to Dexie:', error);
  });
}

/**
 * 동기 초기화 (메모리 캐시만, 앱 시작 시 Dexie 로드는 별도)
 */
async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const stored = await loadLogsFromStorage();

      if (pendingLogs.length > 0) {
        syncLogs = [...pendingLogs, ...stored].slice(0, MAX_LOGS);
        pendingLogs = [];
      } else {
        syncLogs = stored;
      }
    } catch (error) {
      console.error('Failed to initialize sync logs:', error);
      syncLogs = [];
    } finally {
      isInitialized = true;
      saveLogsToStorage(syncLogs);
      notifyListeners();
    }
  })();

  return initPromise;
}

/**
 * 동기화 로그 항목을 추가합니다.
 *
 * @param {SyncType} type - 동기화 타입 ('dexie' 또는 'firebase')
 * @param {SyncAction} action - 동기화 액션 ('save', 'load', 'sync', 'error')
 * @param {string} message - 로그 메시지
 * @param {unknown} data - 로그와 함께 저장할 데이터 (선택적, 200자로 제한)
 * @param {Error} error - 에러 객체 (선택적)
 * @returns {void} 반환값 없음
 * @throws 없음
 * @sideEffects
 *   - syncLogs 배열에 새 항목 추가 (최대 100개 유지)
 *   - Dexie systemState에 저장
 *   - 모든 등록된 리스너에게 업데이트 알림
 */
export function addSyncLog(
  type: SyncType,
  action: SyncAction,
  message: string,
  data?: unknown,
  error?: Error
): void {
  if (!isInitialized) {
    // 초기화 이전에는 메모리에 적재 후 병합 시 저장
    const entry: SyncLogEntry = {
      id: generateId('log'),
      timestamp: Date.now(),
      type,
      action,
      message,
      data: data ? JSON.stringify(data).substring(0, 200) : undefined,
      error: error?.message,
    };
    pendingLogs.unshift(entry);
    if (pendingLogs.length > MAX_LOGS) {
      pendingLogs = pendingLogs.slice(0, MAX_LOGS);
    }
    ensureInitialized(); // kick off async load/merge
    return;
  }

  const entry: SyncLogEntry = {
    id: generateId('log'),
    timestamp: Date.now(),
    type,
    action,
    message,
    data: data ? JSON.stringify(data).substring(0, 200) : undefined,
    error: error?.message,
  };

  syncLogs.unshift(entry);

  // 최대 개수 제한
  if (syncLogs.length > MAX_LOGS) {
    syncLogs = syncLogs.slice(0, MAX_LOGS);
  }

  // Dexie에 저장 (비동기, fire-and-forget)
  saveLogsToStorage(syncLogs);

  // 리스너 호출
  notifyListeners();
}

/**
 * 저장된 모든 동기화 로그를 가져옵니다.
 *
 * @returns {SyncLogEntry[]} 모든 로그 항목의 복사본 배열
 * @throws 없음
 * @sideEffects
 *   - 없음: 읽기 전용 작업
 */
export function getSyncLogs(): SyncLogEntry[] {
  // 트리거해 두고 현재까지의 스냅샷 제공
  ensureInitialized();
  return [...pendingLogs, ...syncLogs].slice(0, MAX_LOGS);
}

/**
 * 동기화 로그 시스템을 초기화합니다 (앱 시작 시 호출)
 * Dexie에서 저장된 로그를 메모리로 로드합니다.
 */
export async function initializeSyncLogger(): Promise<void> {
  await ensureInitialized();
}

/**
 * 모든 동기화 로그를 삭제합니다.
 *
 * @returns {void} 반환값 없음
 * @throws 없음
 * @sideEffects
 *   - syncLogs 배열 초기화
 *   - Dexie에서 삭제
 *   - 모든 등록된 리스너에게 업데이트 알림
 */
export function clearSyncLogs(): void {
  syncLogs = [];
  pendingLogs = [];
  saveLogsToStorage(syncLogs);
  notifyListeners();
}

/**
 * 동기화 로그 변경사항을 구독합니다.
 *
 * @param {Function} callback - 로그 변경 시 호출될 콜백 함수
 * @returns {Function} 구독 해제 함수
 * @throws 없음
 * @sideEffects
 *   - logListeners 배열에 콜백 추가
 */
export function subscribeSyncLogs(callback: (logs: SyncLogEntry[]) => void): () => void {
  // 보관된 로그를 즉시 전달
  callback(getSyncLogs());
  ensureInitialized().catch(console.error);
  logListeners.push(callback);

  // 구독 해제 함수 반환
  return () => {
    logListeners = logListeners.filter((cb) => cb !== callback);
  };
}

/**
 * 리스너에게 알림
 */
function notifyListeners(): void {
  logListeners.forEach((callback) => callback([...syncLogs]));
}

/**
 * 특정 조건으로 동기화 로그를 필터링합니다.
 *
 * @param {SyncType} type - 필터링할 동기화 타입 (선택적)
 * @param {SyncAction} action - 필터링할 액션 타입 (선택적)
 * @param {number} since - 이 타임스탬프 이후의 로그만 포함 (선택적)
 * @returns {SyncLogEntry[]} 필터링된 로그 항목 배열
 * @throws 없음
 * @sideEffects
 *   - 없음: 읽기 전용 작업
 */
export function filterSyncLogs(
  type?: SyncType,
  action?: SyncAction,
  since?: number
): SyncLogEntry[] {
  let filtered = syncLogs;

  if (type) {
    filtered = filtered.filter((log) => log.type === type);
  }

  if (action) {
    filtered = filtered.filter((log) => log.action === action);
  }

  if (since) {
    filtered = filtered.filter((log) => log.timestamp >= since);
  }

  return filtered;
}
