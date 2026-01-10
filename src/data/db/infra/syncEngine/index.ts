/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unified Sync Engine (modularized)
 *
 * @role Dexie와 Firebase 간의 양방향 자동 동기화를 관리합니다.
 * @note Dexie Hook에 직접 접근이 필요하므로 infra에 위치합니다.
 */

import { Table } from 'dexie';
import { syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { syncItemToFirebase, deleteItemFromFirebase } from '@/shared/services/sync/firebase/itemSync';
import {
  dailyDataStrategy,
  gameStateStrategy,
  templateItemStrategy,
  shopItemsItemStrategy,
  globalInboxItemStrategy,
  completedInboxStrategy,
  tokenUsageStrategy,
  settingsStrategy,
} from '@/shared/services/sync/firebase/strategies';
import { db } from '../../dexieClient';
import { getFirebaseDatabase, isFirebaseInitialized } from '@/shared/services/sync/firebase/firebaseClient';
import { acquireFirebaseSyncLeaderLock, type FirebaseSyncLeaderHandle } from '@/shared/services/sync/firebase/firebaseSyncLeaderLock';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { getDeviceId } from '@/shared/services/sync/firebase/syncUtils';
import type { DailyTokenUsage, Task } from '@/shared/types/domain';

import { startRtdbListeners, stopRtdbListeners } from './listener';
import { createSyncEngineOperationQueue } from './queue';
import { createDebouncedScheduler, repairTokenUsage, sanitizeTokenUsage } from './lifecycle';

type SyncOperation = 'create' | 'update' | 'delete';

const groupCompletedByDate = (tasks: Task[]): Record<string, Task[]> => {
  const grouped: Record<string, Task[]> = {};
  tasks.forEach((task) => {
    const date = task.completedAt ? task.completedAt.slice(0, 10) : 'unknown';
    (grouped[date] ??= []).push(task);
  });
  return grouped;
};

export class SyncEngine {
  private static instance: SyncEngine;

  private isSyncingFromRemote = false;
  private initialized = false;

  private isListening = false;
  private listeningUnsubscribes: Array<() => void> = [];
  private leaderHandle: FirebaseSyncLeaderHandle | null = null;

  private readonly debouncer = createDebouncedScheduler((message, error) => {
    this.notifyError(message, error);
  });

  private readonly operationQueue = createSyncEngineOperationQueue({
    getIsSyncingFromRemote: () => this.isSyncingFromRemote,
    setIsSyncingFromRemote: (value) => {
      this.isSyncingFromRemote = value;
    },
    onQueueError: (error) => {
      this.notifyError('동기화 큐 오류', error);
    },
  });

  private onError: ((message: string, error?: unknown) => void) | null = null;

  private constructor() {}

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Entry-point에서만 toast/store 의존을 주입하기 위한 에러 핸들러입니다.
   */
  public setOnError(handler: ((message: string, error?: unknown) => void) | null): void {
    this.onError = handler;
  }

  private notifyError(message: string, error?: unknown): void {
    this.onError?.(message, error);
  }

  /** Dexie Hook을 등록하여 자동 동기화를 활성화합니다. */
  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    repairTokenUsage().catch(console.error);

    // 1. DailyData (Key-based sync)
    this.registerHooks(db.dailyData, async (primKey, obj, op) => {
      if (op === 'delete') {
        await syncToFirebase(dailyDataStrategy, null as any, primKey as string);
      } else {
        await syncToFirebase(dailyDataStrategy, obj, primKey as string);
      }
    });

    // 2. GameState (Single object sync)
    this.registerHooks(db.gameState, async (_primKey, obj, op) => {
      if (op === 'delete') {
        await syncToFirebase(gameStateStrategy, null as any);
      } else {
        await syncToFirebase(gameStateStrategy, obj);
      }
    });

    // 3. Templates (Item-level sync)
    this.registerHooks(db.templates, async (primKey, obj, op) => {
      const uid = 'user';
      if (op === 'delete') {
        await deleteItemFromFirebase(templateItemStrategy, primKey as string, uid);
      } else {
        await syncItemToFirebase(templateItemStrategy, obj, uid);
      }
    });

    // 4. ShopItems (Item-level sync)
    this.registerHooks(db.shopItems, async (primKey, obj, op) => {
      const uid = 'user';
      if (op === 'delete') {
        await deleteItemFromFirebase(shopItemsItemStrategy, primKey as string, uid);
      } else {
        await syncItemToFirebase(shopItemsItemStrategy, obj, uid);
      }
    });

    // 5. GlobalInbox (Item-level sync)
    this.registerHooks(db.globalInbox, async (primKey, obj, op) => {
      const uid = 'user';
      if (op === 'delete') {
        await deleteItemFromFirebase(globalInboxItemStrategy, primKey as string, uid);
      } else {
        await syncItemToFirebase(globalInboxItemStrategy, obj, uid);
      }
    });

    // 5-1. CompletedInbox (Collection sync, grouped by completed date) - debounce
    this.registerHooks(db.completedInbox, async () => {
      this.debouncer.schedule('completedInbox:all', 750, async () => {
        const completedTasks = await db.completedInbox.toArray();
        const grouped = groupCompletedByDate(completedTasks as unknown as Task[]);
        const syncPromises = Object.entries(grouped).map(([date, tasks]) =>
          syncToFirebase(completedInboxStrategy, tasks as any, date)
        );
        await Promise.all(syncPromises);
      });
    });

    // 6. DailyTokenUsage (Key-based sync)
    this.registerHooks(db.dailyTokenUsage, async (primKey, obj, op) => {
      if (op === 'delete') {
        await syncToFirebase(tokenUsageStrategy, null as any, primKey as string);
      } else {
        const sanitized = sanitizeTokenUsage(obj as DailyTokenUsage);
        await syncToFirebase(tokenUsageStrategy, sanitized as any, primKey as string);
      }
    });

    // 8. Settings (Single object sync)
    this.registerHooks(db.settings, async (_primKey, obj, op) => {
      if (op === 'delete') {
        await syncToFirebase(settingsStrategy, null as any);
      } else {
        await syncToFirebase(settingsStrategy, obj);
      }
    });
  }

  /** Firebase 실시간 리스너를 시작합니다 (Remote -> Local). */
  public async startListening(): Promise<void> {
    if (this.isListening) return;

    if (!isFirebaseInitialized()) {
      return;
    }

    try {
      this.leaderHandle = await acquireFirebaseSyncLeaderLock();
    } catch (error) {
      console.warn('[SyncEngine] Failed to acquire leader lock:', error);
      this.leaderHandle = null;
    }

    if (this.leaderHandle && !this.leaderHandle.isLeader) {
      addSyncLog('firebase', 'info', 'Skipped RTDB listeners (not leader window)', {
        instanceId: this.leaderHandle.instanceId,
      });
      return;
    }

    let database: unknown;
    try {
      database = getFirebaseDatabase();
    } catch (error) {
      console.warn('[SyncEngine] Firebase database unavailable:', error);
      return;
    }

    const userId = 'user';
    const deviceId = getDeviceId();

    this.isListening = true;
    this.listeningUnsubscribes = startRtdbListeners({
      database,
      userId,
      deviceId,
      applyRemoteUpdate: this.applyRemoteUpdate.bind(this),
      sanitizeTokenUsage,
    });

    addSyncLog('firebase', 'info', 'RTDB listeners started', {
      active: this.listeningUnsubscribes.length,
      instanceId: this.leaderHandle?.instanceId,
    });
  }

  /** Firebase 실시간 리스너를 중지합니다. */
  public stopListening(): void {
    this.debouncer.clearAll();

    stopRtdbListeners(this.listeningUnsubscribes);
    this.listeningUnsubscribes = [];
    this.isListening = false;

    this.leaderHandle?.release();
    this.leaderHandle = null;

    addSyncLog('firebase', 'info', 'RTDB listeners stopped');
  }

  /**
   * 원격 업데이트를 적용할 때 호출합니다.
   * 이 기간 동안 발생하는 Dexie 변경 사항은 Firebase로 다시 동기화되지 않습니다 (루프 방지).
   */
  public async applyRemoteUpdate(callback: () => Promise<void>, operationKey?: string): Promise<void> {
    await this.operationQueue.enqueue(callback, operationKey);
  }

  /** 보류 중인 동기화 작업 수를 반환합니다 (디버깅용). */
  public getPendingOperationsCount(): number {
    return this.operationQueue.getPendingCount();
  }

  /** 테이블에 대한 Hook 등록 헬퍼 */
  private registerHooks<T, TKey>(
    table: Table<T, TKey>,
    onChanged: (primKey: TKey, obj: T, op: SyncOperation) => Promise<void>
  ) {
    table.hook('creating', (primKey, obj, transaction) => {
      if (this.isSyncingFromRemote) return;
      transaction.on('complete', () => {
        onChanged(primKey, obj, 'create').catch((hookError) => {
          console.error(`Sync failed for ${table.name}:`, hookError);
          this.notifyError(`동기화 실패 (${table.name})`, hookError);
        });
      });
    });

    table.hook('updating', (modifications, primKey, obj, transaction) => {
      if (this.isSyncingFromRemote) return;
      const updatedObj = { ...obj, ...modifications } as T;
      transaction.on('complete', () => {
        onChanged(primKey, updatedObj, 'update').catch((hookError) => {
          console.error(`Sync failed for ${table.name}:`, hookError);
          this.notifyError(`동기화 실패 (${table.name})`, hookError);
        });
      });
    });

    table.hook('deleting', (primKey, obj, transaction) => {
      if (this.isSyncingFromRemote) return;
      transaction.on('complete', () => {
        onChanged(primKey, obj, 'delete').catch((hookError) => {
          console.error(`Sync failed for ${table.name}:`, hookError);
          this.notifyError(`동기화 실패 (${table.name})`, hookError);
        });
      });
    });
  }
}

export const syncEngine = SyncEngine.getInstance();
