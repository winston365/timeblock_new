/**
 * 동기화 로그 시스템
 * Dexie 및 Firebase 동기화 이벤트 추적
 */

export type SyncType = 'dexie' | 'firebase';
export type SyncAction = 'save' | 'load' | 'sync' | 'error';

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: SyncType;
  action: SyncAction;
  message: string;
  data?: string;
  error?: string;
}

// 메모리 내 로그 저장 (최대 100개)
const MAX_LOGS = 100;
let syncLogs: SyncLogEntry[] = [];
let logListeners: Array<(logs: SyncLogEntry[]) => void> = [];

/**
 * 로그 추가
 */
export function addSyncLog(
  type: SyncType,
  action: SyncAction,
  message: string,
  data?: unknown,
  error?: Error
): void {
  const entry: SyncLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // 리스너 호출
  notifyListeners();
}

/**
 * 모든 로그 가져오기
 */
export function getSyncLogs(): SyncLogEntry[] {
  return [...syncLogs];
}

/**
 * 로그 초기화
 */
export function clearSyncLogs(): void {
  syncLogs = [];
  notifyListeners();
}

/**
 * 로그 변경 구독
 */
export function subscribeSyncLogs(callback: (logs: SyncLogEntry[]) => void): () => void {
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
 * 로그 필터링
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
