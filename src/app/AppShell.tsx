/**
 * AppShell - 앱 전체 레이아웃 및 상태 관리
 */

import { useState, useEffect } from 'react';
import { useGameState } from '@/shared/hooks';
import { initializeDatabase } from '@/data/db/dexieClient';
import { addTask } from '@/data/repositories';
import { createTaskFromTemplate } from '@/data/repositories/templateRepository';
import { loadSettings } from '@/data/repositories/settingsRepository';
import {
  initializeFirebase,
  enableFirebaseSync
} from '@/shared/services/firebaseService';
import type { Template, Task } from '@/shared/types/domain';
import { useXPToastStore } from '@/shared/hooks/useXPToast';
import XPToast from '@/shared/components/XPToast';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

// 임시로 컴포넌트를 직접 import (나중에 features에서 가져올 것)
import TopToolbar from './components/TopToolbar';
import LeftSidebar from './components/LeftSidebar';
import CenterContent from './components/CenterContent';
import RightPanel from './components/RightPanel';
import WaifuPanel from '@/features/waifu/WaifuPanel';
import GeminiChatModal from '@/features/gemini/GeminiChatModal';
import BulkAddModal from '@/features/tasks/BulkAddModal';
import SettingsModal from '@/features/settings/SettingsModal';
import SyncLogModal from '@/features/settings/SyncLogModal';

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

  // DB 초기화 및 Firebase 설정
  useEffect(() => {
    let isSubscribed = true;

    const initDB = async () => {
      try {
        console.log('🔧 Starting database initialization...');
        await initializeDatabase();
        console.log('✅ Database initialized');

        // Store 초기화 - 직접 접근
        console.log('🚀 Initializing stores...');
        const dailyDataStore = useDailyDataStore.getState();
        const gameStateStore = useGameStateStore.getState();
        
        await Promise.all([
          dailyDataStore.loadData(),
          gameStateStore.loadData(),
        ]);
        console.log('✅ Stores initialized');

        if (!isSubscribed) return;

        setDbInitialized(true);
        console.log('✅ App initialized successfully');

        // Firebase 설정 확인 및 초기화
        const settings = await loadSettings();
        if (settings.firebaseConfig) {
          const initialized = initializeFirebase(settings.firebaseConfig);
          if (initialized) {
            console.log('🔥 Firebase initialized from settings');

            // 실시간 동기화 활성화
            const unsubscribe = enableFirebaseSync(
              async (date) => {
                console.log('📥 Received DailyData from Firebase:', date);
                await dailyDataStore.refresh();
              },
              async () => {
                console.log('📥 Received GameState from Firebase');
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
      await addTask(task);
      alert(`"${template.name}" 템플릿에서 작업이 추가되었습니다!`);
      // dailyData hook이 자동으로 리렌더링됨
    } catch (error) {
      console.error('Failed to create task from template:', error);
      alert('작업 추가에 실패했습니다.');
    }
  };

  // 상점 구매 성공 핸들러 (와이푸 메시지 표시용)
  const handleShopPurchaseSuccess = (_message: string, waifuMessage?: string) => {
    if (waifuMessage) {
      // TODO: 와이푸에게 메시지를 전달하는 로직 추가
      console.log('와이푸 메시지:', waifuMessage);
    }
  };

  // 대량 작업 추가 핸들러
  const handleBulkAddTasks = async (tasks: Task[]) => {
    try {
      for (const task of tasks) {
        await addTask(task);
      }
      console.log(`✅ ${tasks.length}개의 작업이 추가되었습니다`);
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

        {/* 와이푸 패널 */}
        <aside
          className="waifu-panel-container"
          aria-label="와이푸 패널"
          role="complementary"
        >
          <WaifuPanel />
        </aside>

        {/* 우측 패널 */}
        <RightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onTaskCreateFromTemplate={handleTaskCreateFromTemplate}
          onShopPurchaseSuccess={handleShopPurchaseSuccess}
        />
      </main>

      {/* Gemini 챗봇 모달 */}
      <GeminiChatModal
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
