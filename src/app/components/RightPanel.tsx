/**
 * RightPanel - 오른쪽 패널 (게임화, 템플릿, 상점)
 *
 * @role 퀘스트, 템플릿, 상점 기능을 탭 형태로 제공하는 오른쪽 패널 컴포넌트
 * @input activeTab: 현재 활성화된 탭, onTabChange: 탭 변경 핸들러, onTaskCreateFromTemplate: 템플릿에서 작업 생성 핸들러, onShopPurchaseSuccess: 구매 성공 핸들러
 * @output 탭 기반 UI (퀘스트, 템플릿, 상점)
 * @dependencies QuestsPanel, TemplatePanel, ShopPanel 컴포넌트
 */

import QuestsPanel from '@/features/gamification/QuestsPanel';
import TemplatePanel from '@/features/template/TemplatePanel';
import ShopPanel from '@/features/shop/ShopPanel';
import type { Template } from '@/shared/types/domain';

interface RightPanelProps {
  activeTab: 'quest' | 'template' | 'shop';
  onTabChange: (tab: 'quest' | 'template' | 'shop') => void;
  onTaskCreateFromTemplate: (template: Template) => void;
  onShopPurchaseSuccess?: (message: string, waifuMessage?: string) => void;
}

/**
 * 오른쪽 패널 컴포넌트 - 퀘스트, 템플릿, 상점 기능 제공
 * @param props - RightPanelProps
 * @returns 오른쪽 패널 UI
 */
export default function RightPanel({
  activeTab,
  onTabChange,
  onTaskCreateFromTemplate,
  onShopPurchaseSuccess
}: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label="퀘스트 및 템플릿 패널" role="complementary">
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
        {activeTab === 'quest' && (
          <div
            role="tabpanel"
            id="right-panel-quest"
            aria-labelledby="tab-quest"
          >
            <QuestsPanel />
          </div>
        )}

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
