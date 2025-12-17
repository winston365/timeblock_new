/**
 * @file GoalsModal.tsx
 * 
 * Role: 목표 관리를 위한 모달 컴포넌트
 * 
 * Responsibilities:
 * - WeeklyGoalPanel을 표시 (장기 목표)
 * - 오늘 목표 UI 제거됨 (Phase 5, Option A)
 * 
 * Key Dependencies:
 * - WeeklyGoalPanel: 장기 목표 패널 UI 컴포넌트
 * - WeeklyGoalModal: 장기목표 추가/수정 모달
 */

import { useEffect, useState } from 'react';
// GoalPanel import 제거됨 (Phase 5 - 오늘 목표 UI 제거, 컴포넌트 파일은 유지)
// GoalModal import 제거됨 (Phase 5 - 오늘 목표 UI 제거, 컴포넌트 파일은 유지)
import WeeklyGoalPanel from './WeeklyGoalPanel';
import WeeklyGoalModal from './WeeklyGoalModal';
import type { WeeklyGoal } from '@/shared/types/domain';

interface GoalsModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

// TabType 제거됨 (Phase 5 - 단일 탭만 유지되므로 불필요)

/**
 * 목표 관리 모달 컴포넌트
 * 장기 목표(WeeklyGoalPanel)만 표시합니다.
 * 
 * @param {GoalsModalProps} props - 모달 속성
 * @returns {JSX.Element | null} 목표 모달 UI 또는 null
 */
export function GoalsModal({ open, onClose }: GoalsModalProps) {
  // Daily Goal 관련 상태 제거됨 (Phase 5)

  // Weekly Goal Modal State
  const [isWeeklyGoalModalOpen, setIsWeeklyGoalModalOpen] = useState(false);
  const [editingWeeklyGoal, setEditingWeeklyGoal] = useState<WeeklyGoal | undefined>(undefined);

  const handleOpenWeeklyGoalModal = (goal?: WeeklyGoal) => {
    setEditingWeeklyGoal(goal);
    setIsWeeklyGoalModalOpen(true);
  };

  const handleCloseWeeklyGoalModal = () => {
    setIsWeeklyGoalModalOpen(false);
    setEditingWeeklyGoal(undefined);
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // 모달 스택: 자식 모달이 열려있으면 자식부터 닫기
        if (isWeeklyGoalModalOpen) {
          setIsWeeklyGoalModalOpen(false);
          setEditingWeeklyGoal(undefined);
          return;
        }

        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isWeeklyGoalModalOpen]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6">
        <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)] text-[var(--color-text)] shadow-2xl">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Goals</div>
              <h2 className="text-xl font-bold">🎯 목표 관리</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">장기 목표를 관리하세요.</p>
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

          {/* 탭 제거됨 (Phase 5) - 장기 목표만 표시 */}

          {/* Content - 장기 목표만 표시 */}
          <div className="flex-1 overflow-hidden p-4">
            <WeeklyGoalPanel onOpenModal={handleOpenWeeklyGoalModal} />
          </div>
        </div>
      </div>

      {/* 오늘 목표 추가/수정 모달 제거됨 (Phase 5) */}

      {/* 장기 목표 추가/수정 모달 */}
      <WeeklyGoalModal
        isOpen={isWeeklyGoalModalOpen}
        onClose={handleCloseWeeklyGoalModal}
        goal={editingWeeklyGoal}
      />
    </>
  );
}

export default GoalsModal;
