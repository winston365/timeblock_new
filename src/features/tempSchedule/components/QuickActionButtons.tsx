/**
 * 임시 스케줄 퀵 액션 버튼
 *
 * @role hover/focus 시 나타나는 빠른 액션 버튼 세트
 * @responsibilities
 *   - 승격(Promote), 삭제(Delete), 색상 변경(Color) 버튼 제공
 *   - 마우스 hover + 키보드 focus 모두 지원
 *   - 접근성(aria-label) 준수
 * @dependencies useTempScheduleStore, TEMP_SCHEDULE_COLORS
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Trash2, Palette } from 'lucide-react';
import { TEMP_SCHEDULE_COLORS, type TempScheduleTask } from '@/shared/types/tempSchedule';

// ============================================================================
// Types
// ============================================================================

export interface QuickActionButtonsProps {
  /** 대상 작업 */
  task: TempScheduleTask;
  /** 승격 핸들러 */
  onPromote: (task: TempScheduleTask) => void;
  /** 삭제 핸들러 */
  onDelete: (taskId: string) => void;
  /** 색상 변경 핸들러 */
  onColorChange: (taskId: string, color: string) => void;
  /** 버튼 크기 */
  size?: 'sm' | 'md';
  /** 레이아웃 방향 */
  direction?: 'horizontal' | 'vertical';
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Color Picker Popover
// ============================================================================

interface ColorPickerPopoverProps {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}

const ColorPickerPopover = memo(function ColorPickerPopover({
  currentColor,
  onSelect,
  onClose,
}: ColorPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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

  return (
    <div
      ref={ref}
      className="absolute z-[100] p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-4 gap-1.5">
        {TEMP_SCHEDULE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary)] ${
              currentColor === color
                ? 'border-white ring-2 ring-white/50'
                : 'border-white/20'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => {
              onSelect(color);
              onClose();
            }}
            aria-label={`색상 ${color}로 변경`}
          />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 퀵 액션 버튼 컴포넌트
 * @description Day/Week/List 표면에서 hover/focus 시 나타나는 빠른 액션 버튼
 */
function QuickActionButtonsComponent({
  task,
  onPromote,
  onDelete,
  onColorChange,
  size = 'sm',
  direction = 'horizontal',
  className = '',
}: QuickActionButtonsProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handlePromote = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPromote(task);
    },
    [task, onPromote]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete(task.id);
    },
    [task.id, onDelete]
  );

  const handleColorToggle = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowColorPicker((prev) => !prev);
    },
    []
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      onColorChange(task.id, color);
    },
    [task.id, onColorChange]
  );

  const buttonSize = size === 'sm' ? 'p-1' : 'p-1.5';
  const iconSize = size === 'sm' ? 14 : 16;

  const containerClass =
    direction === 'horizontal'
      ? 'flex items-center gap-0.5'
      : 'flex flex-col items-center gap-0.5';

  return (
    <div
      className={`${containerClass} ${className}`}
      role="group"
      aria-label="빠른 액션"
    >
      {/* 승격 버튼 */}
      <button
        type="button"
        className={`${buttonSize} rounded hover:bg-[var(--color-primary)]/20 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50`}
        onClick={handlePromote}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handlePromote(e);
        }}
        aria-label="실제 작업으로 승격"
        title="실제 작업으로 승격"
      >
        <Sparkles size={iconSize} />
      </button>

      {/* 색상 변경 버튼 */}
      <div className="relative">
        <button
          type="button"
          className={`${buttonSize} rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50`}
          onClick={handleColorToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleColorToggle(e);
          }}
          aria-label="색상 변경"
          aria-expanded={showColorPicker}
          title="색상 변경"
        >
          <Palette size={iconSize} />
        </button>

        {showColorPicker && (
          <ColorPickerPopover
            currentColor={task.color}
            onSelect={handleColorSelect}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </div>

      {/* 삭제 버튼 */}
      <button
        type="button"
        className={`${buttonSize} rounded hover:bg-red-500/20 text-[var(--color-text-tertiary)] hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50`}
        onClick={handleDelete}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleDelete(e);
        }}
        aria-label="삭제"
        title="삭제"
      >
        <Trash2 size={iconSize} />
      </button>
    </div>
  );
}

export const QuickActionButtons = memo(QuickActionButtonsComponent);
export default QuickActionButtons;
