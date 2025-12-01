/**
 * GoalModal.tsx
 *
 * @file 목표 생성/수정 모달 컴포넌트
 * @description
 *   - Role: 사용자가 새로운 목표를 생성하거나 기존 목표를 수정할 수 있는 모달 UI 제공
 *   - Responsibilities:
 *     - 목표 이름, 시간, 아이콘, 색상 입력 폼 관리
 *     - 프리셋 목표 빠른 선택 기능
 *     - 목표 저장 (생성/수정) 처리
 *   - Key Dependencies:
 *     - useGoalStore: 목표 상태 관리 및 CRUD 액션
 *     - DailyGoal: 목표 도메인 타입
 */

import { useState, useEffect } from 'react';
import { useGoalStore } from '@/shared/stores/goalStore';
import type { DailyGoal } from '@/shared/types/domain';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: DailyGoal;
  onSaved?: () => void;
}

const GOAL_PRESETS = [
  { title: '독서', icon: '📚', color: '#6366f1', minutes: 30 },
  { title: '운동', icon: '💪', color: '#ef4444', minutes: 60 },
  { title: '공부', icon: '✏️', color: '#f59e0b', minutes: 120 },
  { title: '코딩', icon: '💻', color: '#10b981', minutes: 180 },
  { title: '명상', icon: '🧘', color: '#8b5cf6', minutes: 15 },
  { title: '청소', icon: '🧹', color: '#06b6d4', minutes: 30 },
];

const GOAL_ICONS = ['💡', '📚', '🧠', '📝', '🧘', '🏋️', '🧹', '🧾', '📖', '💻', '🎧', '📈', '🎨', '🎸', '🍳', '💤'];
const GOAL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b', '#f43f5e'];

/**
 * 목표 생성/수정 모달 컴포넌트
 *
 * @param {GoalModalProps} props - 모달 속성
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {() => void} props.onClose - 모달 닫기 콜백
 * @param {DailyGoal} [props.goal] - 수정할 기존 목표 (없으면 생성 모드)
 * @param {() => void} [props.onSaved] - 저장 완료 후 콜백
 * @returns {JSX.Element | null} 모달 컴포넌트 또는 null
 */
export default function GoalModal({ isOpen, onClose, goal, onSaved }: GoalModalProps) {
  const isEditMode = !!goal;
  const { addGoal, updateGoal } = useGoalStore();
  const [title, setTitle] = useState('');
  const [targetHours, setTargetHours] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [selectedIcon, setSelectedIcon] = useState('💡');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setTargetHours(Math.floor(goal.targetMinutes / 60));
      setTargetMinutes(goal.targetMinutes % 60);
      setSelectedIcon(goal.icon || '💡');
      setSelectedColor(goal.color || '#6366f1');
    } else {
      // Reset for new goal
      setTitle('');
      setTargetHours(0);
      setTargetMinutes(30);
      setSelectedIcon('💡');
      setSelectedColor('#6366f1');
    }
  }, [goal, isOpen]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, saving, onClose]);

  const handlePresetClick = (preset: typeof GOAL_PRESETS[0]) => {
    setTitle(preset.title);
    setSelectedIcon(preset.icon);
    setSelectedColor(preset.color);
    setTargetHours(Math.floor(preset.minutes / 60));
    setTargetMinutes(preset.minutes % 60);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('목표 이름을 입력해 주세요.');
      return;
    }

    const totalMinutes = targetHours * 60 + targetMinutes;
    if (totalMinutes <= 0) {
      alert('목표 시간은 1분 이상이어야 합니다.');
      return;
    }

    try {
      setSaving(true);
      const goalData = {
        title: title.trim(),
        targetMinutes: totalMinutes,
        icon: selectedIcon,
        color: selectedColor,
      };

      if (isEditMode && goal) {
        await updateGoal(goal.id, goalData);
      } else {
        await addGoal(goalData);
      }
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('[GoalModal] Failed to save goal:', error);
      alert('목표 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all";
  const labelClass = "text-xs font-bold text-[var(--color-text-secondary)] mb-1 block";

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {isEditMode ? '목표 수정' : '새 목표 추가'}
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">✕</button>
        </div>

        <div className="flex flex-col gap-5 p-5">

          {/* Presets (New Goal Only) */}
          {!isEditMode && (
            <div>
              <label className={labelClass}>빠른 선택</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-base)]"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className={labelClass}>목표 이름</label>
            <div className="flex gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] text-xl">
                {selectedIcon}
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 책 읽기, 운동하기"
                className={inputClass}
                autoFocus
              />
            </div>
          </div>

          {/* Time Input */}
          <div>
            <label className={labelClass}>목표 시간</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={targetHours}
                  onChange={(e) => setTargetHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className={inputClass}
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--color-text-tertiary)]">시간</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className={inputClass}
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--color-text-tertiary)]">분</span>
              </div>
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className={labelClass}>아이콘</label>
            <div className="grid grid-cols-8 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`flex aspect-square items-center justify-center rounded-lg text-lg transition ${selectedIcon === icon
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'hover:bg-[var(--color-bg-elevated)]'
                    }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className={labelClass}>색상</label>
            <div className="flex flex-wrap gap-3">
              {GOAL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-bg-surface)]' : ''
                    }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-base)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
          >
            {saving ? '저장 중...' : '완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
