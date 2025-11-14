/**
 * RightPanel - 오른쪽 패널 (게임화, 템플릿, 상점)
 */

import { useGameState } from '@/shared/hooks';
import XPBar from '@/shared/components/XPBar';
import QuestsPanel from '@/features/gamification/QuestsPanel';
import TemplatePanel from '@/features/template/TemplatePanel';
import ShopPanel from '@/features/shop/ShopPanel';
import type { Template } from '@/shared/types/domain';

interface RightPanelProps {
  activeTab: 'template' | 'shop';
  onTabChange: (tab: 'template' | 'shop') => void;
  onTaskCreateFromTemplate: (template: Template) => void;
  onShopPurchaseSuccess?: (message: string, waifuMessage?: string) => void;
}

export default function RightPanel({
  activeTab,
  onTabChange,
  onTaskCreateFromTemplate,
  onShopPurchaseSuccess
}: RightPanelProps) {
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
            role="tabpanel"
            id="right-panel-template"
            aria-labelledby="tab-template"
          >
            <TemplatePanel onTaskCreate={onTaskCreateFromTemplate} />
          </div>
        )}

        {activeTab === 'shop' && (
          <div
            role="tabpanel"
            id="right-panel-shop"
            aria-labelledby="tab-shop"
          >
            <ShopPanel onPurchaseSuccess={onShopPurchaseSuccess} />
          </div>
        )}
      </div>
    </aside>
  );
}
