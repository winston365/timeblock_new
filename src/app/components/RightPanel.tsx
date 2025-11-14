/**
 * RightPanel - 오른쪽 패널 (게임화, 템플릿, 상점)
 */

import { useGameState } from '@/shared/hooks';
import XPBar from '@/shared/components/XPBar';
import QuestsPanel from '@/features/gamification/QuestsPanel';

interface RightPanelProps {
  activeTab: 'template' | 'shop';
  onTabChange: (tab: 'template' | 'shop') => void;
}

export default function RightPanel({ activeTab, onTabChange }: RightPanelProps) {
  const { gameState } = useGameState();

  return (
    <aside className="right-panel" aria-label="퀘스트 및 템플릿 패널" role="complementary">
      {/* XP 바는 항상 표시 */}
      <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
        {gameState && (
          <XPBar totalXP={gameState.totalXP} level={gameState.level} />
        )}
      </div>

      {/* 퀘스트 패널 (항상 표시) */}
      <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
        <QuestsPanel />
      </div>

      <div className="right-panel-tabs" role="tablist">
        <button
          className={`right-panel-tab ${activeTab === 'template' ? 'active' : ''}`}
          onClick={() => onTabChange('template')}
          role="tab"
          aria-selected={activeTab === 'template'}
          aria-controls="right-panel-template"
          id="tab-template"
        >
          <span aria-hidden="true">📝</span> 템플릿
        </button>
        <button
          className={`right-panel-tab ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => onTabChange('shop')}
          role="tab"
          aria-selected={activeTab === 'shop'}
          aria-controls="right-panel-shop"
          id="tab-shop"
        >
          <span aria-hidden="true">🛒</span> 상점
        </button>
      </div>

      <div className="right-panel-content">
        {activeTab === 'template' && (
          <div
            className="placeholder-section"
            role="tabpanel"
            id="right-panel-template"
            aria-labelledby="tab-template"
          >
            <h3>📝 템플릿</h3>
            <p>(추후 구현)</p>
          </div>
        )}

        {activeTab === 'shop' && (
          <div
            className="placeholder-section"
            role="tabpanel"
            id="right-panel-shop"
            aria-labelledby="tab-shop"
          >
            <h3>🛒 상점</h3>
            <p>(추후 구현)</p>
          </div>
        )}
      </div>
    </aside>
  );
}
