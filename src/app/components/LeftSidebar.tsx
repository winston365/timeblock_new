/**
 * LeftSidebar - 왼쪽 사이드바 (탭 네비게이션)
 */

interface LeftSidebarProps {
  activeTab: 'today' | 'stats' | 'energy' | 'completed' | 'inbox';
  onTabChange: (tab: 'today' | 'stats' | 'energy' | 'completed' | 'inbox') => void;
}

export default function LeftSidebar({ activeTab, onTabChange }: LeftSidebarProps) {
  const tabs = [
    { id: 'today' as const, icon: '🎯', label: '오늘' },
    { id: 'stats' as const, icon: '📊', label: '통계' },
    { id: 'energy' as const, icon: '⚡', label: '에너지' },
    { id: 'completed' as const, icon: '✅', label: '완료' },
    { id: 'inbox' as const, icon: '📥', label: '인박스' },
  ];

  return (
    <aside className="left-sidebar">
      <div className="sidebar-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {activeTab === 'today' && <div>오늘 스케줄 그리드 (추후 구현)</div>}
        {activeTab === 'stats' && <div>통계 차트 (추후 구현)</div>}
        {activeTab === 'energy' && <div>에너지 정보 (추후 구현)</div>}
        {activeTab === 'completed' && <div>완료 목록 (추후 구현)</div>}
        {activeTab === 'inbox' && <div>인박스 목록 (추후 구현)</div>}
      </div>
    </aside>
  );
}
