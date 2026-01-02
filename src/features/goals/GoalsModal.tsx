/**
 * @file GoalsModal.tsx
 * 
 * Role: 목표 관리를 위한 모달 컴포넌트
 * 
 * Responsibilities:
 * - WeeklyGoalPanel을 표시 (장기 목표)
 * - 오늘 목표 UI 제거됨 (Phase 5, Option A)
 * - 세션 포커스 배너 (React state만, 저장 안 함)
 * - 키보드 단축키 힌트 표시
 * - T09: 주차 라벨 표시
 * - T10: 주간 리셋 안내 카드
 * - T11-T12: 필터 UI (오늘만 보기 토글)
 * 
 * Key Dependencies:
 * - WeeklyGoalPanel: 장기 목표 패널 UI 컴포넌트
 * - WeeklyGoalModal: 장기목표 추가/수정 모달
 * - useGoalsHotkeys: 카드 네비게이션 단축키
 */

import { useState, useCallback } from 'react';
import WeeklyGoalPanel from './WeeklyGoalPanel';
import WeeklyGoalModal from './WeeklyGoalModal';
import WeeklyResetCard from './components/WeeklyResetCard';
import GoalsFilterBar from './components/GoalsFilterBar';
import { useModalHotkeys } from '@/shared/hooks';
import { useGoalsHotkeys } from './hooks/useGoalsHotkeys';
import { useGoalsSystemState } from './hooks/useGoalsSystemState';
import { getWeekLabelKorean, getWeekDateRange } from './utils/weekUtils';
import type { WeeklyGoal } from '@/shared/types/domain';

interface GoalsModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

/** 세션 포커스 상태 (React state만, 저장 안 함) */
interface SessionFocusState {
  /** 활성화 여부 */
  enabled: boolean;
  /** 포커스할 목표 ID (선택 시) */
  goalId: string | null;
  /** 포커스 메시지 (사용자 입력) */
  message: string;
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

  // 세션 포커스 상태 (React state만, 저장 안 함)
  const [sessionFocus, setSessionFocus] = useState<SessionFocusState>({
    enabled: false,
    goalId: null,
    message: '',
  });

  // 목표 ID 목록 (WeeklyGoalPanel에서 전달받음)
  const [goalIds, setGoalIds] = useState<string[]>([]);
  // 전체 목표 목록 (필터링 전)
  const [allGoals, setAllGoals] = useState<WeeklyGoal[]>([]);

  // Quick Log 열기 콜백 (카드에서 호출)
  const [quickLogGoalId, setQuickLogGoalId] = useState<string | null>(null);

  // 히스토리 모달 열기 콜백
  const [historyGoalId, setHistoryGoalId] = useState<string | null>(null);

  // Goals SystemState (필터, 모드 등)
  const {
    filterTodayOnly,
    setFilterTodayOnly,
    compactMode,
    setCompactMode,
  } = useGoalsSystemState();

  // T09: 주차 라벨 계산
  const weekLabel = getWeekLabelKorean();
  const weekDateRange = getWeekDateRange();

  // Goals 키보드 단축키
  const { focusedGoalId, setFocusedGoalId, showHints, toggleHints } = useGoalsHotkeys({
    isOpen: open && !isWeeklyGoalModalOpen,
    goalIds,
    cardActions: {
      onShowHistory: (goalId) => setHistoryGoalId(goalId),
      onOpenQuickLog: (goalId) => setQuickLogGoalId(goalId),
    },
  });

  const handleOpenWeeklyGoalModal = (goal?: WeeklyGoal) => {
    setEditingWeeklyGoal(goal);
    setIsWeeklyGoalModalOpen(true);
  };

  const handleCloseWeeklyGoalModal = () => {
    setIsWeeklyGoalModalOpen(false);
    setEditingWeeklyGoal(undefined);
  };

  // 세션 포커스 토글
  const handleToggleSessionFocus = useCallback(() => {
    setSessionFocus((prev) => ({
      ...prev,
      enabled: !prev.enabled,
      message: prev.enabled ? '' : prev.message,
    }));
  }, []);

  // 세션 포커스 메시지 변경
  const handleSessionFocusMessageChange = useCallback((message: string) => {
    setSessionFocus((prev) => ({ ...prev, message }));
  }, []);

  // ESC 키로 모달 닫기 (공용 훅 사용)
  // 자식 모달이 열려있을 때는 이 모달이 스택의 top이 아니므로 자동으로 무시됨
  useModalHotkeys({
    isOpen: open && !isWeeklyGoalModalOpen,
    onEscapeClose: onClose,
  });

  // 전역 열기/닫기 단축키는 TopToolbar에서만 처리합니다.

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6">
        <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)] text-[var(--color-text)] shadow-2xl">
          {/* Header - T09: 주차 라벨 추가 */}
          <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Goals</div>
                {/* T09: 주차 라벨 배지 */}
                <span className="rounded-full bg-[var(--color-primary)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
                  {weekLabel}
                </span>
              </div>
              <h2 className="text-xl font-bold">🎯 목표 관리</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {weekDateRange} • 장기 목표를 관리하세요.
              </p>
            </div>

            {/* 세션 포커스 배너 (저장 안 함, 세션 한정) */}
            <div className="mx-4 flex-shrink-0">
              {sessionFocus.enabled ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                  <span className="text-amber-400 text-sm">🎯</span>
                  <input
                    type="text"
                    value={sessionFocus.message}
                    onChange={(e) => handleSessionFocusMessageChange(e.target.value)}
                    placeholder="이 세션의 포커스..."
                    className="bg-transparent border-none outline-none text-sm text-amber-200 placeholder-amber-400/50 w-40"
                    maxLength={50}
                  />
                  <button
                    onClick={handleToggleSessionFocus}
                    className="text-amber-400/60 hover:text-amber-300 text-xs"
                    title="세션 포커스 해제"
                  >
                    ✕
                  </button>
                  <span className="text-[10px] text-amber-400/40 ml-1" title="이 세션에서만 표시됩니다">
                    세션 한정
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleToggleSessionFocus}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/10 hover:text-white transition"
                  title="세션 포커스 설정 (저장되지 않음)"
                >
                  <span>🎯</span>
                  <span>세션 포커스</span>
                </button>
              )}
            </div>

            {/* 힌트 토글 + 닫기 버튼 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleHints}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  showHints
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
                title="키보드 단축키 힌트 (? 키)"
              >
                ⌨️ ?
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition"
                aria-label="닫기 (ESC 또는 Ctrl/Cmd+Shift+G)"
              >
                닫기
              </button>
            </div>
          </header>

          {/* 키보드 단축키 힌트 (? 토글) */}
          {showHints && (
            <div className="flex items-center justify-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50 px-4 py-2 text-[11px] text-[var(--color-text-secondary)]">
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">↑↓←→</kbd> 카드 이동</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">Enter</kbd> 히스토리</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">L</kbd> 빠른 기록</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">Ctrl/Cmd+Shift+G</kbd> 열기/닫기</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">ESC</kbd> 닫기</span>
            </div>
          )}

          {/* 탭 제거됨 (Phase 5) - 장기 목표만 표시 */}

          {/* T10: 주간 리셋 안내 카드 */}
          <WeeklyResetCard allGoals={allGoals} />

          {/* T11-T12: 필터바 (오늘만 보기 토글, 숨김 카운트) */}
          <GoalsFilterBar
            filterTodayOnly={filterTodayOnly}
            onFilterChange={setFilterTodayOnly}
            compactMode={compactMode}
            onCompactModeChange={setCompactMode}
            allGoals={allGoals}
          />

          {/* Content - 장기 목표만 표시 */}
          <div className="flex-1 overflow-hidden p-4">
            <WeeklyGoalPanel
              onOpenModal={handleOpenWeeklyGoalModal}
              focusedGoalId={focusedGoalId}
              onFocusGoal={setFocusedGoalId}
              onGoalIdsChange={setGoalIds}
              onGoalsChange={setAllGoals}
              quickLogGoalId={quickLogGoalId}
              onQuickLogClose={() => setQuickLogGoalId(null)}
              historyGoalId={historyGoalId}
              onHistoryClose={() => setHistoryGoalId(null)}
              filterTodayOnly={filterTodayOnly}
              compactMode={compactMode}
            />
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
