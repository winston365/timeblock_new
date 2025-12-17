/**
 * RightPanel - 우측 패널 (포인트)
 *
 * @role 포인트 관련 기능을 제공하는 우측 패널 컴포넌트
 * @input activeTab: 현재 활성화된 탭, onTabChange: 탭 전환 핸들러, onShopPurchaseSuccess: 상점 구매 성공 시 콜백
 * @output 포인트 UI
 * @dependencies ShopPanel
 */

import ShopPanel from '@/features/shop/ShopPanel';
// InventoryPanel import 제거됨 (Phase 2 - UI 진입점 제거, 컴포넌트 파일은 유지)

/** RightPanel 컴포넌트 Props */
interface RightPanelProps {
  /** 현재 활성 탭 */
  activeTab: 'shop';
  /** 탭 변경 콜백 */
  onTabChange: (tab: 'shop') => void;
  /** 상점 구매 성공 시 콜백 */
  onShopPurchaseSuccess?: (message: string, waifuMessage?: string) => void;
  /** 패널 접힘 상태 */
  collapsed?: boolean;
}

/**
 * 우측 패널 컴포넌트
 * @param props - RightPanelProps
 * @returns 포인트 패널 UI
 */
export default function RightPanel({
  activeTab,
  onTabChange,
  onShopPurchaseSuccess,
  collapsed = false,
}: RightPanelProps) {
  // 인벤토리 탭 제거로 인해 gameState/inventoryTotal 미사용 (Phase 2)

  // 포인트 탭만 유지 (인벤토리 탭 제거됨)
  const tabs = [
    { id: 'shop' as const, label: '포인트', icon: '🛒' },
  ];

  return (
    <aside
      className={`right-panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-text)] transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'
        }`}
      aria-label="포인트 패널"
      role="complementary"
      aria-hidden={collapsed}
    >
      {/* 탭 네비게이션 (고정 헤더) */}
      <div className="right-panel-tabs flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-2" role="tablist">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`right-panel-tab relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all duration-200 ${isActive
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-border)]'
                : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-secondary)]'
                }`}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`right-panel-${tab.id}`}
              id={`right-panel-tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
            >
              <span className="text-base" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 영역 (스크롤 가능) */}
      <div className="right-panel-content flex-1 min-h-0 overflow-y-auto bg-[var(--color-bg-base)]">
        {activeTab === 'shop' && (
          <div
            role="tabpanel"
            id="right-panel-shop"
            aria-labelledby="right-panel-tab-shop"
            className="h-full"
          >
            <ShopPanel onPurchaseSuccess={onShopPurchaseSuccess} />
          </div>
        )}
        {/* inventory 탭 패널 제거됨 (Phase 2) */}
      </div>
    </aside>
  );
}
