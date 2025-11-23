import { useState } from 'react';
import InboxTab from '@/features/tasks/InboxTab';
import CompletedTab from '@/features/tasks/CompletedTab';
import StatsTab from '@/features/stats/StatsTab';
import EnergyTab from '@/features/energy/EnergyTab';
import GoalPanel from '@/features/goals/GoalPanel';
import GoalModal from '@/features/goals/GoalModal';
import type { DailyGoal } from '@/shared/types/domain';

interface LeftSidebarProps {
  activeTab: 'today' | 'stats' | 'energy' | 'completed' | 'inbox';
  onTabChange: (tab: 'today' | 'stats' | 'energy' | 'completed' | 'inbox') => void;
  collapsed?: boolean;
}

const tabs = [
  { id: 'today' as const, icon: '📋', label: '목표' },
  { id: 'stats' as const, icon: '📊', label: '통계' },
  { id: 'energy' as const, icon: '⚡️', label: '에너지' },
  { id: 'completed' as const, icon: '✅', label: '완료' },
  { id: 'inbox' as const, icon: '📥', label: '인박스' },
];

export default function LeftSidebar({ activeTab, onTabChange, collapsed = false }: LeftSidebarProps) {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<DailyGoal | undefined>(undefined);

  const handleOpenGoalModal = (goal?: DailyGoal) => {
    setEditingGoal(goal);
    setIsGoalModalOpen(true);
  };

  const handleCloseGoalModal = () => {
    setIsGoalModalOpen(false);
    setEditingGoal(undefined);
  };

  return (
    <nav
      className={`left-sidebar flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-text)] transition-all duration-300 ${collapsed ? 'w-0 opacity-0 invisible' : 'w-full opacity-100 visible'
        }`}
      aria-label="메인 네비게이션"
      aria-hidden={collapsed}
    >
      {/* 탭 네비게이션 (고정 헤더) */}
      <div className="sidebar-tabs flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-2" role="tablist">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`sidebar-tab flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-all duration-200 ${isActive
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-border)]'
                : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-secondary)]'
                }`}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`sidebar-panel-${tab.id}`}
              id={`sidebar-tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              title={tab.label}
            >
              <span className="text-lg leading-none" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 영역 (스크롤 가능) */}
      <div className="sidebar-content flex-1 min-h-0 overflow-y-auto bg-[var(--color-bg-base)]">
        {activeTab === 'inbox' && (
          <div role="tabpanel" id="sidebar-panel-inbox" aria-labelledby="sidebar-tab-inbox" className="h-full">
            <InboxTab />
          </div>
        )}
        {activeTab === 'completed' && (
          <div role="tabpanel" id="sidebar-panel-completed" aria-labelledby="sidebar-tab-completed" className="h-full">
            <CompletedTab />
          </div>
        )}
        {activeTab === 'stats' && (
          <div role="tabpanel" id="sidebar-panel-stats" aria-labelledby="sidebar-tab-stats" className="h-full">
            <StatsTab />
          </div>
        )}
        {activeTab === 'energy' && (
          <div role="tabpanel" id="sidebar-panel-energy" aria-labelledby="sidebar-tab-energy" className="h-full">
            <EnergyTab />
          </div>
        )}
        {activeTab === 'today' && (
          <div role="tabpanel" id="sidebar-panel-today" aria-labelledby="sidebar-tab-today" className="h-full">
            <GoalPanel onOpenModal={handleOpenGoalModal} />
          </div>
        )}
      </div>

      <GoalModal isOpen={isGoalModalOpen} onClose={handleCloseGoalModal} goal={editingGoal} />
    </nav>
  );
}
