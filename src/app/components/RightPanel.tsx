/**
 * RightPanel - 오른쪽 패널 (와이푸, 템플릿, 상점)
 */

interface RightPanelProps {
  activeTab: 'waifu' | 'template' | 'shop';
  onTabChange: (tab: 'waifu' | 'template' | 'shop') => void;
}

export default function RightPanel({ activeTab, onTabChange }: RightPanelProps) {
  return (
    <aside className="right-panel">
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
          <div>
            <h3>와이푸</h3>
            <p>호감도: 0</p>
            <p>완료 작업: 0</p>
            <p>(추후 구현)</p>
          </div>
        )}

        {activeTab === 'template' && (
          <div>
            <h3>템플릿</h3>
            <p>(추후 구현)</p>
          </div>
        )}

        {activeTab === 'shop' && (
          <div>
            <h3>상점</h3>
            <p>(추후 구현)</p>
          </div>
        )}
      </div>
    </aside>
  );
}
