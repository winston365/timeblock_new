/**
 * LeftSidebar - 왼쪽 사이드바 (탭 네비게이션)
 */

import InboxTab from '@/features/tasks/InboxTab';
import CompletedTab from '@/features/tasks/CompletedTab';
import StatsTab from '@/features/stats/StatsTab';
import EnergyTab from '@/features/energy/EnergyTab';

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
    <nav className="left-sidebar" aria-label="메인 네비게이션">
      <div className="sidebar-tabs" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`sidebar-panel-${tab.id}`}
            id={`sidebar-tab-${tab.id}`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {activeTab === 'inbox' && (
          <div role="tabpanel" id="sidebar-panel-inbox" aria-labelledby="sidebar-tab-inbox">
            <InboxTab />
          </div>
        )}
        {activeTab === 'completed' && (
          <div role="tabpanel" id="sidebar-panel-completed" aria-labelledby="sidebar-tab-completed">
            <CompletedTab />
          </div>
        )}
        {activeTab === 'stats' && (
          <div role="tabpanel" id="sidebar-panel-stats" aria-labelledby="sidebar-tab-stats">
            <StatsTab />
          </div>
        )}
        {activeTab === 'energy' && (
          <div role="tabpanel" id="sidebar-panel-energy" aria-labelledby="sidebar-tab-energy">
            <EnergyTab />
          </div>
        )}
        {activeTab === 'today' && (
          <div
            role="tabpanel"
            id="sidebar-panel-today"
            aria-labelledby="sidebar-tab-today"
            style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}
          >
            <p>📅 타임블럭 스케줄러는 중앙 패널에서 확인하세요</p>
          </div>
        )}
      </div>
    </nav>
  );
}
