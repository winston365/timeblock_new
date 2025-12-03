/**
 * useAppInitialization Hook
 *
 * @file useAppInitialization.ts
 * @role 애플리케이션 초기화 오케스트레이션
 * @responsibilities
 *   - IndexedDB(Dexie) 초기화
 *   - 설정 로드 및 Firebase 연결
 *   - Firebase ↔ Dexie 양방향 데이터 동기화
 *   - Zustand 스토어 초기 데이터 로드
 *   - RAG/SyncEngine 서비스 부트스트랩
 * @dependencies
 *   - dexieClient: IndexedDB 접근
 *   - firebaseService: Firebase 초기화 및 데이터 fetch
 *   - syncEngine: 실시간 동기화 관리
 *   - settingsStore, dailyDataStore, gameStateStore: Zustand 스토어
 */

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
import { ragSyncHandler } from '@/shared/services/rag/ragSyncHandler';
import { ragService } from '@/shared/services/rag/ragService';
import type { GameState } from '@/shared/types/domain';

/**
 * 애플리케이션 초기화 훅
 *
 * DB 초기화, 설정 로드, Firebase 연결, 초기 데이터 로드 및 저장을 수행합니다.
 * 앱 시작 시 한 번만 실행되며, 모든 필수 서비스와 데이터를 준비합니다.
 *
 * @returns 초기화 상태 객체
 * @returns {boolean} returns.isInitialized - 초기화 완료 여부
 * @returns {Error | null} returns.error - 초기화 중 발생한 에러 (없으면 null)
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
                // 1. IndexedDB 초기화
                await initializeDatabase();

                // SyncEngine 초기화 (Hooks 등록)
                syncEngine.initialize();

                // 2. 설정 로드
                const settings = await loadSettings();

                // RAG Sync Handler 초기화 (설정 로드 후 실행하여 API Key 확보)
                ragSyncHandler.initialize();

                // 3. Firebase 초기화 및 데이터 동기화
                if (settings.firebaseConfig) {
                    try {
                        const firebaseInitialized = initializeFirebase(settings.firebaseConfig);
                        if (firebaseInitialized) {
                            // 초기 데이터 가져오기
                            const firebaseData = await fetchDataFromFirebase();

                            // --- 데이터 병합 및 저장 로직 (Dexie Only) ---
                            // SyncEngine.applyRemoteUpdate를 사용하여 훅 트리거 방지

                            await syncEngine.applyRemoteUpdate(async () => {
                                // 3.1 GameState 처리
                                const localGameStateEntry = await db.gameState.get('current');
                                const localGameState = localGameStateEntry
                                    ? (() => {
                                        // Extract gameState data, excluding internal key property
                                        const { key: _internalKey, ...gameStateData } = localGameStateEntry as GameState & { key: string };
                                        void _internalKey; // Intentionally unused - just for destructuring
                                        return gameStateData as GameState;
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
                                    const dailyDataUpdatePromises: Promise<unknown>[] = [];
                                    for (const date of dailyDataDates) {
                                        const remoteDailyEntry = firebaseData.dailyData[date];
                                        if (!remoteDailyEntry || !Array.isArray(remoteDailyEntry.tasks)) {
                                            continue;
                                        }

                                        dailyDataUpdatePromises.push((async () => {
                                            const existingDailyEntry = await db.dailyData.get(date);
                                            const remoteUpdatedAt = remoteDailyEntry.updatedAt ?? 0;
                                            const localUpdatedAt = existingDailyEntry?.updatedAt ?? 0;

                                            const mergedStates = {
                                                ...(existingDailyEntry?.timeBlockStates || {}),
                                                ...(remoteDailyEntry.timeBlockStates || {}),
                                            };

                                            if (!existingDailyEntry || remoteUpdatedAt > localUpdatedAt) {
                                                await db.dailyData.put({
                                                    date,
                                                    tasks: remoteDailyEntry.tasks,
                                                    goals: remoteDailyEntry.goals || [],
                                                    timeBlockStates: mergedStates,
                                                    updatedAt: remoteUpdatedAt || Date.now(),
                                                });
                                            } else if (remoteUpdatedAt < localUpdatedAt) {
                                                syncToFirebase(dailyDataStrategy, {
                                                    tasks: existingDailyEntry.tasks || [],
                                                    goals: existingDailyEntry.goals || [],
                                                    timeBlockStates: existingDailyEntry.timeBlockStates || {},
                                                    updatedAt: existingDailyEntry.updatedAt || Date.now(),
                                                }, date).catch(console.error);
                                            }
                                        })());
                                    }
                                    await Promise.all(dailyDataUpdatePromises);
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

                                // 3.4 ShopItems 저장
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
                                    const tokenUsageUpdatePromises: Promise<unknown>[] = [];
                                    for (const tokenDate of tokenDates) {
                                        const tokenUsageEntry = firebaseData.tokenUsage[tokenDate];
                                        if (tokenUsageEntry) {
                                            tokenUsageUpdatePromises.push(db.dailyTokenUsage.put({
                                                ...tokenUsageEntry,
                                                date: tokenDate
                                            }));
                                        }
                                    }
                                    await Promise.all(tokenUsageUpdatePromises);
                                }

                                // 3.9 GlobalGoals 저장
                                if (firebaseData.globalGoals && Array.isArray(firebaseData.globalGoals)) {
                                    await db.globalGoals.clear();
                                    if (firebaseData.globalGoals.length > 0) {
                                        await db.globalGoals.bulkAdd(firebaseData.globalGoals);
                                    }
                                }

                                // 3.10 Settings 저장 (병합 - 최신 updatedAt 우선)
                                if (firebaseData.settings) {
                                    const currentSettings = await db.settings.get('current');
                                    const remoteUpdatedAt = firebaseData.settings.updatedAt ?? 0;
                                    const localUpdatedAt = currentSettings?.updatedAt ?? 0;

                                    const takeRemote = remoteUpdatedAt > localUpdatedAt && firebaseData.settings;
                                    const mergedSettings = takeRemote
                                        ? { ...currentSettings, ...firebaseData.settings, firebaseConfig: currentSettings?.firebaseConfig || firebaseData.settings.firebaseConfig }
                                        : { ...firebaseData.settings, ...currentSettings };

                                    await db.settings.put({
                                        key: 'current',
                                        ...mergedSettings
                                    });
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
                //    ⚠️ Settings는 초기 로드 이후 Firebase 병합 결과를 반영하기 위해 다시 로드한다.
                await Promise.all([
                    loadSettings(), // refresh settings so Firebase-merged values reach the UI
                    loadDailyData(),
                    loadGameState(),
                ]);

                setIsInitialized(true);

                // Expose RAG for debugging (개발 환경에서 window.rag, window.hybridRag로 접근 가능)
                const windowWithDebug = window as Window & { rag?: typeof ragService; hybridRag?: unknown };
                windowWithDebug.rag = ragService;
                windowWithDebug.hybridRag = (await import('@/shared/services/rag/hybridRAGService')).hybridRAGService;

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
