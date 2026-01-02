/**
 * 인라인 편집 팝오버
 *
 * @role 작업의 이름/시간/색상을 빠르게 편집
 * @responsibilities
 *   - 최소 3필드 편집 (이름, 시작/종료 시간, 색상)
 *   - ESC로 취소, Enter로 저장
 *   - 포커스 관리 및 드래그/클릭 충돌 방지
 * @dependencies useTempScheduleStore, TEMP_SCHEDULE_COLORS
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { TEMP_SCHEDULE_COLORS, type TempScheduleTask } from '@/shared/types/tempSchedule';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import { minutesToTimeStr, timeStrToMinutes } from '@/shared/lib/utils';
import { notify } from '@/shared/lib/notify';

// ============================================================================
// Types
// ============================================================================

export interface InlineEditPopoverProps {
  /** 대상 작업 */
  task: TempScheduleTask;
  /** 팝오버 위치 (앵커 요소 기준) */
  position: { x: number; y: number };
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 저장 완료 핸들러 */
  onSaved?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 인라인 편집 팝오버 컴포넌트
 * @description Day/Week/List 표면에서 빠른 편집을 위한 팝오버
 */
function InlineEditPopoverComponent({
  task,
  position,
  onClose,
  onSaved,
}: InlineEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { updateTask } = useTempScheduleStore();

  const [name, setName] = useState(task.name);
  const [startTimeStr, setStartTimeStr] = useState(minutesToTimeStr(task.startTime));
  const [endTimeStr, setEndTimeStr] = useState(minutesToTimeStr(task.endTime));
  const [color, setColor] = useState(task.color);
  const [isSaving, setIsSaving] = useState(false);

  // 포커스 설정
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 약간의 딜레이
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // ESC 키로 닫기
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

  const handleSave = useCallback(async () => {
    // 유효성 검사
    const trimmedName = name.trim();
    if (!trimmedName) {
      notify.error('이름을 입력해주세요');
      nameInputRef.current?.focus();
      return;
    }

    const startTime = timeStrToMinutes(startTimeStr);
    const endTime = timeStrToMinutes(endTimeStr);

    if (startTime >= endTime) {
      notify.error('종료 시간은 시작 시간보다 늦어야 합니다');
      return;
    }

    setIsSaving(true);
    try {
      await updateTask(task.id, {
        name: trimmedName,
        startTime,
        endTime,
        color,
      });
      notify.success('저장되었습니다');
      onSaved?.();
      onClose();
    } catch (error) {
      notify.error('저장 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsSaving(false);
    }
  }, [name, startTimeStr, endTimeStr, color, task.id, updateTask, onClose, onSaved]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  // 화면 경계 체크
  const adjustedPosition = { ...position };
  if (typeof window !== 'undefined') {
    if (adjustedPosition.y + 300 > window.innerHeight) {
      adjustedPosition.y = Math.max(10, position.y - 300);
    }
    if (adjustedPosition.x + 280 > window.innerWidth) {
      adjustedPosition.x = Math.max(10, position.x - 280);
    }
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-[280px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <span className="text-xs font-bold text-[var(--color-text)]">빠른 편집</span>
        <button
          type="button"
          className="p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      </div>

      {/* 폼 */}
      <div className="p-3 space-y-3">
        {/* 이름 */}
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">
            이름
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="스케줄 이름"
          />
        </div>

        {/* 시간 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">
              시작
            </label>
            <input
              type="time"
              value={startTimeStr}
              onChange={(e) => setStartTimeStr(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">
              종료
            </label>
            <input
              type="time"
              value={endTimeStr}
              onChange={(e) => setEndTimeStr(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>

        {/* 색상 */}
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">
            색상
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TEMP_SCHEDULE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary)] ${
                  color === c
                    ? 'border-white ring-2 ring-white/50'
                    : 'border-white/20'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`색상 ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <span className="text-[9px] text-[var(--color-text-tertiary)]">
          Enter 저장 · ESC 취소
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check size={12} />
            저장
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const InlineEditPopover = memo(InlineEditPopoverComponent);
export default InlineEditPopover;
