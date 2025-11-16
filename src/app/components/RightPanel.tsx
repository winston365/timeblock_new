/**
 * RightPanel - 오른쪽 패널 (게임화, 상점)
 *
 * @role 퀘스트, 상점 기능을 탭 형태로 제공하는 오른쪽 패널 컴포넌트
 * @input activeTab: 현재 활성화된 탭, onTabChange: 탭 변경 핸들러, onShopPurchaseSuccess: 구매 성공 핸들러
 * @output 탭 기반 UI (퀘스트, 상점)
 * @dependencies QuestsPanel, ShopPanel 컴포넌트
 */

import QuestsPanel from '@/features/gamification/QuestsPanel';
import ShopPanel from '@/features/shop/ShopPanel';

interface RightPanelProps {
  activeTab: 'quest' | 'shop';
  onTabChange: (tab: 'quest' | 'shop') => void;
  onShopPurchaseSuccess?: (message: string, waifuMessage?: string) => void;
}

/**
 * 오른쪽 패널 컴포넌트 - 퀘스트, 상점 기능 제공
 * @param props - RightPanelProps
 * @returns 오른쪽 패널 UI
 */
export default function RightPanel({
  activeTab,
  onTabChange,
  onShopPurchaseSuccess
}: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label="퀘스트 및 상점 패널" role="complementary">
      <div className="right-panel-tabs" role="tablist">
        <button
          className={`right-panel-tab ${activeTab === 'quest' ? 'active' : ''}`}
          onClick={() => onTabChange('quest')}
          role="tab"
          aria-selected={activeTab === 'quest'}
          aria-controls="right-panel-quest"
          id="tab-quest"
        >
          <span aria-hidden="true">🎯</span> 퀘스트
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
        {activeTab === 'quest' && (
          <div
            role="tabpanel"
            id="right-panel-quest"
            aria-labelledby="tab-quest"
          >
            <QuestsPanel />
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
