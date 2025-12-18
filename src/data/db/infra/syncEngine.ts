/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unified Sync Engine
 *
 * @role Dexie와 Firebase 간의 양방향 자동 동기화를 관리합니다.
 * @responsibilities
 *   - Dexie Hook을 사용하여 로컬 변경 사항을 감지하고 Firebase에 자동 업로드
 *   - Firebase 실시간 리스너로 원격 변경 사항을 로컬에 반영
 *   - Operation Queue 패턴으로 Race Condition 및 Split-brain 방지
 *   - 무한 동기화 루프 방지 메커니즘
 * @dependencies
 *   - dexie: IndexedDB ORM
 *   - firebase/database: Firebase Realtime Database SDK
 *   - syncCore: 제네릭 동기화 코어 로직
 *   - strategies: 데이터 타입별 동기화 전략
 *   - firebaseClient: Firebase 클라이언트 관리
 * @note 이 파일은 Dexie Hook에 직접 접근이 필요하므로 src/data/db/infra에 위치합니다.
 */

import { Table } from 'dexie';
import { syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import {
    dailyDataStrategy,
    gameStateStrategy,
    templateStrategy,
    shopItemsStrategy,
    globalInboxStrategy,
    completedInboxStrategy,
    tokenUsageStrategy,
    settingsStrategy,
} from '@/shared/services/sync/firebase/strategies';
import { db } from '../dexieClient';
import { getFirebaseDatabase, isFirebaseInitialized } from '@/shared/services/sync/firebase/firebaseClient';
import { attachRtdbOnValue } from '@/shared/services/sync/firebase/rtdbListenerRegistry';
import { acquireFirebaseSyncLeaderLock, type FirebaseSyncLeaderHandle } from '@/shared/services/sync/firebase/firebaseSyncLeaderLock';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { getDeviceId } from '@/shared/services/sync/firebase/syncUtils';
import { useToastStore } from '@/shared/stores/toastStore';
import type { Task, DailyTokenUsage } from '@/shared/types/domain';

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

    private isListening = false;
    private listeningUnsubscribes: Array<() => void> = [];
    private leaderHandle: FirebaseSyncLeaderHandle | null = null;

    private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    // Operation Queue: Race Condition 방지
    private operationQueue: Promise<void> = Promise.resolve();
    private pendingOperations: Map<string, QueuedOperation> = new Map();
    
    // Split-brain 감지: 마지막 동기화 타임스탬프 추적
    private lastSyncTimestamps: Map<string, number> = new Map();

    private sanitizeTokenUsage(usage: DailyTokenUsage): DailyTokenUsage {
        const safe = (v: any) => Number.isFinite(v) ? v : 0;
        const prompt = safe(usage.promptTokens);
        const candidates = safe(usage.candidatesTokens);
        const embedding = safe(usage.embeddingTokens);
        const total = safe(usage.totalTokens) || prompt + candidates + embedding;
        const messageCount = safe(usage.messageCount);
        return {
            ...usage,
            promptTokens: prompt,
            candidatesTokens: candidates,
            embeddingTokens: embedding,
            totalTokens: total,
            messageCount,
        };
    }

    private async repairTokenUsage() {
        try {
            const rows = await db.dailyTokenUsage.toArray();
            const repairs = rows.map(async (row) => {
                const sanitized = this.sanitizeTokenUsage(row as DailyTokenUsage);
                if (
                    sanitized.promptTokens !== row.promptTokens ||
                    sanitized.candidatesTokens !== row.candidatesTokens ||
                    sanitized.embeddingTokens !== row.embeddingTokens ||
                    sanitized.totalTokens !== row.totalTokens ||
                    sanitized.messageCount !== row.messageCount
                ) {
                    await db.dailyTokenUsage.put(sanitized as any);
                }
            });
            await Promise.all(repairs);
        } catch (error) {
            console.error('Failed to repair token usage records:', error);
        }
    }

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
    /**
     * Dexie Hook을 등록하여 자동 동기화를 활성화합니다.
     * 각 테이블에 대해 creating, updating, deleting 훅을 등록하여
     * 로컬 변경 시 Firebase로 자동 동기화합니다.
     *
     * @returns {void}
     * @sideEffects
     *   - Dexie 테이블에 훅 등록
     *   - 기존 토큰 사용량 NaN 값 복구
     */
    public initialize(): void {
        if (this.initialized) return;
        this.initialized = true;

        // 기존 토큰 사용량에 NaN이 있으면 정정
        this.repairTokenUsage().catch(console.error);

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

        // 3. Templates (Collection sync) - debounce로 read/write 폭주 완화
        this.registerHooks(db.templates, async () => {
            this.scheduleDebounced('templates:all', 500, async () => {
                const allTemplates = await db.templates.toArray();
                await syncToFirebase(templateStrategy, allTemplates);
            });
        });

        // 4. ShopItems (Collection sync) - debounce
        this.registerHooks(db.shopItems, async () => {
            this.scheduleDebounced('shopItems:all', 500, async () => {
                const allItems = await db.shopItems.toArray();
                await syncToFirebase(shopItemsStrategy, allItems, 'all');
            });
        });

        // 5. GlobalInbox (Collection sync) - debounce
        this.registerHooks(db.globalInbox, async () => {
            this.scheduleDebounced('globalInbox:all', 500, async () => {
                const allTasks = await db.globalInbox.toArray();
                await syncToFirebase(globalInboxStrategy, allTasks);
            });
        });

        // 5-1. CompletedInbox (Collection sync, grouped by completed date) - debounce
        this.registerHooks(db.completedInbox, async () => {
            this.scheduleDebounced('completedInbox:all', 750, async () => {
                const completedTasks = await db.completedInbox.toArray();
                const grouped = groupCompletedByDate(completedTasks);
                const syncPromises = Object.entries(grouped).map(([date, tasks]) =>
                    syncToFirebase(completedInboxStrategy, tasks, date)
                );
                await Promise.all(syncPromises);
            });
        });

        // 6. DailyTokenUsage (Key-based sync)
        this.registerHooks(db.dailyTokenUsage, async (primKey, obj, op) => {
            if (op === 'delete') {
                await syncToFirebase(tokenUsageStrategy, null as any, primKey as string);
            } else {
                const sanitized = this.sanitizeTokenUsage(obj as DailyTokenUsage);
                await syncToFirebase(tokenUsageStrategy, sanitized, primKey as string);
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

    /**
     * Firebase 실시간 리스너를 시작합니다 (Remote -> Local).
     * 각 컬렉션에 대해 onValue 리스너를 등록하여 원격 변경을 감지합니다.
     *
     * @returns {void}
     * @sideEffects
     *   - Firebase onValue 리스너 등록 (8개 컬렉션)
     *   - 원격 변경 시 로컬 Dexie DB 업데이트
     */
    public async startListening(): Promise<void> {
        if (this.isListening) return;

        if (!isFirebaseInitialized()) {
            return;
        }

        // 멀티 윈도우 방지: 1개 렌더러만 RTDB 리스너 활성화
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

        let database;
        try {
            database = getFirebaseDatabase();
        } catch (error) {
            console.warn('[SyncEngine] Firebase database unavailable:', error);
            return;
        }

        const userId = 'user'; // TODO: 실제 유저 ID 사용
        const deviceId = getDeviceId();

        this.isListening = true;
        this.listeningUnsubscribes = [];

        // 1. DailyData Listener
        const dailyPath = `users/${userId}/dailyData`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, dailyPath, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // 각 날짜별로 개별 작업 생성 (Split-brain 방지)
            Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                if (syncData?.deviceId === deviceId) return;

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
        }, { tag: 'SyncEngine.dailyData' }));

        // 2. GameState Listener
        const gameStatePath = `users/${userId}/gameState`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, gameStatePath, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData?.deviceId === deviceId) return;

            if (syncData.data) {
                this.applyRemoteUpdate(async () => {
                    // ✅ 충돌 해결: totalXP가 더 높은 쪽 유지 (새로고침 시 XP 초기화 방지)
                    const localGameState = await db.gameState.get('current');
                    const localTotalXP = localGameState?.totalXP ?? 0;
                    const remoteTotalXP = syncData.data.totalXP ?? 0;

                    // 로컬 XP가 더 높으면 원격 데이터 무시 (FocusView bonusXP 보호)
                    if (localTotalXP > remoteTotalXP) {
                        console.log(`[SyncEngine] 🛡️ Skipping remote GameState (local XP: ${localTotalXP} > remote XP: ${remoteTotalXP})`);
                        return;
                    }

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
        }, { tag: 'SyncEngine.gameState' }));

        // 3. Templates Listener
        const templatesPath = `users/${userId}/templates`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, templatesPath, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData?.deviceId === deviceId) return;

            if (Array.isArray(syncData.data)) {
                this.applyRemoteUpdate(async () => {
                    await db.templates.clear();
                    await db.templates.bulkPut(syncData.data);
                }, 'templates:all');
            }
        }, { tag: 'SyncEngine.templates' }));

        // 4. ShopItems Listener
        const shopItemsPath = `users/${userId}/shopItems`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, shopItemsPath, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData?.deviceId === deviceId) return;

            if (Array.isArray(syncData.data)) {
                this.applyRemoteUpdate(async () => {
                    await db.shopItems.clear();
                    await db.shopItems.bulkPut(syncData.data);
                }, 'shopItems:all');
            }
        }, { tag: 'SyncEngine.shopItems' }));

        // 5. GlobalInbox Listener
        const globalInboxPath = `users/${userId}/globalInbox`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, globalInboxPath, (snapshot) => {
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
        }, { tag: 'SyncEngine.globalInbox' }));

        // 5-1. CompletedInbox Listener (date-keyed)
        const completedInboxPath = `users/${userId}/completedInbox`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, completedInboxPath, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            this.applyRemoteUpdate(async () => {
                const existing = await db.completedInbox.toArray();
                const map = new Map<string, Task>(existing.map(task => [task.id, task]));

                Object.entries<any>(data).forEach(([_, syncData]) => {
                    if (!syncData || syncData?.deviceId === deviceId) return;
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
        }, { tag: 'SyncEngine.completedInbox' }));

        // 6. TokenUsage Listener
        const tokenUsagePath = `users/${userId}/tokenUsage`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, tokenUsagePath, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // 각 날짜별로 개별 작업 생성
            Object.entries(data).forEach(([date, syncData]: [string, any]) => {
                if (syncData?.deviceId === deviceId) return;

                this.applyRemoteUpdate(async () => {
                    if (syncData.data) {
                        const sanitized = this.sanitizeTokenUsage(syncData.data as DailyTokenUsage);
                        await db.dailyTokenUsage.put({
                            ...sanitized,
                            date
                        });
                    } else if (syncData.data === null) {
                        await db.dailyTokenUsage.delete(date);
                    }
                }, `tokenUsage:${date}`);
            });
        }, { tag: 'SyncEngine.tokenUsage' }));

        // 8. Settings Listener
        const settingsPath = `users/${userId}/settings`;
        this.listeningUnsubscribes.push(attachRtdbOnValue(database, settingsPath, (snapshot) => {
            const syncData = snapshot.val();
            if (!syncData || syncData?.deviceId === deviceId) return;

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
        }, { tag: 'SyncEngine.settings' }));

        addSyncLog('firebase', 'info', 'RTDB listeners started', {
            active: this.listeningUnsubscribes.length,
            instanceId: this.leaderHandle?.instanceId,
        });
    }

    /**
     * Firebase 실시간 리스너를 중지합니다.
     * - 설정 변경/재초기화/창 종료 시 누수 방지
     */
    public stopListening(): void {
        // debounce 타이머 정리
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        for (const unsubscribe of this.listeningUnsubscribes) {
            try {
                unsubscribe();
            } catch (error) {
                console.warn('[SyncEngine] Failed to unsubscribe listener:', error);
            }
        }
        this.listeningUnsubscribes = [];
        this.isListening = false;

        this.leaderHandle?.release();
        this.leaderHandle = null;

        addSyncLog('firebase', 'info', 'RTDB listeners stopped');
    }

    private scheduleDebounced(key: string, delayMs: number, fn: () => Promise<void>): void {
        const existing = this.debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            fn().catch((error) => {
                console.error(`[SyncEngine] Debounced sync failed (${key}):`, error);
                useToastStore.getState().addToast(`동기화 실패: ${key}`, 'error');
            });
        }, delayMs);

        this.debounceTimers.set(key, timer);
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
        }).catch(syncError => {
            // 큐 체인 끊김 방지
            console.error('❌ SyncEngine: Operation queue error:', syncError);
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
                onChanged(primKey, obj, 'create').catch(hookError => {
                    console.error(`Sync failed for ${table.name}:`, hookError);
                    useToastStore.getState().addToast(`동기화 실패 (${table.name}): ${hookError.message}`, 'error');
                });
            });
        });

        // Updating
        table.hook('updating', (modifications, primKey, obj, transaction) => {
            if (this.isSyncingFromRemote) return;
            const updatedObj = { ...obj, ...modifications } as T;
            transaction.on('complete', () => {
                onChanged(primKey, updatedObj, 'update').catch(hookError => {
                    console.error(`Sync failed for ${table.name}:`, hookError);
                    useToastStore.getState().addToast(`동기화 실패 (${table.name}): ${hookError.message}`, 'error');
                });
            });
        });

        // Deleting
        table.hook('deleting', (primKey, obj, transaction) => {
            if (this.isSyncingFromRemote) return;
            transaction.on('complete', () => {
                onChanged(primKey, obj, 'delete').catch(hookError => {
                    console.error(`Sync failed for ${table.name}:`, hookError);
                    useToastStore.getState().addToast(`동기화 실패 (${table.name}): ${hookError.message}`, 'error');
                });
            });
        });
    }
}

export const syncEngine = SyncEngine.getInstance();

/**
 * 완료된 작업을 완료 날짜(YYYY-MM-DD)별로 그룹화합니다.
 *
 * @param {Task[]} tasks - 그룹화할 작업 배열
 * @returns {Record<string, Task[]>} 날짜별로 그룹화된 작업 객체
 */
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
