/**
 * 승격 후 처리 선택 팝업
 *
 * @role Promote 후 원본 temp task 처리 방식 선택
 * @responsibilities
 *   - 삭제/아카이브/유지 3가지 옵션 제공
 *   - ESC로 닫기 (기본 동작: 유지)
 *   - 토스트 형태로 작업 흐름을 막지 않음
 * @dependencies useTempScheduleStore, PromotePostAction 타입
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Archive, Check, X } from 'lucide-react';
import type { TempScheduleTask, PromotePostAction } from '@/shared/types/tempSchedule';
import { useTempScheduleStore } from '../stores/tempScheduleStore';

// ============================================================================
// Types
// ============================================================================

export interface PromotePostActionPopupProps {
  /** 대상 작업 */
  task: TempScheduleTask;
  /** 팝업 위치 */
  position: { x: number; y: number };
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 완료 핸들러 (선택 완료 후) */
  onComplete?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 승격 후 처리 선택 팝업
 * @description Promote 직후 나타나는 후처리 선택 UI
 */
function PromotePostActionPopupComponent({
  task,
  position,
  onClose,
  onComplete,
}: PromotePostActionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const { promoteWithPostAction } = useTempScheduleStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // 외부 클릭 시 무시 (사용자가 명시적으로 옵션을 선택해야 함)
  // Modal UX 정책: backdrop click으로 액션 실행 금지

  // ESC 키로 닫기 (취소 - 액션 없이 닫기)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAction = useCallback(async (action: PromotePostAction) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await promoteWithPostAction(task, action);
      onComplete?.();
    } finally {
      setIsProcessing(false);
      onClose();
    }
  }, [task, promoteWithPostAction, onClose, onComplete, isProcessing]);

  // 화면 경계 체크
  const adjustedPosition = { ...position };
  if (typeof window !== 'undefined') {
    if (adjustedPosition.y + 180 > window.innerHeight) {
      adjustedPosition.y = position.y - 180;
    }
    if (adjustedPosition.x + 220 > window.innerWidth) {
      adjustedPosition.x = position.x - 220;
    }
  }

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-[220px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--color-text)]">
            승격 후 처리
          </span>
          <button
            type="button"
            className="p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
            onClick={() => handleAction('keep')}
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 truncate">
          '{task.name}'
        </p>
      </div>

      {/* 옵션 버튼들 */}
      <div className="p-2 space-y-1">
        {/* 삭제 */}
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          onClick={() => handleAction('delete')}
          disabled={isProcessing}
        >
          <Trash2 size={14} />
          <span>원본 삭제</span>
          <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">완전 제거</span>
        </button>

        {/* 아카이브 */}
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
          onClick={() => handleAction('archive')}
          disabled={isProcessing}
        >
          <Archive size={14} />
          <span>보관함으로</span>
          <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">숨김 처리</span>
        </button>

        {/* 유지 (기본) */}
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 transition-colors disabled:opacity-50"
          onClick={() => handleAction('keep')}
          disabled={isProcessing}
        >
          <Check size={14} />
          <span>그대로 유지</span>
          <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">기본</span>
        </button>
      </div>

      {/* 안내 */}
      <div className="px-3 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[9px] text-[var(--color-text-tertiary)]">
        💡 옵션을 선택하세요. ESC로 취소할 수 있습니다.
      </div>
    </div>,
    document.body
  );
}

export const PromotePostActionPopup = memo(PromotePostActionPopupComponent);
export default PromotePostActionPopup;
