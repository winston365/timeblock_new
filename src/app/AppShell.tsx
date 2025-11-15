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
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

// 임시로 컴포넌트를 직접 import (나중에 features에서 가져올 것)
import TopToolbar from './components/TopToolbar';
import LeftSidebar from './components/LeftSidebar';
import CenterContent from './components/CenterContent';
import RightPanel from './components/RightPanel';
import WaifuPanel from '@/features/waifu/WaifuPanel';
import GeminiFullscreenChat from '@/features/gemini/GeminiFullscreenChat';
import BulkAddModal from '@/features/tasks/BulkAddModal';
import SettingsModal from '@/features/settings/SettingsModal';
import SyncLogModal from '@/features/settings/SyncLogModal';
import InsightPanel from '@/features/insight/InsightPanel';

/**
 * 앱 셸 컴포넌트 - 전체 앱 레이아웃 및 초기화
 * @returns 앱 전체 UI
 */
export default function AppShell() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'energy' | 'completed' | 'inbox'>('today');
  const [rightPanelTab, setRightPanelTab] = useState<'quest' | 'template' | 'shop'>('quest');
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const { gameState } = useGameState();
  const { toasts, removeToast } = useXPToastStore();
  const { visibility } = useWaifuCompanionStore();

  // DB 초기화 및 Firebase 설정
  useEffect(() => {
    let isSubscribed = true;

    const initDB = async () => {
      try {
        await initializeDatabase();

        // Store 초기화 - 직접 접근
        const dailyDataStore = useDailyDataStore.getState();
        const gameStateStore = useGameStateStore.getState();

        await Promise.all([
          dailyDataStore.loadData(),
          gameStateStore.loadData(),
        ]);

        if (!isSubscribed) return;

        setDbInitialized(true);

        // 디버그 함수를 window에 노출
        exposeDebugToWindow();

        // Firebase 설정 확인 및 초기화
        const settings = await loadSettings();
        if (settings.firebaseConfig) {
          const initialized = initializeFirebase(settings.firebaseConfig);
          if (initialized) {
            // Firebase에서 초기 데이터 가져오기
            try {
              const { fetchDataFromFirebase } = await import('@/shared/services/firebaseService');
              const { saveGameState } = await import('@/data/repositories/gameStateRepository');

              const firebaseData = await fetchDataFromFirebase();

              // Firebase 데이터를 IndexedDB에 저장
              // GameState 저장
              if (firebaseData.gameState) {
                await saveGameState(firebaseData.gameState);
                await gameStateStore.loadData(); // 리로드
              }

              // Firebase 동기화 임시 비활성화를 위해 직접 IndexedDB에 저장
              const { db } = await import('@/data/db/dexieClient');
              const { saveToStorage } = await import('@/shared/lib/utils');
              const { STORAGE_KEYS } = await import('@/shared/lib/constants');
              const { syncToFirebase } = await import('@/shared/services/firebase/syncCore');
              const { dailyDataStrategy, gameStateStrategy } = await import('@/shared/services/firebase/strategies');

              // DailyData 저장 (모든 날짜)
              const dailyDataDates = Object.keys(firebaseData.dailyData);
              if (dailyDataDates.length > 0) {
                for (const date of dailyDataDates) {
                  const data = firebaseData.dailyData[date];

                  // 데이터 유효성 검사
                  if (!data || !data.tasks) {
                    console.warn(`⚠️ Invalid data for ${date}, skipping`);
                    continue;
                  }

                  // IndexedDB에 직접 저장 (Firebase 재동기화 방지)
                  await db.dailyData.put({
                    date,
                    tasks: data.tasks,
                    timeBlockStates: data.timeBlockStates || {},
                    updatedAt: data.updatedAt || Date.now(),
                  });

                  // localStorage에도 저장
                  saveToStorage(`${STORAGE_KEYS.DAILY_PLANS}${date}`, data);
                }
              }

              // 🔥 IndexedDB의 모든 데이터를 Firebase로 동기화 (Firebase에 없는 것만)
              const allLocalDailyData = await db.dailyData.toArray();
              const firebaseDates = new Set(Object.keys(firebaseData.dailyData));

              for (const localData of allLocalDailyData) {
                // Firebase에 이미 있는 날짜는 스킵
                if (firebaseDates.has(localData.date)) continue;

                // IndexedDB에는 있지만 Firebase에는 없는 데이터 업로드
                try {
                  await syncToFirebase(dailyDataStrategy, {
                    tasks: localData.tasks || [],
                    timeBlockStates: localData.timeBlockStates || {},
                    updatedAt: localData.updatedAt || Date.now(),
                  }, localData.date);
                } catch (syncError) {
                  console.error(`❌ Failed to upload ${localData.date}:`, syncError);
                }
              }

              // GameState도 동기화
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

              // 오늘 날짜 리로드
              const today = getLocalDate();
              await dailyDataStore.loadData(today, true); // 강제 리로드
            } catch (error) {
              console.error('Failed to fetch from Firebase:', error);
            }

            // 실시간 동기화 활성화
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

  // 브라우저 기본 우클릭 메뉴 차단 (React 방식)
  // TaskCard는 stopPropagation으로 이 핸들러까지 오지 않음
  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

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
        onContextMenu={handleGlobalContextMenu}
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
    <div className="app-container" onContextMenu={handleGlobalContextMenu}>
      {/* 접근성: 건너뛰기 링크 */}
      <a href="#main-content" className="skip-to-content">
        메인 콘텐츠로 건너뛰기
      </a>

      {/* 상단 툴바 */}
      <TopToolbar
        gameState={gameState}
        onOpenGeminiChat={() => setShowGeminiChat(true)}
        onOpenSyncLog={() => setShowSyncLog(true)}
        onOpenEnergyTab={() => setActiveTab('energy')}
      />

      {/* 메인 레이아웃 */}
      <main className="main-layout">
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
          onTaskCreateFromTemplate={handleTaskCreateFromTemplate}
          onShopPurchaseSuccess={handleShopPurchaseSuccess}
        />
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

      {/* 동기화 로그 모달 */}
      <SyncLogModal
        isOpen={showSyncLog}
        onClose={() => setShowSyncLog(false)}
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
    </div>
  );
}
