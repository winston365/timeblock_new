/**
 * RightPanel - 오른쪽 패널 (게임화, 와이푸, 템플릿, 상점)
 */

import { useGameState } from '@/shared/hooks';
import XPBar from '@/shared/components/XPBar';
import QuestsPanel from '@/features/gamification/QuestsPanel';
import WaifuPanel from '@/features/waifu/WaifuPanel';

interface RightPanelProps {
  activeTab: 'waifu' | 'template' | 'shop';
  onTabChange: (tab: 'waifu' | 'template' | 'shop') => void;
}

export default function RightPanel({ activeTab, onTabChange }: RightPanelProps) {
  const { gameState } = useGameState();

  return (
    <aside className="right-panel">
      {/* XP 바는 항상 표시 */}
      <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
        {gameState && (
          <XPBar totalXP={gameState.totalXP} level={gameState.level} />
        )}
      </div>

      <div className="right-panel-tabs">
        <button
          className={`right-panel-tab ${activeTab === 'waifu' ? 'active' : ''}`}
          onClick={() => onTabChange('waifu')}
        >
          🥰 와이푸
        </button>
        <button
          className={`right-panel-tab ${activeTab === 'template' ? 'active' : ''}`}
          onClick={() => onTabChange('template')}
        >
          📝 템플릿
        </button>
        <button
          className={`right-panel-tab ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => onTabChange('shop')}
        >
          🛒 상점
        </button>
      </div>

      <div className="right-panel-content">
        {activeTab === 'waifu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', height: '100%' }}>
            <QuestsPanel />
            <WaifuPanel />
          </div>
        )}

        {activeTab === 'template' && (
          <div className="placeholder-section">
            <h3>📝 템플릿</h3>
            <p>(추후 구현)</p>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="placeholder-section">
            <h3>🛒 상점</h3>
            <p>(추후 구현)</p>
          </div>
        )}
      </div>
    </aside>
  );
}
