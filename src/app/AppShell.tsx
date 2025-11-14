/**
 * AppShell - 앱 전체 레이아웃 및 상태 관리
 */

import { useState, useEffect } from 'react';
import { useGameState, useDailyData } from '@/shared/hooks';
import { initializeDatabase } from '@/data/db/dexieClient';
import { addTask } from '@/data/repositories';
import { createTaskFromTemplate } from '@/data/repositories/templateRepository';
import type { Template, Task } from '@/shared/types/domain';

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
  const [rightPanelTab, setRightPanelTab] = useState<'template' | 'shop'>('template');
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncLog, setShowSyncLog] = useState(false);

  const { gameState } = useGameState();
  const { dailyData } = useDailyData();

  // DB 초기화
  useEffect(() => {
    const initDB = async () => {
      try {
        await initializeDatabase();
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initDB();
  }, []);

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
        <div>데이터베이스 초기화 중...</div>
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
          dailyData={dailyData}
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
    </div>
  );
}
