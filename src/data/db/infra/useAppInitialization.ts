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
 *   - dexieClient: IndexedDB 접근 (이 파일은 infra이므로 직접 접근 허용)
 *   - firebaseService: Firebase 초기화 및 데이터 fetch
 *   - syncEngine: 실시간 동기화 관리
 *   - settingsStore, dailyDataStore, gameStateStore: Zustand 스토어
 * 
 * @note 이 파일은 Dexie에 직접 접근이 필요하므로 src/data/db/infra에 위치합니다.
 */

import { useState, useEffect, useRef } from 'react';
import { initializeDatabase, db } from '../dexieClient';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { useToastStore } from '@/shared/stores/toastStore';
import { initializeFirebase, fetchDataFromFirebase } from '@/shared/services/sync/firebaseService';
import { syncEngine } from './syncEngine';
import { FEATURE_FLAGS } from '@/shared/constants/featureFlags';
import { ragSyncHandler } from './ragSyncHandler';
import { ragService } from '@/shared/services/rag/ragService';
import { runStartupFirebaseInitialRead } from './startupFirebaseSync';

type FirebaseConfigParam = Parameters<typeof initializeFirebase>[0];

const initializeFirebaseFromUnknown = (firebaseConfig: unknown): boolean =>
    initializeFirebase(firebaseConfig as FirebaseConfigParam);

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

                // SyncEngine은 infra entry-point에서만 toast 의존을 주입합니다.
                syncEngine.setOnError((message, errorForLog) => {
                    if (errorForLog) {
                        console.error('[SyncEngine]', errorForLog);
                    }
                    useToastStore.getState().addToast(message, 'error');
                });

                // SyncEngine 초기화 (Hooks 등록)
                syncEngine.initialize();

                // 2. 설정 로드
                const settings = await loadSettings();

                // RAG Sync Handler 초기화 (설정 로드 후 실행하여 API Key 확보)
                ragSyncHandler.initialize();

                // 3. Firebase 초기화 및 데이터 동기화
                if (settings.firebaseConfig) {
                    try {
                        const initialRead = await runStartupFirebaseInitialRead(settings.firebaseConfig, {
                            initializeFirebase: initializeFirebaseFromUnknown,
                        });

                        // BW-01: bulk `get()`/download is skipped; listeners will populate local DB.
                        if (initialRead !== undefined) {
                            // ALL_RTDB_LISTENERS_DISABLED가 true면 리스너 대신 1회 초기 fetch 수행
                            if (FEATURE_FLAGS.ALL_RTDB_LISTENERS_DISABLED) {
                                try {
                                    const firebaseData = await fetchDataFromFirebase();
                                    
                                    // Firebase 데이터를 Dexie에 저장 (syncEngine의 isSyncingFromRemote 플래그 사용)
                                    await syncEngine.applyRemoteUpdate(async () => {
                                        // DailyData
                                        for (const [date, data] of Object.entries(firebaseData.dailyData)) {
                                            await db.dailyData.put({ ...data, date } as never);
                                        }
                                        
                                        // GameState
                                        if (firebaseData.gameState) {
                                            await db.gameState.put({ ...firebaseData.gameState, key: 'current' } as never);
                                        }
                                        
                                        // GlobalInbox
                                        if (firebaseData.globalInbox && firebaseData.globalInbox.length > 0) {
                                            await db.globalInbox.bulkPut(firebaseData.globalInbox as never[]);
                                        }
                                        
                                        // CompletedInbox
                                        for (const tasks of Object.values(firebaseData.completedInbox ?? {})) {
                                            if (tasks.length > 0) {
                                                await db.completedInbox.bulkPut(tasks as never[]);
                                            }
                                        }
                                        
                                        // ShopItems
                                        if (firebaseData.shopItems && firebaseData.shopItems.length > 0) {
                                            await db.shopItems.bulkPut(firebaseData.shopItems as never[]);
                                        }
                                        
                                        // Templates
                                        if (firebaseData.templates && firebaseData.templates.length > 0) {
                                            await db.templates.bulkPut(firebaseData.templates as never[]);
                                        }
                                        
                                        // TokenUsage
                                        for (const [date, usage] of Object.entries(firebaseData.tokenUsage)) {
                                            await db.dailyTokenUsage.put({ ...usage, date } as never);
                                        }
                                        
                                        // Settings (firebaseConfig는 로컬 유지)
                                        if (firebaseData.settings) {
                                            const currentSettings = await db.settings.get('current');
                                            await db.settings.put({
                                                ...firebaseData.settings,
                                                key: 'current',
                                                firebaseConfig: currentSettings?.firebaseConfig,
                                            } as never);
                                        }
                                    }, 'startup:initialFetch');
                                    
                                    console.log('[App Init] Initial Firebase data fetched (listeners disabled)');
                                } catch (fetchError) {
                                    console.warn('[App Init] Initial Firebase fetch failed:', fetchError);
                                }
                            } else {
                                await syncEngine.startListening();

                                // 창 종료 시 리스너 정리(누수 방지)
                                try {
                                    window?.addEventListener('beforeunload', () => {
                                        syncEngine.stopListening();
                                    }, { once: true });
                                } catch {
                                    // ignore
                                }
                            }
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
