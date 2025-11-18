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
  const tabClassBase =
    'flex-1 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition-colors';

  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
      aria-label="퀘스트 및 상점 패널"
      role="complementary"
    >
      <div className="flex gap-2" role="tablist">
        <button
          className={`${tabClassBase} ${activeTab === 'quest' ? 'border-[var(--color-primary)] bg-[var(--color-bg)] text-[var(--color-text)] shadow-inner' : 'border-transparent bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}`}
          onClick={() => onTabChange('quest')}
          role="tab"
          aria-selected={activeTab === 'quest'}
          aria-controls="right-panel-quest"
          id="tab-quest"
        >
          <span aria-hidden="true" className="mr-1">🎯</span> 퀘스트
        </button>
        <button
          className={`${tabClassBase} ${activeTab === 'shop' ? 'border-[var(--color-primary)] bg-[var(--color-bg)] text-[var(--color-text)] shadow-inner' : 'border-transparent bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'}`}
          onClick={() => onTabChange('shop')}
          role="tab"
          aria-selected={activeTab === 'shop'}
          aria-controls="right-panel-shop"
          id="tab-shop"
        >
          <span aria-hidden="true" className="mr-1">🛒</span> 상점
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg)] p-3">
        {activeTab === 'quest' && (
          <div
            role="tabpanel"
            id="right-panel-quest"
            aria-labelledby="tab-quest"
            className="h-full min-h-[320px]"
          >
            <QuestsPanel />
          </div>
        )}

        {activeTab === 'shop' && (
          <div
            role="tabpanel"
            id="right-panel-shop"
            aria-labelledby="tab-shop"
            className="h-full min-h-[320px]"
          >
            <ShopPanel onPurchaseSuccess={onShopPurchaseSuccess} />
          </div>
        )}
      </div>
    </aside>
  );
}
