/**
 * AppShell - 앱 전체 레이아웃 및 상태 관리
 */

import { useState, useEffect } from 'react';
import { useGameState, useDailyData } from '@/shared/hooks';
import { initializeDatabase } from '@/data/db/dexieClient';

// 임시로 컴포넌트를 직접 import (나중에 features에서 가져올 것)
import TopToolbar from './components/TopToolbar';
import LeftSidebar from './components/LeftSidebar';
import CenterContent from './components/CenterContent';
import RightPanel from './components/RightPanel';
import WaifuPanel from '@/features/waifu/WaifuPanel';

export default function AppShell() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'energy' | 'completed' | 'inbox'>('today');
  const [rightPanelTab, setRightPanelTab] = useState<'template' | 'shop'>('template');

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

      {/* 접근성: 상단 툴바는 banner 역할 */}
      <header role="banner">
        <TopToolbar gameState={gameState} />
      </header>

      {/* 접근성: 메인 레이아웃은 main으로 명시 */}
      <div className="main-layout" role="main">
        {/* 접근성: 좌측 사이드바는 navigation */}
        <nav aria-label="메인 네비게이션" role="navigation">
          <LeftSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </nav>

        {/* 접근성: 중앙 콘텐츠 영역 */}
        <main id="main-content" aria-label="타임블록 스케줄러">
          <CenterContent
            activeTab={activeTab}
            dailyData={dailyData}
          />
        </main>

        {/* 접근성: 와이푸 패널은 complementary */}
        <aside
          className="waifu-panel-container"
          aria-label="와이푸 패널"
          role="complementary"
        >
          <WaifuPanel />
        </aside>

        {/* 접근성: 우측 패널도 complementary */}
        <aside
          aria-label="퀘스트 및 템플릿 패널"
          role="complementary"
        >
          <RightPanel
            activeTab={rightPanelTab}
            onTabChange={setRightPanelTab}
          />
        </aside>
      </div>
    </div>
  );
}
