/**
 * SyncEngine RTDB listeners.
 *
 * @role Firebase RTDB → Dexie 반영을 위한 listener 세트 구성
 */

import { db } from '../../dexieClient';
import {
  attachRtdbOnValue,
  attachRtdbOnChild,
  attachRtdbOnChildKeyRange,
} from '@/shared/services/sync/firebase/rtdbListenerRegistry';
import { getLocalDate } from '@/shared/lib/utils';
import { FIREBASE_SYNC_DEFAULTS } from '@/shared/constants/defaults';
import type { DailyTokenUsage, Task } from '@/shared/types/domain';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readDeviceId = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const deviceId = value.deviceId;
  return typeof deviceId === 'string' ? deviceId : undefined;
};

const readData = (value: unknown): unknown => {
  if (!isRecord(value)) return undefined;
  return value.data;
};

const readId = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const id = value.id;
  return typeof id === 'string' ? id : undefined;
};

export interface StartListenersOptions {
  readonly database: unknown;
  readonly userId: string;
  readonly deviceId: string;
  readonly applyRemoteUpdate: (callback: () => Promise<void>, operationKey?: string) => Promise<void>;
  readonly sanitizeTokenUsage: (usage: DailyTokenUsage) => DailyTokenUsage;
}

export const startRtdbListeners = (options: StartListenersOptions): Array<() => void> => {
  const { database, userId, deviceId, applyRemoteUpdate, sanitizeTokenUsage } = options;
  const unsubscribes: Array<() => void> = [];

  // Narrow date-keyed root listeners to a recent window to reduce subtree re-download.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FIREBASE_SYNC_DEFAULTS.rtdbDateKeyedLookbackDays);
  const startAtDateKey = getLocalDate(cutoff);

  // CompletedInbox는 date-keyed(날짜별 배열) 형태라, child 이벤트를 누적하여
  // 전체 union view(db.completedInbox)로 재구성합니다.
  const completedInboxByDate = new Map<string, Task[]>();

  // 1. DailyData Listener (date-keyed)
  const dailyPath = `users/${userId}/dailyData`;
  unsubscribes.push(
    attachRtdbOnChildKeyRange(
      database as never,
      dailyPath,
      startAtDateKey,
      (eventType, snapshot) => {
        const date = snapshot.key;
        if (typeof date !== 'string') return;

        const syncData = snapshot.val() as unknown;
        if (readDeviceId(syncData) === deviceId) return;

        if (eventType === 'child_removed') {
          void applyRemoteUpdate(async () => {
            await db.dailyData.delete(date);
          }, `dailyData:${date}`);
          return;
        }

        const payload = readData(syncData);
        void applyRemoteUpdate(async () => {
          if (isRecord(payload)) {
            await db.dailyData.put({ ...payload, date } as never);
          } else if (payload === null) {
            await db.dailyData.delete(date);
          }
        }, `dailyData:${date}`);
      },
      { tag: 'SyncEngine.dailyData' }
    )
  );

  // 2. GameState Listener
  const gameStatePath = `users/${userId}/gameState`;
  unsubscribes.push(
    attachRtdbOnValue(database as never, gameStatePath, (snapshot) => {
      const syncData = snapshot.val() as unknown;
      if (readDeviceId(syncData) === deviceId) return;

      const payload = readData(syncData);

      if (isRecord(payload)) {
        void applyRemoteUpdate(async () => {
          const localGameState = await db.gameState.get('current');
          const localTotalXP = (localGameState as { totalXP?: number } | undefined)?.totalXP ?? 0;
          const remoteTotalXP = (payload as { totalXP?: number }).totalXP ?? 0;

          if (localTotalXP > remoteTotalXP) {
            console.log(
              `[SyncEngine] 🛡️ Skipping remote GameState (local XP: ${localTotalXP} > remote XP: ${remoteTotalXP})`
            );
            return;
          }

          await db.gameState.put({ ...payload, key: 'current' } as never);
        }, 'gameState:current');
      } else if (payload === null) {
        void applyRemoteUpdate(async () => {
          await db.gameState.delete('current');
        }, 'gameState:current');
      }
    }, { tag: 'SyncEngine.gameState' })
  );

  // 3. Templates Listener
  const templatesPath = `users/${userId}/templates`;
  unsubscribes.push(
    attachRtdbOnChild(
      database as never,
      `${templatesPath}/data`,
      (eventType, snapshot) => {
        const syncData = snapshot.val() as unknown;
        // deviceId 기반 에코 방지
        if (readDeviceId(syncData) === deviceId) return;
        const id = readId(syncData);
        if (!id) return;

        void applyRemoteUpdate(async () => {
          if (eventType === 'child_removed') {
            await db.templates.delete(id);
            return;
          }

          await db.templates.put(syncData as never);
        }, `templates:${id}`);
      },
      { tag: 'SyncEngine.templates' }
    )
  );

  // 4. ShopItems Listener
  const shopItemsPath = `users/${userId}/shopItems`;
  const handleShopItemEvent = (
    eventType: 'child_added' | 'child_changed' | 'child_removed',
    syncData: unknown
  ) => {
    // deviceId 기반 에코 방지
    if (readDeviceId(syncData) === deviceId) return;
    const id = readId(syncData);
    if (!id) return;

    void applyRemoteUpdate(async () => {
      if (eventType === 'child_removed') {
        await db.shopItems.delete(id);
        return;
      }

      await db.shopItems.put(syncData as never);
    }, `shopItems:${id}`);
  };

  // Support both legacy root shape and current "all" key shape.
  unsubscribes.push(
    attachRtdbOnChild(
      database as never,
      `${shopItemsPath}/data`,
      (eventType, snapshot) => {
        handleShopItemEvent(eventType, snapshot.val() as unknown);
      },
      { tag: 'SyncEngine.shopItems' }
    )
  );
  unsubscribes.push(
    attachRtdbOnChild(
      database as never,
      `${shopItemsPath}/all/data`,
      (eventType, snapshot) => {
        handleShopItemEvent(eventType, snapshot.val() as unknown);
      },
      { tag: 'SyncEngine.shopItems' }
    )
  );

  // 5. GlobalInbox Listener (support legacy shape)
  const globalInboxPath = `users/${userId}/globalInbox`;
  const handleGlobalInboxEvent = (
    eventType: 'child_added' | 'child_changed' | 'child_removed',
    syncData: unknown
  ) => {
    // deviceId 기반 에코 방지
    if (readDeviceId(syncData) === deviceId) return;
    const id = readId(syncData);
    if (!id) return;

    void applyRemoteUpdate(async () => {
      if (eventType === 'child_removed') {
        await db.globalInbox.delete(id);
        return;
      }

      await db.globalInbox.put(syncData as never);
    }, `globalInbox:${id}`);
  };

  // Current shape: SyncData<Task[]> stored at users/{userId}/globalInbox
  unsubscribes.push(
    attachRtdbOnChild(
      database as never,
      `${globalInboxPath}/data`,
      (eventType, snapshot) => {
        handleGlobalInboxEvent(eventType, snapshot.val() as unknown);
      },
      { tag: 'SyncEngine.globalInbox' }
    )
  );

  // Legacy shape: SyncData<Task[]> stored at users/{userId}/globalInbox/all
  unsubscribes.push(
    attachRtdbOnChild(
      database as never,
      `${globalInboxPath}/all/data`,
      (eventType, snapshot) => {
        handleGlobalInboxEvent(eventType, snapshot.val() as unknown);
      },
      { tag: 'SyncEngine.globalInbox' }
    )
  );

  // 5-1. CompletedInbox Listener (date-keyed)
  const completedInboxPath = `users/${userId}/completedInbox`;
  unsubscribes.push(
    attachRtdbOnChildKeyRange(
      database as never,
      completedInboxPath,
      startAtDateKey,
      (eventType, snapshot) => {
        const date = snapshot.key;
        if (typeof date !== 'string') return;

        const syncData = snapshot.val() as unknown;
        if (readDeviceId(syncData) === deviceId) return;

        if (eventType === 'child_removed') {
          completedInboxByDate.delete(date);
        } else {
          const payload = readData(syncData);
          if (Array.isArray(payload)) {
            completedInboxByDate.set(date, payload as Task[]);
          } else if (payload === null) {
            completedInboxByDate.delete(date);
          } else {
            return;
          }
        }

        void applyRemoteUpdate(async () => {
          const map = new Map<string, Task>();
          for (const tasks of completedInboxByDate.values()) {
            for (const task of tasks) {
              map.set(task.id, task);
            }
          }

          const mergedTasks = Array.from(map.values());
          await db.completedInbox.clear();
          if (mergedTasks.length > 0) {
            await db.completedInbox.bulkPut(mergedTasks as never[]);
          }
        }, 'completedInbox:all');
      },
      { tag: 'SyncEngine.completedInbox' }
    )
  );

  // 6. TokenUsage Listener (date-keyed)
  const tokenUsagePath = `users/${userId}/tokenUsage`;
  unsubscribes.push(
    attachRtdbOnChildKeyRange(
      database as never,
      tokenUsagePath,
      startAtDateKey,
      (eventType, snapshot) => {
        const date = snapshot.key;
        if (typeof date !== 'string') return;

        const syncData = snapshot.val() as unknown;
        if (readDeviceId(syncData) === deviceId) return;

        if (eventType === 'child_removed') {
          void applyRemoteUpdate(async () => {
            await db.dailyTokenUsage.delete(date);
          }, `tokenUsage:${date}`);
          return;
        }

        const payload = readData(syncData);
        void applyRemoteUpdate(async () => {
          if (isRecord(payload)) {
            const sanitized = sanitizeTokenUsage(payload as unknown as DailyTokenUsage);
            await db.dailyTokenUsage.put({ ...sanitized, date } as never);
          } else if (payload === null) {
            await db.dailyTokenUsage.delete(date);
          }
        }, `tokenUsage:${date}`);
      },
      { tag: 'SyncEngine.tokenUsage' }
    )
  );

  // 8. Settings Listener
  const settingsPath = `users/${userId}/settings`;
  unsubscribes.push(
    attachRtdbOnValue(database as never, settingsPath, (snapshot) => {
      const syncData = snapshot.val() as unknown;
      if (readDeviceId(syncData) === deviceId) return;

      const payload = readData(syncData);
      if (!isRecord(payload)) return;

      void applyRemoteUpdate(async () => {
        const currentSettings = await db.settings.get('current');
        const mergedSettings = {
          ...payload,
          ...(currentSettings ?? {}),
          dontDoChecklist: (payload as { dontDoChecklist?: unknown }).dontDoChecklist,
          waifuMode: (payload as { waifuMode?: unknown }).waifuMode,
          templateCategories: (payload as { templateCategories?: unknown }).templateCategories,
          timeSlotTags: (payload as { timeSlotTags?: unknown }).timeSlotTags,
          autoMessageEnabled: (payload as { autoMessageEnabled?: unknown }).autoMessageEnabled,
          autoMessageInterval: (payload as { autoMessageInterval?: unknown }).autoMessageInterval,
          firebaseConfig:
            (currentSettings as { firebaseConfig?: unknown } | undefined)?.firebaseConfig ??
            (payload as { firebaseConfig?: unknown }).firebaseConfig,
        };

        await db.settings.put({ ...mergedSettings, key: 'current' } as never);
      }, 'settings:current');
    }, { tag: 'SyncEngine.settings' })
  );

  return unsubscribes;
};

export const stopRtdbListeners = (unsubscribes: readonly (() => void)[]) => {
  unsubscribes.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('[SyncEngine] Failed to unsubscribe listener:', error);
    }
  });
};
