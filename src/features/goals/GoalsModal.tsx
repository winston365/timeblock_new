/**
 * @file GoalsModal.tsx
 * 
 * Role: 목표 관리를 위한 모달 컴포넌트
 * 
 * Responsibilities:
 * - GoalPanel과 WeeklyGoalPanel을 탭으로 구분하여 표시
 * - 오늘 목표 / 장기 목표 탭 전환
 * 
 * Key Dependencies:
 * - GoalPanel: 오늘 목표 패널 UI 컴포넌트
 * - WeeklyGoalPanel: 장기 목표 패널 UI 컴포넌트
 * - GoalModal: 목표 추가/수정 모달
 * - WeeklyGoalModal: 장기목표 추가/수정 모달
 */

import { useEffect, useState } from 'react';
import GoalPanel from './GoalPanel';
import GoalModal from './GoalModal';
import WeeklyGoalPanel from './WeeklyGoalPanel';
import WeeklyGoalModal from './WeeklyGoalModal';
import type { DailyGoal, WeeklyGoal } from '@/shared/types/domain';

interface GoalsModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

type TabType = 'daily' | 'weekly';

/**
 * 목표 관리 모달 컴포넌트
 * GoalPanel과 WeeklyGoalPanel을 탭으로 전환하여 표시합니다.
 * 
 * @param {GoalsModalProps} props - 모달 속성
 * @returns {JSX.Element | null} 목표 모달 UI 또는 null
 */
export function GoalsModal({ open, onClose }: GoalsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  
  // Daily Goal Modal State
  const [isDailyGoalModalOpen, setIsDailyGoalModalOpen] = useState(false);
  const [editingDailyGoal, setEditingDailyGoal] = useState<DailyGoal | undefined>(undefined);

  // Weekly Goal Modal State
  const [isWeeklyGoalModalOpen, setIsWeeklyGoalModalOpen] = useState(false);
  const [editingWeeklyGoal, setEditingWeeklyGoal] = useState<WeeklyGoal | undefined>(undefined);

  const handleOpenDailyGoalModal = (goal?: DailyGoal) => {
    setEditingDailyGoal(goal);
    setIsDailyGoalModalOpen(true);
  };

  const handleCloseDailyGoalModal = () => {
    setIsDailyGoalModalOpen(false);
    setEditingDailyGoal(undefined);
  };

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
        if (isDailyGoalModalOpen) {
          setIsDailyGoalModalOpen(false);
          setEditingDailyGoal(undefined);
          return;
        }

        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isDailyGoalModalOpen, isWeeklyGoalModalOpen]);

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
              <p className="text-xs text-[var(--color-text-secondary)]">오늘의 목표와 장기 목표를 관리하세요.</p>
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

          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'daily'
                  ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              📋 오늘 목표
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'weekly'
                  ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              📅 장기 목표
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'daily' ? (
              <GoalPanel onOpenModal={handleOpenDailyGoalModal} />
            ) : (
              <WeeklyGoalPanel onOpenModal={handleOpenWeeklyGoalModal} />
            )}
          </div>
        </div>
      </div>

      {/* 오늘 목표 추가/수정 모달 */}
      <GoalModal 
        isOpen={isDailyGoalModalOpen} 
        onClose={handleCloseDailyGoalModal} 
        goal={editingDailyGoal} 
      />

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
