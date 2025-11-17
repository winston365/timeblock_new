/**
 * AppShell - 앱 전체 레이아웃 및 상태 관리
 *
 * @role 앱의 최상위 컴포넌트로 레이아웃 구성, DB 초기화, Firebase 동기화, 전역 상태 관리 담당
 * @input 없음 (최상위 컴포넌트)
 * @output 앱 전체 UI (Toolbar, Sidebar, Content, Panels, Modals)
 * @dependencies 각종 feature 컴포넌트, hooks, stores, services
 */

import { useState, useEffect } from 'react';
import { useGameState } from '@/shared/hooks';
import { initializeDatabase } from '@/data/db/dexieClient';
import { createTaskFromTemplate } from '@/data/repositories/templateRepository';
import { loadSettings } from '@/data/repositories/settingsRepository';
import { getLocalDate } from '@/shared/lib/utils';
import {
  initializeFirebase,
  enableFirebaseSync
} from '@/shared/services/firebaseService';
import { exposeDebugToWindow } from '@/shared/services/firebase/firebaseDebug';
import type { Template, Task } from '@/shared/types/domain';
import { useXPToastStore } from '@/shared/hooks/useXPToast';
import XPToast from '@/shared/components/XPToast';
import SyncErrorToast from '@/shared/components/SyncErrorToast';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { setErrorCallback, retryNow } from '@/shared/services/firebase/syncRetryQueue';

// 임시로 컴포넌트를 직접 import (나중에 features에서 가져올 것)
import TopToolbar from './components/TopToolbar';
import LeftSidebar from './components/LeftSidebar';
import CenterContent from './components/CenterContent';
import RightPanel from './components/RightPanel';
import WaifuPanel from '@/features/waifu/WaifuPanel';
import GeminiFullscreenChat from '@/features/gemini/GeminiFullscreenChat';
import BulkAddModal from '@/features/tasks/BulkAddModal';
import SettingsModal from '@/features/settings/SettingsModal';
import InsightPanel from '@/features/insight/InsightPanel';
import TemplatesModal from '@/features/template/TemplatesModal';

/**
 * 앱 셸 컴포넌트 - 전체 앱 레이아웃 및 초기화
 * @returns 앱 전체 UI
 */
interface SyncErrorToastData {
  id: string;
  collection: string;
  message: string;
  canRetry: boolean;
  retryId?: string;
}

export default function AppShell() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'energy' | 'completed' | 'inbox'>('today');
  const [rightPanelTab, setRightPanelTab] = useState<'quest' | 'shop'>('quest');
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [syncErrorToasts, setSyncErrorToasts] = useState<SyncErrorToastData[]>([]);

  // 패널 접힘 상태 (기본값: 펼침)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('leftSidebarCollapsed');
    return saved === 'true';
  });
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(() => {
    const saved = localStorage.getItem('rightPanelsCollapsed');
    return saved === 'true';
  });

  const { gameState, updateQuestProgress } = useGameState();
  const { toasts, removeToast } = useXPToastStore();
  const { visibility } = useWaifuCompanionStore();

  // 패널 토글 핸들러
  const toggleLeftSidebar = () => {
    setLeftSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('leftSidebarCollapsed', String(newValue));
      return newValue;
    });
  };

  const toggleRightPanels = () => {
    setRightPanelsCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('rightPanelsCollapsed', String(newValue));
      return newValue;
    });
  };

  // 동기화 에러 콜백 설정
  useEffect(() => {
    setErrorCallback((collection, message, canRetry) => {
      const toastId = `sync-error-${Date.now()}-${Math.random()}`;
      setSyncErrorToasts((prev: SyncErrorToastData[]) => [
        ...prev,
        {
          id: toastId,
          collection,
          message,
          canRetry,
          retryId: canRetry ? `${collection}-retry-${Date.now()}` : undefined,
        },
      ]);
    });
  }, []);

  // 동기화 에러 토스트 제거
  const removeSyncErrorToast = (id: string) => {
    setSyncErrorToasts((prev: SyncErrorToastData[]) => prev.filter((toast: SyncErrorToastData) => toast.id !== id));
  };

  // 동기화 재시도 핸들러
  const handleSyncRetry = async (retryId: string | undefined) => {
    if (!retryId) return;

    try {
      await retryNow(retryId);
    } catch (error) {
      console.error('Failed to retry sync:', error);
    }
  };

  // DB 초기화 및 Firebase 설정
  useEffect(() => {
    let isSubscribed = true;

    const initDB = async () => {
      try {
        await initializeDatabase();

        // ✅ STEP 1: Settings 및 Firebase 먼저 초기화 (Store 로드 전!)
        console.log('🔧 Loading settings and initializing Firebase...');
        const settings = await loadSettings();

        let firebaseReady = false;

        // ✅ STEP 2: Firebase 초기화 및 데이터 가져오기 (Store 로드 전!)
        if (settings.firebaseConfig) {
          const initialized = initializeFirebase(settings.firebaseConfig);
          if (initialized) {
            console.log('✅ Firebase initialized');
            firebaseReady = true;

            // Firebase에서 초기 데이터 가져오기
            try {
              const { fetchDataFromFirebase } = await import('@/shared/services/firebaseService');
              const { saveGameState } = await import('@/data/repositories/gameStateRepository');
              const { db } = await import('@/data/db/dexieClient');
              const { saveToStorage } = await import('@/shared/lib/utils');
              const { STORAGE_KEYS } = await import('@/shared/lib/constants');
              const { syncToFirebase } = await import('@/shared/services/firebase/syncCore');
              const { dailyDataStrategy, gameStateStrategy } = await import('@/shared/services/firebase/strategies');

              console.log('📥 Fetching data from Firebase...');
              const firebaseData = await fetchDataFromFirebase();

              // GameState 저장
              if (firebaseData.gameState) {
                console.log('💾 Saving GameState from Firebase');
                await saveGameState(firebaseData.gameState);
              }

              // DailyData 저장 (모든 날짜)
              const dailyDataDates = Object.keys(firebaseData.dailyData);
              if (dailyDataDates.length > 0) {
                console.log(`💾 Saving ${dailyDataDates.length} days of data from Firebase`);
                for (const date of dailyDataDates) {
                  const data = firebaseData.dailyData[date];

                  if (!data || !data.tasks) {
                    console.warn(`⚠️ Invalid data for ${date}, skipping`);
                    continue;
                  }

                  await db.dailyData.put({
                    date,
                    tasks: data.tasks,
                    goals: data.goals || [],
                    timeBlockStates: data.timeBlockStates || {},
                    updatedAt: data.updatedAt || Date.now(),
                  });

                  saveToStorage(`${STORAGE_KEYS.DAILY_PLANS}${date}`, data);
                }
              }

              // ✅ GlobalInbox 저장
              if (firebaseData.globalInbox && Array.isArray(firebaseData.globalInbox)) {
                console.log(`💾 Saving ${firebaseData.globalInbox.length} inbox tasks from Firebase`);
                await db.globalInbox.clear();
                if (firebaseData.globalInbox.length > 0) {
                  await db.globalInbox.bulkAdd(firebaseData.globalInbox);
                }
              }

              // ✅ EnergyLevels 저장 (모든 날짜)
              if (firebaseData.energyLevels) {
                const energyDates = Object.keys(firebaseData.energyLevels);
                if (energyDates.length > 0) {
                  console.log(`💾 Saving energy levels for ${energyDates.length} days from Firebase`);
                  for (const date of energyDates) {
                    const levels = firebaseData.energyLevels[date];
                    if (Array.isArray(levels) && levels.length > 0) {
                      // 기존 데이터 삭제
                      await db.energyLevels.where('date').equals(date).delete();
                      // 새 데이터 저장
                      const levelsWithId = levels.map(level => ({
                        ...level,
                        id: `${date}_${level.timestamp}`,
                        date,
                      }));
                      await db.energyLevels.bulkAdd(levelsWithId);
                      localStorage.setItem(`energyLevels_${date}`, JSON.stringify(levels));
                    }
                  }
                }
              }

              // ✅ ShopItems 저장
              if (firebaseData.shopItems && Array.isArray(firebaseData.shopItems)) {
                console.log(`💾 Saving ${firebaseData.shopItems.length} shop items from Firebase`);
                await db.shopItems.clear();
                if (firebaseData.shopItems.length > 0) {
                  await db.shopItems.bulkAdd(firebaseData.shopItems);
                }
                saveToStorage(STORAGE_KEYS.SHOP_ITEMS, firebaseData.shopItems);
              }

              // ✅ WaifuState 저장
              if (firebaseData.waifuState) {
                console.log('💾 Saving WaifuState from Firebase');
                await db.waifuState.put({
                  key: 'current',
                  ...firebaseData.waifuState,
                });
                saveToStorage(STORAGE_KEYS.WAIFU_STATE, firebaseData.waifuState);
              }

              // ✅ Templates 저장
              if (firebaseData.templates && Array.isArray(firebaseData.templates)) {
                console.log(`💾 Saving ${firebaseData.templates.length} templates from Firebase`);
                await db.templates.clear();
                if (firebaseData.templates.length > 0) {
                  await db.templates.bulkAdd(firebaseData.templates);
                }
                saveToStorage(STORAGE_KEYS.TEMPLATES, firebaseData.templates);
              }

              // 로컬 데이터를 Firebase로 업로드 (Firebase에 없는 것만)
              const allLocalDailyData = await db.dailyData.toArray();
              const firebaseDates = new Set(Object.keys(firebaseData.dailyData));

              for (const localData of allLocalDailyData) {
                if (firebaseDates.has(localData.date)) continue;

                try {
                  await syncToFirebase(dailyDataStrategy, {
                    tasks: localData.tasks || [],
                    goals: localData.goals || [],
                    timeBlockStates: localData.timeBlockStates || {},
                    updatedAt: localData.updatedAt || Date.now(),
                  }, localData.date);
                } catch (syncError) {
                  console.error(`❌ Failed to upload ${localData.date}:`, syncError);
                }
              }

              // GameState 동기화
              if (!firebaseData.gameState) {
                const localGameState = await db.gameState.get('current');
                if (localGameState) {
                  const { key, ...gameStateData } = localGameState;
                  try {
                    await syncToFirebase(gameStateStrategy, gameStateData);
                  } catch (syncError) {
                    console.error('❌ Failed to upload GameState:', syncError);
                  }
                }
              }

              console.log('✅ Firebase data sync completed');
            } catch (error) {
              console.error('❌ Failed to fetch from Firebase:', error);
            }
          } else {
            console.warn('⚠️ Firebase initialization failed, working offline');
          }
        } else {
          console.log('ℹ️ No Firebase config, working offline');
        }

        if (!isSubscribed) return;

        // ✅ STEP 3: Store 로드 (이제 IndexedDB에 Firebase 데이터가 있음)
        console.log('📦 Loading stores from IndexedDB...');
        const dailyDataStore = useDailyDataStore.getState();
        const gameStateStore = useGameStateStore.getState();

        await Promise.all([
          dailyDataStore.loadData(),
          gameStateStore.loadData(),
        ]);

        console.log('✅ Stores loaded');

        if (!isSubscribed) return;

        // ✅ STEP 4: 모든 데이터 로드 후 UI 표시
        setDbInitialized(true);

        // 디버그 함수를 window에 노출
        exposeDebugToWindow();

        // ✅ STEP 5: Firebase 실시간 동기화 활성화
        if (firebaseReady) {
          const unsubscribe = enableFirebaseSync(
            async () => {
              await dailyDataStore.refresh();
            },
            async () => {
              await gameStateStore.refresh();
            }
          );

          // 컴포넌트 언마운트 시 동기화 해제
          return () => {
            isSubscribed = false;
            unsubscribe();
          };
        }
      } catch (error) {
        console.error('❌ Failed to initialize:', error);
        if (isSubscribed) {
          // 에러가 발생해도 UI는 표시 (데이터 없이)
          setDbInitialized(true);
        }
      }
    };

    initDB();

    return () => {
      isSubscribed = false;
    };
  }, []); // 빈 배열 - 한 번만 실행

  // F1 단축키: 대량 할 일 추가 모달 열기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowBulkAdd(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 템플릿에서 작업 생성 핸들러
  const handleTaskCreateFromTemplate = async (template: Template) => {
    try {
      const task = createTaskFromTemplate(template);
      const dailyDataStore = useDailyDataStore.getState();
      await dailyDataStore.addTask(task);

      // 준비된 작업이면 퀘스트 진행
      const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);
      if (isPrepared) {
        await updateQuestProgress('prepare_tasks', 1);
      }

      alert(`"${template.name}" 템플릿에서 작업이 추가되었습니다!`);
    } catch (error) {
      console.error('Failed to create task from template:', error);
      alert('작업 추가에 실패했습니다.');
    }
  };

  // 상점 구매 성공 핸들러 (와이푸 메시지 표시용)
  const handleShopPurchaseSuccess = (_message: string, waifuMessage?: string) => {
    if (waifuMessage) {
      // TODO: 와이푸에게 메시지를 전달하는 로직 추가
    }
  };

  // 대량 작업 추가 핸들러
  const handleBulkAddTasks = async (tasks: Task[]) => {
    try {
      const dailyDataStore = useDailyDataStore.getState();
      for (const task of tasks) {
        await dailyDataStore.addTask(task);
      }
    } catch (error) {
      console.error('Failed to add tasks:', error);
      throw error;
    }
  };

  if (!dbInitialized) {
    return (
      <div
        className="app-container"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
        role="status"
        aria-live="polite"
        aria-label="애플리케이션 로딩 중"
      >
        <div>
          <div>데이터베이스 초기화 중...</div>
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
            개발자 도구(F12)의 콘솔을 확인해주세요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 접근성: 건너뛰기 링크 */}
      <a href="#main-content" className="skip-to-content">
        메인 콘텐츠로 건너뛰기
      </a>

      {/* 상단 툴바 */}
      <TopToolbar
        gameState={gameState}
        onOpenGeminiChat={() => setShowGeminiChat(true)}
        onOpenTemplates={() => setShowTemplates(true)}
      />

      {/* 메인 레이아웃 */}
      <main
        className={`main-layout ${leftSidebarCollapsed ? 'left-collapsed' : ''} ${rightPanelsCollapsed ? 'right-collapsed' : ''}`}
      >
        {/* 좌측 토글 버튼 (항상 표시) */}
        <button
          className={`panel-toggle-btn left-toggle ${leftSidebarCollapsed ? 'collapsed' : ''}`}
          onClick={toggleLeftSidebar}
          title={leftSidebarCollapsed ? '좌측 패널 펼치기' : '좌측 패널 접기'}
          aria-label={leftSidebarCollapsed ? '좌측 패널 펼치기' : '좌측 패널 접기'}
        >
          {leftSidebarCollapsed ? '▶' : '◀'}
        </button>

        {/* 좌측 사이드바 */}
        <LeftSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* 중앙 콘텐츠 */}
        <CenterContent
          activeTab={activeTab}
          dailyData={null}
        />

        {/* 인사이트 패널 */}
        <InsightPanel />

        {/* 우측 패널 */}
        <RightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onShopPurchaseSuccess={handleShopPurchaseSuccess}
        />

        {/* 우측 토글 버튼 (항상 표시) */}
        <button
          className={`panel-toggle-btn right-toggle ${rightPanelsCollapsed ? 'collapsed' : ''}`}
          onClick={toggleRightPanels}
          title={rightPanelsCollapsed ? '우측 패널 펼치기' : '우측 패널 접기'}
          aria-label={rightPanelsCollapsed ? '우측 패널 펼치기' : '우측 패널 접기'}
        >
          {rightPanelsCollapsed ? '◀' : '▶'}
        </button>
      </main>

      {/* 와이푸 컴패니언 레이어 (Fixed Position) */}
      <aside
        className="waifu-panel-container"
        data-visibility={visibility}
        aria-label="와이푸 컴패니언"
        role="complementary"
        aria-hidden={visibility === 'hidden'}
      >
        <WaifuPanel />
      </aside>

      {/* Gemini 챗봇 전체 화면 */}
      <GeminiFullscreenChat
        isOpen={showGeminiChat}
        onClose={() => setShowGeminiChat(false)}
      />

      {/* 대량 할 일 추가 모달 (F1) */}
      <BulkAddModal
        isOpen={showBulkAdd}
        onClose={() => setShowBulkAdd(false)}
        onAddTasks={handleBulkAddTasks}
      />

      {/* 설정 모달 */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* 템플릿 모달 */}
      <TemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onTaskCreate={handleTaskCreateFromTemplate}
      />

      {/* 설정 아이콘 (오른쪽 아래) */}
      <button
        className="settings-fab"
        onClick={() => setShowSettings(true)}
        title="설정"
        aria-label="설정 열기"
      >
        ⚙️
      </button>

      {/* XP 토스트 */}
      {toasts.map((toast: { id: string; xp: number; message?: string }) => (
        <XPToast
          key={toast.id}
          xp={toast.xp}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {/* 동기화 에러 토스트 */}
      {syncErrorToasts.map((toast: SyncErrorToastData, index: number) => (
        <div key={toast.id} style={{ top: `${80 + index * 100}px` }}>
          <SyncErrorToast
            message={toast.message}
            onClose={() => removeSyncErrorToast(toast.id)}
            onRetry={toast.canRetry ? () => handleSyncRetry(toast.retryId) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
