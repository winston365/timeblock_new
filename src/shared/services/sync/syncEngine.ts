import { Dexie, Table } from 'dexie';
import { syncToFirebase } from './firebase/syncCore';
import {
    dailyDataStrategy,
    gameStateStrategy,
    templateStrategy,
    shopItemsStrategy,
    globalInboxStrategy,
    energyLevelsStrategy,
    tokenUsageStrategy,
} from './firebase/strategies';
import { db } from '@/data/db/dexieClient';
import { getFirebaseDatabase } from './firebase/firebaseClient';
import { ref, onValue, off } from 'firebase/database';
import { getDeviceId } from './firebase/syncUtils';
import { useToastStore } from '@/shared/stores/toastStore';

type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Unified Sync Engine
 *
 * @role Dexie와 Firebase 간의 자동 동기화를 관리합니다.
 *       Dexie Hook을 사용하여 로컬 변경 사항을 감지하고 Firebase에 자동으로 업로드합니다.
 *       원격 업데이트 시 무한 루프를 방지하는 메커니즘을 포함합니다.
 */
export class SyncEngine {
    private static instance: SyncEngine;
    private isSyncingFromRemote = false;
    private initialized = false;

    private constructor() { }

    public static getInstance(): SyncEngine {
        if (!SyncEngine.instance) {
            SyncEngine.instance = new SyncEngine();
        }
        return SyncEngine.instance;
    }

    /**
     * Dexie Hook을 등록하여 자동 동기화를 활성화합니다.
     */
    public initialize() {
        if (this.initialized) return;
        this.initialized = true;

        console.log('🔄 SyncEngine: Initializing hooks...');

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

        // 3. Templates (Collection sync)
        this.registerHooks(db.templates, async () => {
            const allTemplates = await db.templates.toArray();
            await syncToFirebase(templateStrategy, allTemplates, 'all');
        });

        // 4. ShopItems (Collection sync)
        this.registerHooks(db.shopItems, async () => {
            const allItems = await db.shopItems.toArray();
            await syncToFirebase(shopItemsStrategy, allItems, 'all');
        });

        // 5. GlobalInbox (Collection sync)
        this.registerHooks(db.globalInbox, async () => {
            const allTasks = await db.globalInbox.toArray();
            await syncToFirebase(globalInboxStrategy, allTasks, 'all');
        });

        // 6. EnergyLevels (Key-based sync but syncs array per date)
        this.registerHooks(db.energyLevels, async (_primKey, obj) => {
            const date = obj.date;
            if (date) {
                const levels = await db.energyLevels.where('date').equals(date).toArray();
                await syncToFirebase(energyLevelsStrategy, levels, date);
            }
        });

        // 7. DailyTokenUsage (Key-based sync)
        this.registerHooks(db.dailyTokenUsage, async (primKey, obj, op) => {
            if (op === 'delete') {
                await syncToFirebase(tokenUsageStrategy, null as any, primKey as string);
            } else {
                await syncToFirebase(tokenUsageStrategy, obj, primKey as string);
            }
        });

        console.log('✅ SyncEngine: Hooks registered');
    }

    /**
     * Firebase 실시간 리스너를 시작합니다 (Remote -> Local).
     */
    public startListening() {
        const database = getFirebaseDatabase();
        const userId = 'user'; // TODO: 실제 유저 ID 사용
        const deviceId = getDeviceId();

        // 1. DailyData Listener
        const dailyDataRef = ref(database, `users/${userId}/dailyData`);
        onValue(dailyDataRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.applyRemoteUpdate(async () => {
                const updates: Promise<any>[] = [];

                Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                    if (syncData.deviceId === deviceId) return;

                    if (syncData.data) {
                        updates.push(db.dailyData.put({
                            ...syncData.data,
                            date
                        }));
                    } else if (syncData.data === null) {
                        updates.push(db.dailyData.delete(date));
                    }
                });

                await Promise.all(updates);
            });
        });

        // 2. GameState Listener
        const gameStateRef = ref(database, `users/${userId}/gameState`);
        onValue(gameStateRef, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData.deviceId === deviceId) return;

            if (syncData.data) {
                this.applyRemoteUpdate(async () => {
                    await db.gameState.put({
                        ...syncData.data,
                        key: 'current'
                    });
                });
            } else if (syncData.data === null) {
                this.applyRemoteUpdate(async () => {
                    await db.gameState.delete('current');
                });
            }
        });

        // 3. Templates Listener
        const templatesRef = ref(database, `users/${userId}/templates`);
        onValue(templatesRef, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData.deviceId === deviceId) return;

            if (Array.isArray(syncData.data)) {
                this.applyRemoteUpdate(async () => {
                    await db.templates.clear();
                    await db.templates.bulkPut(syncData.data);
                });
            }
        });

        // 4. ShopItems Listener
        const shopItemsRef = ref(database, `users/${userId}/shopItems`);
        onValue(shopItemsRef, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData.deviceId === deviceId) return;

            if (Array.isArray(syncData.data)) {
                this.applyRemoteUpdate(async () => {
                    await db.shopItems.clear();
                    await db.shopItems.bulkPut(syncData.data);
                });
            }
        });

        // 5. GlobalInbox Listener
        const globalInboxRef = ref(database, `users/${userId}/globalInbox`);
        onValue(globalInboxRef, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData.deviceId === deviceId) return;

            if (Array.isArray(syncData.data)) {
                this.applyRemoteUpdate(async () => {
                    await db.globalInbox.clear();
                    await db.globalInbox.bulkPut(syncData.data);
                });
            }
        });

        // 6. EnergyLevels Listener
        const energyLevelsRef = ref(database, `users/${userId}/energyLevels`);
        onValue(energyLevelsRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.applyRemoteUpdate(async () => {
                const updates: Promise<any>[] = [];

                Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                    if (syncData.deviceId === deviceId) return;

                    if (Array.isArray(syncData.data)) {
                        updates.push(
                            db.energyLevels.where('date').equals(date).delete().then(() => {
                                const levelsWithId = syncData.data.map((level: any) => ({
                                    ...level,
                                    id: `${date}_${level.timestamp}`,
                                    date
                                }));

                                const uniqueLevels = Array.from(
                                    new Map(levelsWithId.map((item: any) => [item.id, item])).values()
                                ) as any[];

                                return db.energyLevels.bulkPut(uniqueLevels);
                            })
                        );
                    }
                });

                await Promise.all(updates);
            });
        });

        // 7. TokenUsage Listener
        const tokenUsageRef = ref(database, `users/${userId}/tokenUsage`);
        onValue(tokenUsageRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.applyRemoteUpdate(async () => {
                const updates: Promise<any>[] = [];

                Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                    if (syncData.deviceId === deviceId) return;

                    if (syncData.data) {
                        updates.push(db.dailyTokenUsage.put({
                            ...syncData.data,
                            date
                        }));
                    } else if (syncData.data === null) {
                        updates.push(db.dailyTokenUsage.delete(date));
                    }
                });

                await Promise.all(updates);
            });
        });

        console.log('✅ SyncEngine: Listeners started');
    }

    /**
     * 원격 업데이트를 적용할 때 호출합니다.
     * 이 기간 동안 발생하는 Dexie 변경 사항은 Firebase로 다시 동기화되지 않습니다 (루프 방지).
     *
     * @param callback - 원격 데이터를 로컬 DB에 저장하는 함수
     */
    public async applyRemoteUpdate(callback: () => Promise<void>) {
        if (this.isSyncingFromRemote) {
            await callback();
            return;
        }

        try {
            this.isSyncingFromRemote = true;
            await callback();
        } finally {
            this.isSyncingFromRemote = false;
        }
    }

    /**
     * 테이블에 대한 Hook 등록 헬퍼
     */
    private registerHooks<T, TKey>(
        table: Table<T, TKey>,
        onChanged: (primKey: TKey, obj: T, op: SyncOperation) => Promise<void>
    ) {
        // Creating
        table.hook('creating', (primKey, obj, transaction) => {
            if (this.isSyncingFromRemote) return;
            transaction.on('complete', () => {
                onChanged(primKey, obj, 'create').catch(err => {
                    console.error(`Sync failed for ${table.name}:`, err);
                    useToastStore.getState().addToast(`동기화 실패 (${table.name}): ${err.message}`, 'error');
                });
            });
        });

        // Updating
        table.hook('updating', (modifications, primKey, obj, transaction) => {
            if (this.isSyncingFromRemote) return;
            const updatedObj = { ...obj, ...modifications } as T;
            transaction.on('complete', () => {
                onChanged(primKey, updatedObj, 'update').catch(err => {
                    console.error(`Sync failed for ${table.name}:`, err);
                    useToastStore.getState().addToast(`동기화 실패 (${table.name}): ${err.message}`, 'error');
                });
            });
        });

        // Deleting
        table.hook('deleting', (primKey, obj, transaction) => {
            if (this.isSyncingFromRemote) return;
            transaction.on('complete', () => {
                onChanged(primKey, obj, 'delete').catch(err => {
                    console.error(`Sync failed for ${table.name}:`, err);
                    useToastStore.getState().addToast(`동기화 실패 (${table.name}): ${err.message}`, 'error');
                });
            });
        });
    }
}

export const syncEngine = SyncEngine.getInstance();
