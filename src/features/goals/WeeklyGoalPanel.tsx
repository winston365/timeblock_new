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
 *     - Catch-up 배너 및 재오픈 버튼 제공
 *     - 키보드 포커스 네비게이션 지원
 *     - 정보 밀도 가드레일 (기본 compact + 점진 노출)
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import WeeklyGoalCard from './WeeklyGoalCard';
import WeeklyGoalModal from './WeeklyGoalModal';
import WeeklyGoalHistoryModal from './WeeklyGoalHistoryModal';
import CatchUpAlertBanner, { CatchUpReopenButton } from './components/CatchUpAlertBanner';
import CatchUpAlertModal from './CatchUpAlertModal';
import ExpandHintBadge from './components/ExpandHintBadge';
import { useCatchUpAlertBanner } from './hooks/useCatchUpAlertBanner';
import { useQuotaAchievement } from './hooks/useQuotaAchievement';
import { filterGoals } from './components/GoalsFilterBar';
import { 
  getTodayProgressSnapshot, 
  initializeTodayProgressSnapshots,
  type TodayProgressSnapshot 
} from './utils/todayProgressUtils';
import type { WeeklyGoal } from '@/shared/types/domain';

interface WeeklyGoalPanelProps {
  onOpenModal?: (goal?: WeeklyGoal) => void;
  /** 키보드로 포커스된 목표 ID (외부에서 전달) */
  focusedGoalId?: string | null;
  /** 포커스 변경 콜백 */
  onFocusGoal?: (goalId: string | null) => void;
  /** 목표 ID 목록 변경 콜백 (키보드 네비게이션용) */
  onGoalIdsChange?: (goalIds: string[]) => void;
  /** 전체 목표 목록 변경 콜백 (필터링 전) */
  onGoalsChange?: (goals: WeeklyGoal[]) => void;
  /** Quick Log 열기 요청 (키보드에서) */
  quickLogGoalId?: string | null;
  /** Quick Log 닫기 콜백 */
  onQuickLogClose?: () => void;
  /** 히스토리 열기 요청 (키보드에서) */
  historyGoalId?: string | null;
  /** 히스토리 닫기 콜백 */
  onHistoryClose?: () => void;
  /** T11: 오늘만 보기 필터 */
  filterTodayOnly?: boolean;
  /** T15: 축소 모드 */
  compactMode?: boolean;
}

/**
 * 장기목표 패널 컴포넌트
 */
export default function WeeklyGoalPanel({
  onOpenModal,
  focusedGoalId,
  onFocusGoal,
  onGoalIdsChange,
  onGoalsChange,
  quickLogGoalId,
  onQuickLogClose,
  historyGoalId,
  onHistoryClose,
  filterTodayOnly = false,
  compactMode = true,
}: WeeklyGoalPanelProps) {
  const { goals, loading, loadGoals, deleteGoal, getDayOfWeekIndex } = useWeeklyGoalStore();
  
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WeeklyGoal | undefined>(undefined);
  const [localHistoryGoal, setLocalHistoryGoal] = useState<WeeklyGoal | null>(null);
  const [isCatchUpModalOpen, setIsCatchUpModalOpen] = useState(false);
  const [todayProgressSnapshot, setTodayProgressSnapshot] = useState<TodayProgressSnapshot | null>(null);

  // 오늘 진행량 스냅샷 초기화 및 로드
  useEffect(() => {
    const initSnapshot = async () => {
      if (goals.length > 0) {
        await initializeTodayProgressSnapshots(goals);
        const snapshot = await getTodayProgressSnapshot();
        setTodayProgressSnapshot(snapshot);
      }
    };
    void initSnapshot();
  }, [goals]);

  // 외부 히스토리 요청 처리
  const effectiveHistoryGoal = useMemo(() => {
    if (historyGoalId) {
      return goals.find((g) => g.id === historyGoalId) ?? null;
    }
    return localHistoryGoal;
  }, [historyGoalId, goals, localHistoryGoal]);

  // T11: 필터링된 목표 목록
  const filteredGoals = useMemo(() => {
    return filterGoals(goals, filterTodayOnly);
  }, [goals, filterTodayOnly]);

  // 목표 ID 목록 변경 시 부모에게 알림 (필터링된 목록 기준)
  useEffect(() => {
    if (onGoalIdsChange) {
      onGoalIdsChange(filteredGoals.map((g) => g.id));
    }
  }, [filteredGoals, onGoalIdsChange]);

  // 전체 목표 목록 변경 시 부모에게 알림
  useEffect(() => {
    if (onGoalsChange) {
      onGoalsChange(goals);
    }
  }, [goals, onGoalsChange]);

  // Catch-up 배너 관리
  const {
    isVisible: isBannerVisible,
    behindGoals,
    dismissBanner,
    snoozeBanner,
    snoozeUntil,
    reopenBanner,
    hasDangerGoals,
  } = useCatchUpAlertBanner();

  // Quota 달성 축하 토스트 (목표 진행도 변화 감지)
  useQuotaAchievement();

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

  const handleShowHistory = useCallback((goal: WeeklyGoal) => {
    setLocalHistoryGoal(goal);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setLocalHistoryGoal(null);
    if (onHistoryClose) {
      onHistoryClose();
    }
  }, [onHistoryClose]);

  // Catch-up 모달 열기 (배너에서 호출)
  const handleOpenCatchUpModal = useCallback(() => {
    setIsCatchUpModalOpen(true);
  }, []);

  // Catch-up 모달 닫기
  const handleCloseCatchUpModal = useCallback(() => {
    setIsCatchUpModalOpen(false);
  }, []);

  // 재오픈 버튼 표시 여부 (배너가 숨겨져 있고 뒤처진 목표가 있을 때)
  const showReopenButton = !isBannerVisible && behindGoals.length > 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Catch-up 알림 배너 */}
      <CatchUpAlertBanner
        isVisible={isBannerVisible}
        behindGoals={behindGoals}
        onDismiss={dismissBanner}
        onSnooze={snoozeBanner}
        snoozeUntil={snoozeUntil}
        onOpenModal={handleOpenCatchUpModal}
      />

      {/* Catch-up 모달 (상세 보기) */}
      <CatchUpAlertModal
        isOpen={isCatchUpModalOpen}
        onClose={handleCloseCatchUpModal}
        behindGoals={behindGoals}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">장기 목표</h3>
            <p className="text-[11px] text-white/50">
              오늘: {dayLabels[dayIndex]} ({dayIndex + 1}/7일차)
            </p>
          </div>
          {/* Catch-up 재오픈 버튼 (사용자 주도 진입점) */}
          {showReopenButton && (
            <CatchUpReopenButton
              behindGoalsCount={behindGoals.length}
              onClick={reopenBanner}
              hasDangerGoals={hasDangerGoals}
            />
          )}
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
      ) : filteredGoals.length === 0 ? (
        // 필터링 결과 없음
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-xs text-white/60">
          <p className="text-4xl">✨</p>
          <p className="font-medium text-white">오늘 할 일이 모두 완료됐어요!</p>
          <p>필터를 해제하면 모든 목표를 볼 수 있어요.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          {/* T16: 첫 1회 더보기 힌트 */}
          <ExpandHintBadge compactMode={compactMode} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredGoals.map((goal) => (
              <WeeklyGoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => handleOpenModal(goal)}
                onDelete={() => handleDelete(goal.id)}
                onShowHistory={() => handleShowHistory(goal)}
                compact={compactMode}
                isFocused={focusedGoalId === goal.id}
                onFocus={() => onFocusGoal?.(goal.id)}
                forceQuickLogOpen={quickLogGoalId === goal.id}
                onQuickLogClose={onQuickLogClose}
                todayProgressSnapshot={todayProgressSnapshot}
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
      {effectiveHistoryGoal && (
        <WeeklyGoalHistoryModal
          isOpen={!!effectiveHistoryGoal}
          onClose={handleCloseHistory}
          goal={effectiveHistoryGoal}
        />
      )}
    </div>
  );
}
