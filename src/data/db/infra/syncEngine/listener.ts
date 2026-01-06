/**
 * SyncEngine RTDB listeners.
 *
 * @role Firebase RTDB → Dexie 반영을 위한 listener 세트 구성
 */

import { db } from '../../dexieClient';
import { attachRtdbOnValue, attachRtdbOnValueKeyRange } from '@/shared/services/sync/firebase/rtdbListenerRegistry';
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

  // 1. DailyData Listener (date-keyed)
  const dailyPath = `users/${userId}/dailyData`;
  unsubscribes.push(
    attachRtdbOnValueKeyRange(database as never, dailyPath, startAtDateKey, (snapshot) => {
      const raw = snapshot.val() as unknown;
      if (!isRecord(raw)) return;

      Object.entries(raw).forEach(([date, syncData]) => {
        if (readDeviceId(syncData) === deviceId) return;

        const payload = readData(syncData);
        void applyRemoteUpdate(async () => {
          if (isRecord(payload)) {
            await db.dailyData.put({ ...payload, date } as never);
          } else if (payload === null) {
            await db.dailyData.delete(date);
          }
        }, `dailyData:${date}`);
      });
    }, { tag: 'SyncEngine.dailyData' })
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
    attachRtdbOnValue(database as never, templatesPath, (snapshot) => {
      const syncData = snapshot.val() as unknown;
      if (readDeviceId(syncData) === deviceId) return;

      const payload = readData(syncData);
      if (!Array.isArray(payload)) return;

      void applyRemoteUpdate(async () => {
        await db.templates.clear();
        await db.templates.bulkPut(payload as never[]);
      }, 'templates:all');
    }, { tag: 'SyncEngine.templates' })
  );

  // 4. ShopItems Listener
  const shopItemsPath = `users/${userId}/shopItems`;
  unsubscribes.push(
    attachRtdbOnValue(database as never, shopItemsPath, (snapshot) => {
      const syncData = snapshot.val() as unknown;
      if (readDeviceId(syncData) === deviceId) return;

      const payload = readData(syncData);
      if (!Array.isArray(payload)) return;

      void applyRemoteUpdate(async () => {
        await db.shopItems.clear();
        await db.shopItems.bulkPut(payload as never[]);
      }, 'shopItems:all');
    }, { tag: 'SyncEngine.shopItems' })
  );

  // 5. GlobalInbox Listener (support legacy shape)
  const globalInboxPath = `users/${userId}/globalInbox`;
  unsubscribes.push(
    attachRtdbOnValue(database as never, globalInboxPath, (snapshot) => {
      const syncData = snapshot.val() as unknown;
      if (!isRecord(syncData)) return;

      const direct = readData(syncData);

      const payload = Array.isArray(direct)
        ? { data: direct, deviceId: readDeviceId(syncData) }
        : isRecord(syncData.all)
          ? { data: Array.isArray(readData(syncData.all)) ? (readData(syncData.all) as unknown[]) : null, deviceId: readDeviceId(syncData.all) }
          : null;

      if (!payload?.data || payload.deviceId === deviceId) return;

      void applyRemoteUpdate(async () => {
        await db.globalInbox.clear();
        await db.globalInbox.bulkPut(payload.data as never[]);
      }, 'globalInbox:all');
    }, { tag: 'SyncEngine.globalInbox' })
  );

  // 5-1. CompletedInbox Listener (date-keyed)
  const completedInboxPath = `users/${userId}/completedInbox`;
  unsubscribes.push(
    attachRtdbOnValueKeyRange(database as never, completedInboxPath, startAtDateKey, (snapshot) => {
      const raw = snapshot.val() as unknown;
      if (!isRecord(raw)) return;

      void applyRemoteUpdate(async () => {
        const existing = await db.completedInbox.toArray();
        const map = new Map<string, Task>((existing as Task[]).map((task) => [task.id, task]));

        Object.values(raw).forEach((syncData) => {
          if (readDeviceId(syncData) === deviceId) return;
          const payload = readData(syncData);
          if (!Array.isArray(payload)) return;

          (payload as Task[]).forEach((task) => {
            map.set(task.id, task);
          });
        });

        const mergedTasks = Array.from(map.values());
        await db.completedInbox.clear();
        if (mergedTasks.length > 0) {
          await db.completedInbox.bulkPut(mergedTasks as never[]);
        }
      }, 'completedInbox:all');
    }, { tag: 'SyncEngine.completedInbox' })
  );

  // 6. TokenUsage Listener (date-keyed)
  const tokenUsagePath = `users/${userId}/tokenUsage`;
  unsubscribes.push(
    attachRtdbOnValueKeyRange(database as never, tokenUsagePath, startAtDateKey, (snapshot) => {
      const raw = snapshot.val() as unknown;
      if (!isRecord(raw)) return;

      Object.entries(raw).forEach(([date, syncData]) => {
        if (readDeviceId(syncData) === deviceId) return;

        const payload = readData(syncData);

        void applyRemoteUpdate(async () => {
          if (isRecord(payload)) {
            const sanitized = sanitizeTokenUsage(payload as unknown as DailyTokenUsage);
            await db.dailyTokenUsage.put({ ...sanitized, date } as never);
          } else if (payload === null) {
            await db.dailyTokenUsage.delete(date);
          }
        }, `tokenUsage:${date}`);
      });
    }, { tag: 'SyncEngine.tokenUsage' })
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
