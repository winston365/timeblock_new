/**
 * CenterContent - 중앙 메인 컨텐츠 영역
 *
 * @role 중앙 메인 영역에 타임블록 스케줄러 및 목표 패널 표시
 * @input activeTab: 현재 활성화된 탭, dailyData: 일일 데이터 (미사용)
 * @output 목표 패널 + 타임블록 스케줄러 UI
 * @dependencies ScheduleView, GoalPanel, GoalModal 컴포넌트
 */

import { useState } from 'react';
import ScheduleView from '@/features/schedule/ScheduleView';
import GoalPanel from '@/features/goals/GoalPanel';
import GoalModal from '@/features/goals/GoalModal';
import type { DailyGoal } from '@/shared/types/domain';

interface CenterContentProps {
  activeTab: string;
  dailyData: unknown; // 더 이상 직접 사용하지 않음
}

/**
 * 중앙 컨텐츠 컴포넌트 - 목표 패널 + 타임블록 스케줄러 표시
 * @param props - CenterContentProps
 * @returns 중앙 컨텐츠 UI
 */
export default function CenterContent({ activeTab: _activeTab, dailyData: _dailyData }: CenterContentProps) {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<DailyGoal | undefined>(undefined);
  const [goalPanelKey, setGoalPanelKey] = useState(0);

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

  // 목표 저장 완료 핸들러
  const handleGoalSaved = () => {
    // GoalPanel 강제 재렌더링 (key 변경)
    setGoalPanelKey(prev => prev + 1);
  };

  return (
    <section className="center-content" id="main-content" aria-label="타임블록 스케줄러">
      {/* 목표 패널 */}
      <GoalPanel key={goalPanelKey} onOpenModal={handleOpenGoalModal} />

      {/* 타임블록 스케줄러 */}
      <ScheduleView />

      {/* 목표 추가/수정 모달 */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={handleCloseGoalModal}
        goal={editingGoal}
        onSaved={handleGoalSaved}
      />
    </section>
  );
}
