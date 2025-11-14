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
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'completed' && <CompletedTab />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'energy' && <EnergyTab />}
        {activeTab === 'today' && (
          <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
            <p>📅 타임블럭 스케줄러는 중앙 패널에서 확인하세요</p>
          </div>
        )}
      </div>
    </aside>
  );
}
