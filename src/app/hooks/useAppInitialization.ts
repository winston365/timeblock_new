import { useState, useEffect, useRef } from 'react';
import { initializeDatabase, db } from '@/data/db/dexieClient';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { initializeFirebase, fetchDataFromFirebase } from '@/shared/services/sync/firebaseService';
import { saveGameState } from '@/data/repositories/gameStateRepository';
import { syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { dailyDataStrategy, gameStateStrategy } from '@/shared/services/sync/firebase/strategies';
import { syncEngine } from '@/shared/services/sync/syncEngine';
import type { GameState } from '@/shared/types/domain';

/**
 * 애플리케이션 초기화 훅
 *
 * @role DB 초기화, 설정 로드, Firebase 연결, 초기 데이터 로드 및 저장을 수행합니다.
 * @returns {Object} 초기화 상태 및 에러
 */
export function useAppInitialization() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const initRef = useRef(false);

    // Stores
    const { loadData: loadSettings } = useSettingsStore();
    const { loadData: loadDailyData } = useDailyDataStore();
    const { loadData: loadGameState } = useGameStateStore();

    useEffect(() => {
        const initApp = async () => {
            if (initRef.current) return;
            initRef.current = true;

            try {
                console.log('Initializing application...');

                // 1. IndexedDB 초기화
                await initializeDatabase();
                console.log('Database initialized');

                // SyncEngine 초기화 (Hooks 등록)
                syncEngine.initialize();

                // 2. 설정 로드
                const settings = await loadSettings();
                console.log('Settings loaded');

                // 3. Firebase 초기화 및 데이터 동기화
                if (settings.firebaseConfig) {
                    try {
                        const initialized = initializeFirebase(settings.firebaseConfig);
                        if (initialized) {
                            console.log('Firebase initialized');

                            // 초기 데이터 가져오기
                            console.log('Fetching data from Firebase...');
                            const firebaseData = await fetchDataFromFirebase();

                            // --- 데이터 병합 및 저장 로직 (Dexie Only) ---
                            // SyncEngine.applyRemoteUpdate를 사용하여 훅 트리거 방지

                            await syncEngine.applyRemoteUpdate(async () => {
                                // 3.1 GameState 처리
                                const localGameStateEntry = await db.gameState.get('current');
                                const localGameState = localGameStateEntry
                                    ? (() => {
                                        const { key: _key, ...rest } = localGameStateEntry as GameState & { key: string };
                                        return rest as GameState;
                                    })()
                                    : null;

                                let shouldUploadLocalGameState = false;

                                if (firebaseData.gameState) {
                                    const remoteGameState = firebaseData.gameState;
                                    if (!localGameState) {
                                        await saveGameState(remoteGameState);
                                    } else {
                                        // 간단한 충돌 해결: XP가 더 높은 쪽 선택
                                        const localTotalXP = localGameState.totalXP ?? 0;
                                        const remoteTotalXP = remoteGameState.totalXP ?? 0;

                                        if (remoteTotalXP > localTotalXP) {
                                            await saveGameState(remoteGameState);
                                        } else if (localTotalXP > remoteTotalXP) {
                                            shouldUploadLocalGameState = true;
                                        }
                                    }
                                } else if (localGameState) {
                                    shouldUploadLocalGameState = true;
                                }

                                // 3.2 DailyData 저장
                                const dailyDataDates = Object.keys(firebaseData.dailyData);
                                if (dailyDataDates.length > 0) {
                                    const updates: Promise<any>[] = [];
                                    for (const date of dailyDataDates) {
                                        const data = firebaseData.dailyData[date];
                                        if (!data || !Array.isArray(data.tasks)) {
                                            continue;
                                        }

                                        updates.push((async () => {
                                            const existing = await db.dailyData.get(date);
                                            const remoteUpdatedAt = data.updatedAt ?? 0;
                                            const localUpdatedAt = existing?.updatedAt ?? 0;

                                            const mergedStates = {
                                                ...(existing?.timeBlockStates || {}),
                                                ...(data.timeBlockStates || {}),
                                            };

                                            if (!existing || remoteUpdatedAt > localUpdatedAt) {
                                                await db.dailyData.put({
                                                    date,
                                                    tasks: data.tasks,
                                                    goals: data.goals || [],
                                                    timeBlockStates: mergedStates,
                                                    updatedAt: remoteUpdatedAt || Date.now(),
                                                });
                                            } else if (remoteUpdatedAt < localUpdatedAt) {
                                                syncToFirebase(dailyDataStrategy, {
                                                    tasks: existing.tasks || [],
                                                    goals: existing.goals || [],
                                                    timeBlockStates: existing.timeBlockStates || {},
                                                    updatedAt: existing.updatedAt || Date.now(),
                                                }, date).catch(console.error);
                                            }
                                        })());
                                    }
                                    await Promise.all(updates);
                                }

                                // 3.3 GlobalInbox 저장
                                if (firebaseData.globalInbox && Array.isArray(firebaseData.globalInbox)) {
                                    await db.globalInbox.clear();
                                    if (firebaseData.globalInbox.length > 0) {
                                        await db.globalInbox.bulkAdd(firebaseData.globalInbox);
                                    }
                                }

                                // 3.3-1 CompletedInbox 저장 (date-keyed)
                                if (firebaseData.completedInbox) {
                                    await db.completedInbox.clear();
                                    const completedTasks = Object.values(firebaseData.completedInbox).flat();
                                    if (completedTasks.length > 0) {
                                        await db.completedInbox.bulkAdd(completedTasks);
                                    }
                                }

                                // 3.4 EnergyLevels 저장
                                if (firebaseData.energyLevels) {
                                    const energyDates = Object.keys(firebaseData.energyLevels);
                                    const updates: Promise<any>[] = [];
                                    for (const date of energyDates) {
                                        const levels = firebaseData.energyLevels[date];
                                        if (Array.isArray(levels) && levels.length > 0) {
                                            updates.push(
                                                db.energyLevels.where('date').equals(date).delete().then(() => {
                                                    const levelsWithId = levels.map(level => ({
                                                        ...level,
                                                        id: `${date}_${level.timestamp}`,
                                                        date,
                                                    }));

                                                    // 중복 제거 (ID 기준)
                                                    const uniqueLevels = Array.from(
                                                        new Map(levelsWithId.map((item: any) => [item.id, item])).values()
                                                    );

                                                    return db.energyLevels.bulkPut(uniqueLevels);
                                                })
                                            );
                                        }
                                    }
                                    await Promise.all(updates);
                                }

                                // 3.5 ShopItems 저장
                                if (firebaseData.shopItems && Array.isArray(firebaseData.shopItems)) {
                                    await db.shopItems.clear();
                                    if (firebaseData.shopItems.length > 0) {
                                        await db.shopItems.bulkAdd(firebaseData.shopItems);
                                    }
                                }

                                // 3.6 WaifuState 저장
                                if (firebaseData.waifuState) {
                                    await db.waifuState.put({
                                        key: 'current',
                                        ...firebaseData.waifuState,
                                    });
                                }

                                // 3.7 Templates 저장
                                if (firebaseData.templates && Array.isArray(firebaseData.templates)) {
                                    await db.templates.clear();
                                    if (firebaseData.templates.length > 0) {
                                        await db.templates.bulkAdd(firebaseData.templates);
                                    }
                                }

                                // 3.8 TokenUsage 저장
                                if (firebaseData.tokenUsage) {
                                    const tokenDates = Object.keys(firebaseData.tokenUsage);
                                    const updates: Promise<any>[] = [];
                                    for (const date of tokenDates) {
                                        const data = firebaseData.tokenUsage[date];
                                        if (data) {
                                            updates.push(db.dailyTokenUsage.put({
                                                ...data,
                                                date
                                            }));
                                        }
                                    }
                                    await Promise.all(updates);
                                }

                                // --- 로컬 데이터 업로드 (Firebase에 없는 경우) ---
                                // 이 부분은 applyRemoteUpdate 내부일 필요는 없지만, 
                                // 로컬 데이터를 읽어서 Firebase로 보내는 것이므로 Hook과는 무관함 (쓰기가 아님).
                                // 하지만 위에서 shouldUploadLocalGameState를 계산했으므로 여기서 처리.

                                const allLocalDailyData = await db.dailyData.toArray();
                                const firebaseDates = new Set(Object.keys(firebaseData.dailyData));

                                for (const localData of allLocalDailyData) {
                                    if (!firebaseDates.has(localData.date)) {
                                        // 비동기로 실행 (await 안함)
                                        syncToFirebase(dailyDataStrategy, {
                                            tasks: localData.tasks || [],
                                            goals: localData.goals || [],
                                            timeBlockStates: localData.timeBlockStates || {},
                                            updatedAt: localData.updatedAt || Date.now(),
                                        }, localData.date).catch(console.error);
                                    }
                                }

                                if (shouldUploadLocalGameState && localGameState) {
                                    syncToFirebase(gameStateStrategy, localGameState).catch(console.error);
                                }
                            });

                            // 실시간 동기화 활성화 (SyncEngine이 담당)
                            syncEngine.startListening();
                        }
                    } catch (firebaseError) {
                        console.warn('Firebase initialization failed (offline mode):', firebaseError);
                    }
                }

                // 4. 스토어 데이터 로드 (IndexedDB -> Store)
                await Promise.all([
                    loadDailyData(),
                    loadGameState(),
                ]);
                console.log('All stores loaded');

                setIsInitialized(true);
            } catch (err) {
                console.error('Application initialization failed:', err);
                setError(err as Error);
                setIsInitialized(true);
            }
        };

        initApp();
    }, [loadSettings, loadDailyData, loadGameState]);

    return { isInitialized, error };
}
