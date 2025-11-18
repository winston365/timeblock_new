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
}

const tabs = [
  { id: 'today' as const, icon: '📋', label: '목표' },
  { id: 'stats' as const, icon: '📊', label: '통계' },
  { id: 'energy' as const, icon: '⚡️', label: '에너지' },
  { id: 'completed' as const, icon: '✅', label: '완료' },
  { id: 'inbox' as const, icon: '📥', label: '인박스' },
];

export default function LeftSidebar({ activeTab, onTabChange }: LeftSidebarProps) {
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
    className="left-sidebar flex h-full min-w-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
    aria-label="메인 네비게이션"
  >
    <div className="sidebar-tabs flex gap-2 border-b border-[var(--color-border)] px-3 py-3" role="tablist">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`sidebar-tab flex min-w-[60px] shrink-0 items-center gap-1 rounded-2xl border px-2 py-1 text-xs font-semibold whitespace-nowrap transition ${ 
              isActive
                ? 'active border-transparent bg-[var(--color-primary)] text-white shadow-inner'
                : 'bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10'
            } `}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`sidebar-panel-${tab.id}`}
              id={`sidebar-tab-${tab.id}`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

    <div className="sidebar-content flex-1 overflow-y-auto px-4 py-4">
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
          <div role="tabpanel" id="sidebar-panel-today" aria-labelledby="sidebar-tab-today">
            <GoalPanel onOpenModal={handleOpenGoalModal} />
          </div>
        )}
      </div>

      <GoalModal isOpen={isGoalModalOpen} onClose={handleCloseGoalModal} goal={editingGoal} />
    </nav>
  );
}
