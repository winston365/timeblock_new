/**
 * @file GoalsModal.tsx
 * 
 * Role: 목표 관리를 위한 모달 컴포넌트
 * 
 * Responsibilities:
 * - GoalPanel을 모달 형태로 래핑
 * - 목표 목록 표시 및 관리
 * 
 * Key Dependencies:
 * - GoalPanel: 목표 패널 UI 컴포넌트
 * - GoalModal: 목표 추가/수정 모달
 */

import { useState } from 'react';
import GoalPanel from './GoalPanel';
import GoalModal from './GoalModal';
import type { DailyGoal } from '@/shared/types/domain';

interface GoalsModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

/**
 * 목표 관리 모달 컴포넌트
 * GoalPanel을 전체 화면 모달 형태로 표시합니다.
 * 
 * @param {GoalsModalProps} props - 모달 속성
 * @returns {JSX.Element | null} 목표 모달 UI 또는 null
 */
export function GoalsModal({ open, onClose }: GoalsModalProps) {
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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6">
        <div className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)] text-[var(--color-text)] shadow-2xl">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Daily Goals</div>
              <h2 className="text-xl font-bold">🎯 오늘의 목표</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">목표를 설정하고 진행 상황을 확인하세요.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition"
              aria-label="닫기"
            >
              닫기
            </button>
          </header>

          {/* Content - GoalPanel을 모달 내부에 렌더링 */}
          <div className="flex-1 overflow-hidden p-4">
            <GoalPanel onOpenModal={handleOpenGoalModal} />
          </div>
        </div>
      </div>

      {/* 목표 추가/수정 모달 */}
      <GoalModal 
        isOpen={isGoalModalOpen} 
        onClose={handleCloseGoalModal} 
        goal={editingGoal} 
      />
    </>
  );
}

export default GoalsModal;
