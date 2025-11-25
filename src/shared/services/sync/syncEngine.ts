import { Dexie, Table } from 'dexie';
import { syncToFirebase } from './firebase/syncCore';
import {
    dailyDataStrategy,
    gameStateStrategy,
    templateStrategy,
    shopItemsStrategy,
    globalInboxStrategy,
    completedInboxStrategy,
    energyLevelsStrategy,
    tokenUsageStrategy,
    settingsStrategy,
} from './firebase/strategies';
import { db } from '@/data/db/dexieClient';
import { getFirebaseDatabase } from './firebase/firebaseClient';
import { ref, onValue, off } from 'firebase/database';
import { getDeviceId } from './firebase/syncUtils';
import { useToastStore } from '@/shared/stores/toastStore';
import type { Task } from '@/shared/types/domain';

type SyncOperation = 'create' | 'update' | 'delete';

/**
 * 동기화 작업을 위한 Operation Queue Entry
 * 동일한 키에 대한 여러 업데이트를 병합하여 Race Condition 방지
 */
interface QueuedOperation {
    callback: () => Promise<void>;
    timestamp: number;
}

/**
 * Unified Sync Engine
 *
 * @role Dexie와 Firebase 간의 자동 동기화를 관리합니다.
 *       Dexie Hook을 사용하여 로컬 변경 사항을 감지하고 Firebase에 자동으로 업로드합니다.
 *       원격 업데이트 시 무한 루프를 방지하는 메커니즘을 포함합니다.
 * 
 * @improvement v1.1 - Operation Queue 패턴 도입
 *   - Race Condition 방지: 동일 키에 대한 작업 직렬화
 *   - Split-brain 방지: 타임스탬프 기반 충돌 감지
 *   - 작업 병합: 연속된 동일 키 업데이트를 마지막 값으로 병합
 */
export class SyncEngine {
    private static instance: SyncEngine;
    private isSyncingFromRemote = false;
    private initialized = false;

    // Operation Queue: Race Condition 방지
    private operationQueue: Promise<void> = Promise.resolve();
    private pendingOperations: Map<string, QueuedOperation> = new Map();
    
    // Split-brain 감지: 마지막 동기화 타임스탬프 추적
    private lastSyncTimestamps: Map<string, number> = new Map();

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
            await syncToFirebase(templateStrategy, allTemplates);
        });

        // 4. ShopItems (Collection sync)
        this.registerHooks(db.shopItems, async () => {
            const allItems = await db.shopItems.toArray();
            await syncToFirebase(shopItemsStrategy, allItems, 'all');
        });

        // 5. GlobalInbox (Collection sync)
        this.registerHooks(db.globalInbox, async () => {
            const allTasks = await db.globalInbox.toArray();
            await syncToFirebase(globalInboxStrategy, allTasks);
        });

        // 5-1. CompletedInbox (Collection sync, grouped by completed date)
        this.registerHooks(db.completedInbox, async () => {
            const completedTasks = await db.completedInbox.toArray();
            const grouped = groupCompletedByDate(completedTasks);
            const syncPromises = Object.entries(grouped).map(([date, tasks]) =>
                syncToFirebase(completedInboxStrategy, tasks, date)
            );
            await Promise.all(syncPromises);
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

        // 8. Settings (Single object sync)
        this.registerHooks(db.settings, async (_primKey, obj, op) => {
            if (op === 'delete') {
                await syncToFirebase(settingsStrategy, null as any);
            } else {
                await syncToFirebase(settingsStrategy, obj);
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

            // 각 날짜별로 개별 작업 생성 (Split-brain 방지)
            Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                if (syncData.deviceId === deviceId) return;

                this.applyRemoteUpdate(async () => {
                    if (syncData.data) {
                        await db.dailyData.put({
                            ...syncData.data,
                            date
                        });
                    } else if (syncData.data === null) {
                        await db.dailyData.delete(date);
                    }
                }, `dailyData:${date}`);
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
                }, 'gameState:current');
            } else if (syncData.data === null) {
                this.applyRemoteUpdate(async () => {
                    await db.gameState.delete('current');
                }, 'gameState:current');
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
                }, 'templates:all');
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
                }, 'shopItems:all');
            }
        });

        // 5. GlobalInbox Listener
        const globalInboxRef = ref(database, `users/${userId}/globalInbox`);
        onValue(globalInboxRef, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData) return;

            // Support both new shape (data at root) and legacy shape (nested under "all")
            const payload = Array.isArray(syncData.data)
                ? { data: syncData.data, deviceId: syncData.deviceId }
                : (syncData.all && Array.isArray(syncData.all.data))
                    ? { data: syncData.all.data, deviceId: syncData.all.deviceId }
                    : null;

            if (!payload || payload.deviceId === deviceId) return;

            this.applyRemoteUpdate(async () => {
                await db.globalInbox.clear();
                await db.globalInbox.bulkPut(payload.data);
            }, 'globalInbox:all');
        });

        // 5-1. CompletedInbox Listener (date-keyed)
        const completedInboxRef = ref(database, `users/${userId}/completedInbox`);
        onValue(completedInboxRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.applyRemoteUpdate(async () => {
                const existing = await db.completedInbox.toArray();
                const map = new Map<string, Task>(existing.map(task => [task.id, task]));

                Object.entries<any>(data).forEach(([_, syncData]) => {
                    if (!syncData || syncData.deviceId === deviceId) return;
                    if (Array.isArray(syncData.data)) {
                        syncData.data.forEach((task: Task) => {
                            map.set(task.id, task);
                        });
                    }
                });

                const mergedTasks = Array.from(map.values());
                await db.completedInbox.clear();
                if (mergedTasks.length > 0) {
                    await db.completedInbox.bulkPut(mergedTasks);
                }
            }, 'completedInbox:all');
        });

        // 6. EnergyLevels Listener
        const energyLevelsRef = ref(database, `users/${userId}/energyLevels`);
        onValue(energyLevelsRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // 각 날짜별로 개별 작업 생성
            Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                if (syncData.deviceId === deviceId) return;

                if (Array.isArray(syncData.data)) {
                    this.applyRemoteUpdate(async () => {
                        await db.energyLevels.where('date').equals(date).delete();
                        const levelsWithId = syncData.data.map((level: any) => ({
                            ...level,
                            id: `${date}_${level.timestamp}`,
                            date
                        }));

                        const uniqueLevels = Array.from(
                            new Map(levelsWithId.map((item: any) => [item.id, item])).values()
                        ) as any[];

                        await db.energyLevels.bulkPut(uniqueLevels);
                    }, `energyLevels:${date}`);
                }
            });
        });

        // 7. TokenUsage Listener
        const tokenUsageRef = ref(database, `users/${userId}/tokenUsage`);
        onValue(tokenUsageRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // 각 날짜별로 개별 작업 생성
            Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                if (syncData.deviceId === deviceId) return;

                this.applyRemoteUpdate(async () => {
                    if (syncData.data) {
                        await db.dailyTokenUsage.put({
                            ...syncData.data,
                            date
                        });
                    } else if (syncData.data === null) {
                        await db.dailyTokenUsage.delete(date);
                    }
                }, `tokenUsage:${date}`);
            });
        });

        // 8. Settings Listener
        const settingsRef = ref(database, `users/${userId}/settings`);
        onValue(settingsRef, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData.deviceId === deviceId) return;

            if (syncData.data) {
                this.applyRemoteUpdate(async () => {
                    // 로컬 설정과 병합 (Firebase Config 등 로컬 전용 설정 보존)
                    const currentSettings = await db.settings.get('current');
                    const mergedSettings = {
                        ...syncData.data,
                        ...currentSettings,
                        // 원격에서 온 중요 설정들로 덮어쓰기
                        dontDoChecklist: syncData.data.dontDoChecklist,
                        waifuMode: syncData.data.waifuMode,
                        templateCategories: syncData.data.templateCategories,
                        timeSlotTags: syncData.data.timeSlotTags,
                        autoMessageEnabled: syncData.data.autoMessageEnabled,
                        autoMessageInterval: syncData.data.autoMessageInterval,
                        // Firebase Config는 로컬 값 유지 (없으면 원격 값)
                        firebaseConfig: currentSettings?.firebaseConfig || syncData.data.firebaseConfig,
                    };

                    await db.settings.put({
                        ...mergedSettings,
                        key: 'current'
                    });
                }, 'settings:current');
            }
        });

        console.log('✅ SyncEngine: Listeners started');
    }

    /**
     * 원격 업데이트를 적용할 때 호출합니다.
     * 이 기간 동안 발생하는 Dexie 변경 사항은 Firebase로 다시 동기화되지 않습니다 (루프 방지).
     *
     * @improvement v1.1 - Operation Queue 패턴
     *   - 동일 키에 대한 작업을 직렬화하여 Race Condition 방지
     *   - 대기 중인 작업이 있으면 병합 (마지막 값 우선)
     *   - 타임스탬프로 Split-brain 상황 감지
     *
     * @param callback - 원격 데이터를 로컬 DB에 저장하는 함수
     * @param operationKey - (선택) 동일 리소스에 대한 작업 병합을 위한 키 (예: 'dailyData:2024-01-15')
     */
    public async applyRemoteUpdate(
        callback: () => Promise<void>,
        operationKey?: string
    ) {
        const now = Date.now();
        
        // 키가 제공된 경우, 작업 병합 및 직렬화
        if (operationKey) {
            // 대기 중인 작업이 있으면 최신 작업으로 교체 (병합)
            this.pendingOperations.set(operationKey, {
                callback,
                timestamp: now
            });
            
            // Split-brain 감지: 마지막 동기화 후 100ms 이내면 경고
            const lastSync = this.lastSyncTimestamps.get(operationKey);
            if (lastSync && now - lastSync < 100) {
                console.warn(`⚠️ SyncEngine: Rapid sync detected for ${operationKey} (${now - lastSync}ms gap). Possible concurrent update.`);
            }
        }

        // 큐에 작업 추가 (직렬화)
        this.operationQueue = this.operationQueue.then(async () => {
            // 키가 있는 경우, pendingOperations에서 최신 작업 가져오기
            const operation = operationKey 
                ? this.pendingOperations.get(operationKey)
                : { callback, timestamp: now };
            
            if (!operation) return;
            
            // 실행된 작업은 대기열에서 제거
            if (operationKey) {
                this.pendingOperations.delete(operationKey);
            }

            // 이미 동기화 중이면 콜백만 실행
            if (this.isSyncingFromRemote) {
                await operation.callback();
                return;
            }

            try {
                this.isSyncingFromRemote = true;
                await operation.callback();
                
                // 타임스탬프 기록 (Split-brain 감지용)
                if (operationKey) {
                    this.lastSyncTimestamps.set(operationKey, Date.now());
                }
            } catch (error) {
                console.error('❌ SyncEngine: Remote update failed:', error);
                throw error;
            } finally {
                this.isSyncingFromRemote = false;
            }
        }).catch(err => {
            // 큐 체인 끊김 방지
            console.error('❌ SyncEngine: Operation queue error:', err);
        });

        // 현재 큐가 완료될 때까지 대기
        await this.operationQueue;
    }

    /**
     * 보류 중인 동기화 작업 수를 반환합니다 (디버깅용)
     */
    public getPendingOperationsCount(): number {
        return this.pendingOperations.size;
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

// Helper: group completed tasks by YYYY-MM-DD (from completedAt)
function groupCompletedByDate(tasks: Task[]): Record<string, Task[]> {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach(task => {
        const date = task.completedAt ? task.completedAt.slice(0, 10) : 'unknown';
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(task);
    });
    return grouped;
}
