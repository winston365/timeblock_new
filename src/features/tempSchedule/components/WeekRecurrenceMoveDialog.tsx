/**
 * 반복 일정 이동 선택 다이얼로그
 *
 * @role 반복 일정을 드래그하여 이동 시 범위 선택 모달
 * @responsibilities
 *   - "이 항목만" vs "이후 모든 항목" 선택
 *   - 기본값: "이 항목만" (안전한 선택)
 *   - 선택 결과에 따른 처리 분기
 * @dependencies notify, modalStackRegistry
 */

import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarRange, AlertCircle } from 'lucide-react';
import { notify } from '@/shared/lib/notify';

// ============================================================================
// Types
// ============================================================================

export type RecurrenceMoveScope = 'this' | 'thisAndFuture';

export interface WeekRecurrenceMoveDialogProps {
  /** 대상 작업 이름 */
  taskName: string;
  /** 이동 대상 날짜 */
  targetDate: string;
  /** 선택 완료 핸들러 */
  onSelect: (scope: RecurrenceMoveScope) => void;
  /** 취소 핸들러 */
  onCancel: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 반복 일정 이동 선택 다이얼로그
 * @description Week 뷰에서 반복 일정을 다른 날짜로 드래그할 때 표시
 */
function WeekRecurrenceMoveDialogComponent({
  taskName,
  targetDate,
  onSelect,
  onCancel,
}: WeekRecurrenceMoveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const thisOnlyRef = useRef<HTMLButtonElement>(null);

  // 기본 포커스: "이 항목만" 버튼 (안전한 선택)
  useEffect(() => {
    thisOnlyRef.current?.focus();
  }, []);

  // ESC 키로 닫기 (이동 취소)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // 배경 클릭 무시 - Modal UX 정책: backdrop click으로 액션 실행 금지

  const handleThisOnly = useCallback(() => {
    notify.info('이 항목만 이동되었습니다');
    onSelect('this');
  }, [onSelect]);

  const handleThisAndFuture = useCallback(() => {
    notify.info('이후 모든 반복 항목이 이동되었습니다');
    onSelect('thisAndFuture');
  }, [onSelect]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurrence-move-title"
    >
      <div
        ref={dialogRef}
        className="w-[340px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <h2
            id="recurrence-move-title"
            className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2"
          >
            <CalendarRange size={16} className="text-[var(--color-primary)]" />
            반복 일정 이동
          </h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text)]">{taskName}</span>을(를) 이동합니다
          </p>
        </div>

        {/* 경고 메시지 */}
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
            반복 일정입니다. 어떤 범위를 이동할지 선택하세요.
          </p>
        </div>

        {/* 선택 옵션 */}
        <div className="p-4 space-y-2">
          {/* 이 항목만 (기본, 권장) */}
          <button
            ref={thisOnlyRef}
            type="button"
            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-left hover:bg-[var(--color-primary)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 transition-colors group"
            onClick={handleThisOnly}
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/20 flex items-center justify-center group-hover:bg-[var(--color-primary)]/30">
              <Calendar size={18} className="text-[var(--color-primary)]" />
            </div>
            <div className="flex-1">
              <span className="block text-sm font-bold text-[var(--color-text)]">
                이 항목만
              </span>
              <span className="block text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                {targetDate}의 이 일정만 이동 (권장)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[9px] font-bold">
              기본
            </span>
          </button>

          {/* 이후 모든 항목 */}
          <button
            type="button"
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] text-left hover:bg-[var(--color-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 transition-colors group"
            onClick={handleThisAndFuture}
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--color-bg-secondary)]">
              <CalendarRange size={18} className="text-[var(--color-text-secondary)]" />
            </div>
            <div className="flex-1">
              <span className="block text-sm font-medium text-[var(--color-text)]">
                이후 모든 항목
              </span>
              <span className="block text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                {targetDate} 이후 모든 반복 일정을 이동
              </span>
            </div>
          </button>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <span className="text-[9px] text-[var(--color-text-tertiary)]">
            ESC = 취소
          </span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            onClick={handleCancel}
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const WeekRecurrenceMoveDialog = memo(WeekRecurrenceMoveDialogComponent);
export default WeekRecurrenceMoveDialog;
