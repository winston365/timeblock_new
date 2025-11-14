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
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>데이터베이스 초기화 중...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <TopToolbar gameState={gameState} />

      <main className="main-layout">
        <LeftSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <CenterContent
          activeTab={activeTab}
          dailyData={dailyData}
        />

        {/* 독립된 와이푸 패널 */}
        <aside className="waifu-panel-container">
          <WaifuPanel />
        </aside>

        <RightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
        />
      </main>
    </div>
  );
}
