/**
 * 임시 스케줄 메인 모달
 *
 * @role 임시 스케줄 시스템의 메인 진입점
 * @responsibilities
 *   - 왼쪽: 타임라인/주간/월간 뷰
 *   - 오른쪽: 스케줄 작업 목록
 *   - 상단: 뷰 모드 전환, 날짜 네비게이션, 그리드 스냅 설정
 * @dependencies useTempScheduleStore
 */

import { memo, useEffect, useCallback } from 'react';
import { useTempScheduleStore } from './stores/tempScheduleStore';
import type { GridSnapInterval } from '@/shared/types/tempSchedule';
import { TempScheduleTimelineView } from './components/TempScheduleTimelineView';
import { TempScheduleTaskList } from './components/TempScheduleTaskList';
import { AddTempScheduleTaskModal } from './components/AddTempScheduleTaskModal';
import { WeeklyScheduleView } from './components/WeeklyScheduleView';
import { MonthlyScheduleView } from './components/MonthlyScheduleView';
import { TemplateModal } from './components/TemplateModal';
import { useModalEscapeClose } from '@/shared/hooks';

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

const KEYBOARD_SHORTCUTS = [
  { key: 'N', action: '새 스케줄 추가' },
  { key: 'D', action: '일간 뷰' },
  { key: 'W', action: '주간 뷰' },
  { key: 'M', action: '월간 뷰' },
  { key: 'T', action: '오늘로 이동' },
  { key: '←/→', action: '이전/다음' },
];

// ============================================================================
// Constants
// ============================================================================

const GRID_SNAP_OPTIONS: { value: GridSnapInterval; label: string }[] = [
  { value: 5, label: '5분' },
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateLabel(date: string, viewMode: 'day' | 'week' | 'month'): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

  switch (viewMode) {
    case 'day':
      return `${year}년 ${month}월 ${day}일 (${weekday})`;
    case 'week': {
      // 해당 주의 월~일 범위
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const startMonth = monday.getMonth() + 1;
      const startDay = monday.getDate();
      const endMonth = sunday.getMonth() + 1;
      const endDay = sunday.getDate();
      
      if (startMonth === endMonth) {
        return `${year}년 ${startMonth}월 ${startDay}일 ~ ${endDay}일`;
      }
      return `${year}년 ${startMonth}/${startDay} ~ ${endMonth}/${endDay}`;
    }
    case 'month':
      return `${year}년 ${month}월`;
  }
}

// ============================================================================
// Main Component
// ============================================================================

interface TempScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function TempScheduleModalComponent({ isOpen, onClose }: TempScheduleModalProps) {
  const {
    tasks,
    viewMode,
    selectedDate,
    gridSnapInterval,
    isLoading,
    isTaskModalOpen,
    isTemplateModalOpen,
    loadData,
    setViewMode,
    setGridSnapInterval,
    goToPrevious,
    goToNext,
    goToToday,
    openTaskModal,
    openTemplateModal,
  } = useTempScheduleStore();

  useModalEscapeClose(isOpen, onClose);

  // 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // 키보드 단축키 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 입력 필드에서는 단축키 비활성화
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    // 작업 모달 또는 템플릿 모달이 열려있으면 단축키 비활성화
    if (isTaskModalOpen || isTemplateModalOpen) return;

    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        openTaskModal();
        break;
      case 'd':
        e.preventDefault();
        setViewMode('day');
        break;
      case 'w':
        e.preventDefault();
        setViewMode('week');
        break;
      case 'm':
        e.preventDefault();
        setViewMode('month');
        break;
      case 't':
        e.preventDefault();
        goToToday();
        break;
      case 'arrowleft':
        e.preventDefault();
        goToPrevious();
        break;
      case 'arrowright':
        e.preventDefault();
        goToNext();
        break;
    }
  }, [isTaskModalOpen, isTemplateModalOpen, openTaskModal, setViewMode, goToToday, goToPrevious, goToNext]);

  // 키보드 이벤트 등록
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8" 
    >
      <div 
        className="flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-base)] shadow-2xl" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">📅 임시 스케줄</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                가상의 일정을 관리하세요 (기존 작업과 독립)
              </p>
            </div>

            {/* 뷰 모드 전환 */}
            <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] p-1">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === mode
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'day' ? '일간' : mode === 'week' ? '주간' : '월간'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 날짜 네비게이션 */}
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                onClick={goToPrevious}
              >
                ◀
              </button>
              <div className="min-w-[180px] text-center">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {formatDateLabel(selectedDate, viewMode)}
                </span>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                onClick={goToNext}
              >
                ▶
              </button>
              <button
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                onClick={goToToday}
              >
                오늘
              </button>
            </div>

            {/* 그리드 스냅 설정 (일간 뷰에서만) */}
            {viewMode === 'day' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-text-tertiary)]">스냅:</span>
                <select
                  value={gridSnapInterval}
                  onChange={(e) => setGridSnapInterval(Number(e.target.value) as GridSnapInterval)}
                  className="px-2 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-xs text-[var(--color-text)] focus:outline-none"
                >
                  {GRID_SNAP_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 템플릿 버튼 */}
            <button
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-primary)]/50 transition-colors flex items-center gap-1.5"
              onClick={openTemplateModal}
              title="템플릿 관리"
            >
              <span>📋</span>
              <span>템플릿</span>
            </button>

            {/* 닫기 버튼 */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Split Legend (day view only) */}
        {viewMode === 'day' && (
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 px-6 py-2 text-[11px] text-[var(--color-text-secondary)]">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-500/40 bg-blue-500/15 text-blue-50 font-semibold">
              메인 일정 스냅샷 · 좌측 12%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-50 font-semibold">
              임시 스케줄 · 우측 편집
            </span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">비율 고정 · 메인 일정은 읽기 전용 표시</span>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽: 타임라인/주간/월간 뷰 */}
          <div className="flex-1 border-r border-[var(--color-border)] overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-[var(--color-text-tertiary)]">로딩 중...</div>
              </div>
            ) : (
              <>
                {viewMode === 'day' && <TempScheduleTimelineView selectedDate={selectedDate} />}
                {viewMode === 'week' && <WeeklyScheduleView />}
                {viewMode === 'month' && <MonthlyScheduleView />}
              </>
            )}
          </div>

          {/* 오른쪽: 작업 목록 */}
          <div className="w-[350px] flex-shrink-0 overflow-hidden">
            <TempScheduleTaskList tasks={tasks} />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-3 text-xs text-[var(--color-text-tertiary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>💡 팁: 타임라인을 드래그하여 새 스케줄을 생성하세요</span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="opacity-60">단축키:</span>
                {KEYBOARD_SHORTCUTS.map(({ key, action }) => (
                  <span key={key} className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] font-mono text-[9px]">
                      {key}
                    </kbd>
                    <span className="opacity-60">{action}</span>
                  </span>
                ))}
              </div>
            </div>
            <span>총 {tasks.length}개의 스케줄</span>
          </div>
        </div>
      </div>

      {/* 작업 추가/편집 모달 */}
      <AddTempScheduleTaskModal />

      {/* 템플릿 모달 */}
      <TemplateModal />
    </div>
  );
}

export const TempScheduleModal = memo(TempScheduleModalComponent);
export default TempScheduleModal;
