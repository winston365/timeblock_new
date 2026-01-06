/**
 * RTDB Listener Registry
 *
 * @role onValue 리스너 중복 등록을 방지하고, detach를 확실히 보장합니다.
 *       동일 경로에 여러 consumer가 구독하더라도 실제 Firebase 리스너는 1개만 유지합니다.
 */

import { ref, onValue, query as buildQuery, orderByKey, startAt, type Database, type DataSnapshot } from 'firebase/database';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import {
  recordRtdbAttach,
  recordRtdbDetach,
  recordRtdbOnValue,
  recordRtdbError,
  isRtdbInstrumentationEnabled,
} from './rtdbMetrics';

export type RtdbUnsubscribe = () => void;

type SnapshotHandler = (snapshot: DataSnapshot) => void;

type ListenerEntry = {
  path: string;
  refCount: number;
  consumers: Set<SnapshotHandler>;
  unsubscribe: (() => void) | null;
};

const listeners: Map<string, ListenerEntry> = new Map();

function getKey(db: Database, path: string): string {
  // db 인스턴스가 교체될 수 있으므로, 경로 중심으로 키 구성.
  // initializeFirebase()에서 stopAllRtdbListeners()를 호출해 교체 시 누수 방지.
  void db;
  return path;
}

export function attachRtdbOnValue(
  db: Database,
  path: string,
  handler: SnapshotHandler,
  opts?: { tag?: string }
): RtdbUnsubscribe {
  const key = getKey(db, path);

  const existing = listeners.get(key);
  if (existing) {
    existing.refCount += 1;
    existing.consumers.add(handler);
    if (isRtdbInstrumentationEnabled()) {
      addSyncLog('firebase', 'info', 'RTDB listener reused', {
        path,
        tag: opts?.tag,
        refCount: existing.refCount,
      });
    }

    return () => detachRtdbOnValue(db, path, handler, opts);
  }

  const entry: ListenerEntry = {
    path,
    refCount: 1,
    consumers: new Set([handler]),
    unsubscribe: null,
  };
  listeners.set(key, entry);

  recordRtdbAttach(path);
  if (isRtdbInstrumentationEnabled()) {
    addSyncLog('firebase', 'info', 'RTDB listener attached', {
      path,
      tag: opts?.tag,
      activeListeners: listeners.size,
    });
  }

  const dataRef = ref(db, path);

  // 단일 실제 리스너(consumer fan-out)
  const unsubscribe = onValue(
    dataRef,
    (snapshot) => {
      try {
        const value = snapshot.val();
        const bytes = recordRtdbOnValue(path, value);

        if (isRtdbInstrumentationEnabled()) {
          // 로그 폭주 방지: bytes 측정이 활성일 때만, 데이터는 저장하지 않고 수치만 남김
          addSyncLog('firebase', 'info', 'RTDB onValue event', {
            path,
            tag: opts?.tag,
            bytesEstimated: bytes,
            consumers: entry.consumers.size,
          });
        }

        // consumer 실행은 개별 try/catch로 격리
        for (const consumer of Array.from(entry.consumers)) {
          try {
            consumer(snapshot);
          } catch (consumerError) {
            console.error('[RTDB Listener Registry] consumer error:', consumerError);
          }
        }
      } catch (error) {
        recordRtdbError(path);
        console.error('[RTDB Listener Registry] onValue handler error:', error);
      }
    },
    (error) => {
      recordRtdbError(path);
      addSyncLog('firebase', 'error', 'RTDB listener error', { path, tag: opts?.tag }, error as Error);
    }
  );

  entry.unsubscribe = unsubscribe;

  return () => detachRtdbOnValue(db, path, handler, opts);
}

function getKeyRangeKey(path: string, startAtKey: string): string {
  return `${path}?orderByKey&startAt=${startAtKey}`;
}

export function attachRtdbOnValueKeyRange(
  db: Database,
  path: string,
  startAtKeyValue: string,
  handler: SnapshotHandler,
  opts?: { tag?: string }
): RtdbUnsubscribe {
  const keyPath = getKeyRangeKey(path, startAtKeyValue);
  const key = getKey(db, keyPath);

  const existing = listeners.get(key);
  if (existing) {
    existing.refCount += 1;
    existing.consumers.add(handler);
    if (isRtdbInstrumentationEnabled()) {
      addSyncLog('firebase', 'info', 'RTDB listener reused', {
        path: keyPath,
        tag: opts?.tag,
        refCount: existing.refCount,
      });
    }

    return () => detachRtdbOnValueKeyRange(db, path, startAtKeyValue, handler, opts);
  }

  const entry: ListenerEntry = {
    path: keyPath,
    refCount: 1,
    consumers: new Set([handler]),
    unsubscribe: null,
  };
  listeners.set(key, entry);

  recordRtdbAttach(keyPath);
  if (isRtdbInstrumentationEnabled()) {
    addSyncLog('firebase', 'info', 'RTDB listener attached', {
      path: keyPath,
      tag: opts?.tag,
      activeListeners: listeners.size,
    });
  }

  const baseRef = ref(db, path);
  const queryRef = buildQuery(baseRef, orderByKey(), startAt(startAtKeyValue));

  const unsubscribe = onValue(
    queryRef,
    (snapshot) => {
      try {
        const value = snapshot.val();
        const bytes = recordRtdbOnValue(keyPath, value);

        if (isRtdbInstrumentationEnabled()) {
          addSyncLog('firebase', 'info', 'RTDB onValue event', {
            path: keyPath,
            tag: opts?.tag,
            bytesEstimated: bytes,
            consumers: entry.consumers.size,
          });
        }

        for (const consumer of Array.from(entry.consumers)) {
          try {
            consumer(snapshot);
          } catch (consumerError) {
            console.error('[RTDB Listener Registry] consumer error:', consumerError);
          }
        }
      } catch (error) {
        recordRtdbError(keyPath);
        console.error('[RTDB Listener Registry] onValue handler error:', error);
      }
    },
    (error) => {
      recordRtdbError(keyPath);
      addSyncLog('firebase', 'error', 'RTDB listener error', { path: keyPath, tag: opts?.tag }, error as Error);
    }
  );

  entry.unsubscribe = unsubscribe;

  return () => detachRtdbOnValueKeyRange(db, path, startAtKeyValue, handler, opts);
}

function detachRtdbOnValue(
  db: Database,
  path: string,
  handler: SnapshotHandler,
  opts?: { tag?: string }
): void {
  const key = getKey(db, path);
  const entry = listeners.get(key);
  if (!entry) return;

  entry.consumers.delete(handler);
  entry.refCount = Math.max(0, entry.refCount - 1);

  if (entry.refCount > 0 && entry.consumers.size > 0) {
    if (isRtdbInstrumentationEnabled()) {
      addSyncLog('firebase', 'info', 'RTDB listener consumer detached', {
        path,
        tag: opts?.tag,
        refCount: entry.refCount,
        consumers: entry.consumers.size,
      });
    }
    return;
  }

  // 마지막 consumer 해제 → 실제 리스너 해제
  try {
    entry.unsubscribe?.();
  } catch (error) {
    console.warn('[RTDB Listener Registry] unsubscribe failed:', error);
  }

  listeners.delete(key);
  recordRtdbDetach(path);

  if (isRtdbInstrumentationEnabled()) {
    addSyncLog('firebase', 'info', 'RTDB listener detached', {
      path,
      tag: opts?.tag,
      activeListeners: listeners.size,
    });
  }
}

function detachRtdbOnValueKeyRange(
  db: Database,
  path: string,
  startAtKeyValue: string,
  handler: SnapshotHandler,
  opts?: { tag?: string }
): void {
  const keyPath = getKeyRangeKey(path, startAtKeyValue);
  const key = getKey(db, keyPath);
  const entry = listeners.get(key);
  if (!entry) return;

  entry.consumers.delete(handler);
  entry.refCount = Math.max(0, entry.refCount - 1);

  if (entry.refCount > 0 && entry.consumers.size > 0) {
    if (isRtdbInstrumentationEnabled()) {
      addSyncLog('firebase', 'info', 'RTDB listener consumer detached', {
        path: keyPath,
        tag: opts?.tag,
        refCount: entry.refCount,
        consumers: entry.consumers.size,
      });
    }
    return;
  }

  try {
    entry.unsubscribe?.();
  } catch (error) {
    console.warn('[RTDB Listener Registry] unsubscribe failed:', error);
  }

  listeners.delete(key);
  recordRtdbDetach(keyPath);

  if (isRtdbInstrumentationEnabled()) {
    addSyncLog('firebase', 'info', 'RTDB listener detached', {
      path: keyPath,
      tag: opts?.tag,
      activeListeners: listeners.size,
    });
  }
}

export function stopAllRtdbListeners(): void {
  for (const entry of listeners.values()) {
    try {
      entry.unsubscribe?.();
    } catch (error) {
      console.warn('[RTDB Listener Registry] stopAll unsubscribe failed:', error);
    }

    // best-effort accounting for DEV instrumentation
    try {
      recordRtdbDetach(entry.path);
    } catch {
      // ignore
    }
  }
  listeners.clear();
}

export function getActiveRtdbListenerCount(): number {
  return listeners.size;
}
