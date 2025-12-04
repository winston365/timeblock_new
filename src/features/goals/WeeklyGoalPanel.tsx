/**
 * WeeklyGoalPanel.tsx
 *
 * @file 장기목표 패널 컴포넌트
 * @description
 *   - Role: 장기목표 목록과 관리 UI 제공
 *   - Responsibilities:
 *     - 장기목표 목록 표시
 *     - 목표 추가/수정/삭제 기능
 *     - 히스토리 모달 연결
 */

import { useEffect, useState } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import WeeklyGoalCard from './WeeklyGoalCard';
import WeeklyGoalModal from './WeeklyGoalModal';
import WeeklyGoalHistoryModal from './WeeklyGoalHistoryModal';
import type { WeeklyGoal } from '@/shared/types/domain';

interface WeeklyGoalPanelProps {
  onOpenModal?: (goal?: WeeklyGoal) => void;
}

/**
 * 장기목표 패널 컴포넌트
 */
export default function WeeklyGoalPanel({ onOpenModal }: WeeklyGoalPanelProps) {
  const { goals, loading, loadGoals, deleteGoal, getDayOfWeekIndex } = useWeeklyGoalStore();
  
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WeeklyGoal | undefined>(undefined);
  const [historyGoal, setHistoryGoal] = useState<WeeklyGoal | null>(null);

  const dayIndex = getDayOfWeekIndex();
  const dayLabels = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleOpenModal = (goal?: WeeklyGoal) => {
    if (onOpenModal) {
      onOpenModal(goal);
    } else {
      setEditingGoal(goal);
      setIsGoalModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsGoalModalOpen(false);
    setEditingGoal(undefined);
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('정말 이 장기목표를 삭제하시겠습니까?\n히스토리 기록도 함께 삭제됩니다.')) return;
    try {
      await deleteGoal(goalId);
    } catch (error) {
      console.error('[WeeklyGoalPanel] Failed to delete goal:', error);
      alert('목표 삭제에 실패했습니다.');
    }
  };

  const handleShowHistory = (goal: WeeklyGoal) => {
    setHistoryGoal(goal);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">장기 목표</h3>
          <p className="text-[11px] text-white/50">
            오늘: {dayLabels[dayIndex]} ({dayIndex + 1}/7일차)
          </p>
        </div>
        <button
          className="rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] active:scale-95"
          onClick={() => handleOpenModal()}
        >
          + 추가
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/60">
          로딩 중...
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-xs text-white/60">
          <p className="text-4xl">🎯</p>
          <p className="font-medium text-white">장기 목표가 없습니다</p>
          <p>이번 주에 달성하고 싶은 목표를 추가해보세요!</p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white"
          >
            첫 목표 추가하기
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {goals.map((goal) => (
              <WeeklyGoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => handleOpenModal(goal)}
                onDelete={() => handleDelete(goal.id)}
                onShowHistory={() => handleShowHistory(goal)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* 목표 추가/수정 모달 */}
      <WeeklyGoalModal
        isOpen={isGoalModalOpen}
        onClose={handleCloseModal}
        goal={editingGoal}
      />

      {/* 히스토리 모달 */}
      {historyGoal && (
        <WeeklyGoalHistoryModal
          isOpen={!!historyGoal}
          onClose={() => setHistoryGoal(null)}
          goal={historyGoal}
        />
      )}
    </div>
  );
}
