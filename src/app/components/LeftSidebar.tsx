/**
 * LeftSidebar - 왼쪽 사이드바 (탭 네비게이션)
 *
 * @role 왼쪽 사이드바에서 오늘, 통계, 에너지, 완료, 인박스 탭 네비게이션 제공
 * @input activeTab: 현재 활성화된 탭, onTabChange: 탭 변경 핸들러
 * @output 탭 네비게이션 UI 및 각 탭 컨텐츠
 * @dependencies InboxTab, CompletedTab, StatsTab, EnergyTab, GoalPanel, GoalModal 컴포넌트
 */

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

/**
 * 왼쪽 사이드바 컴포넌트 - 주요 탭 네비게이션 제공
 * @param props - LeftSidebarProps
 * @returns 왼쪽 사이드바 UI
 */
export default function LeftSidebar({ activeTab, onTabChange }: LeftSidebarProps) {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<DailyGoal | undefined>(undefined);

  const tabs = [
    { id: 'today' as const, icon: '🎯', label: '오늘' },
    { id: 'stats' as const, icon: '📊', label: '통계' },
    { id: 'energy' as const, icon: '⚡', label: '에너지' },
    { id: 'completed' as const, icon: '✅', label: '완료' },
    { id: 'inbox' as const, icon: '📥', label: '인박스' },
  ];

  // 목표 모달 열기 핸들러
  const handleOpenGoalModal = (goal?: DailyGoal) => {
    setEditingGoal(goal);
    setIsGoalModalOpen(true);
  };

  // 목표 모달 닫기 핸들러
  const handleCloseGoalModal = () => {
    setIsGoalModalOpen(false);
    setEditingGoal(undefined);
  };

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
          <div role="tabpanel" id="sidebar-panel-today" aria-labelledby="sidebar-tab-today">
            <GoalPanel onOpenModal={handleOpenGoalModal} />
          </div>
        )}
      </div>

      {/* 목표 추가/수정 모달 */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={handleCloseGoalModal}
        goal={editingGoal}
      />
    </nav>
  );
}
