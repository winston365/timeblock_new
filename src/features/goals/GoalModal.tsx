import { useState, useEffect } from 'react';
import { addGlobalGoal, updateGlobalGoal } from '@/data/repositories/globalGoalRepository';
import type { DailyGoal } from '@/shared/types/domain';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: DailyGoal;
  onSaved?: () => void;
}

const GOAL_ICONS = ['💡', '📚', '🧠', '📝', '🧘', '🏋️', '🧹', '🧾', '📖', '💻', '🎧', '📈'];
const GOAL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function GoalModal({ isOpen, onClose, goal, onSaved }: GoalModalProps) {
  const isEditMode = !!goal;
  const [title, setTitle] = useState('');
  const [targetHours, setTargetHours] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState('💡');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      const hours = Math.floor(goal.targetMinutes / 60);
      const mins = goal.targetMinutes % 60;
      setTargetHours(hours);
      setTargetMinutes(mins);
      setSelectedIcon(goal.icon || '💡');
      setSelectedColor(goal.color || '#6366f1');
    } else {
      setTitle('');
      setTargetHours(0);
      setTargetMinutes(0);
      setSelectedIcon('💡');
      setSelectedColor('#6366f1');
    }
  }, [goal, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, saving, onClose]);

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
      if (isEditMode && goal) {
        await updateGlobalGoal(goal.id, {
          title: title.trim(),
          targetMinutes: totalMinutes,
          icon: selectedIcon,
          color: selectedColor,
        });
      } else {
        await addGlobalGoal({
          title: title.trim(),
          targetMinutes: totalMinutes,
          icon: selectedIcon,
          color: selectedColor,
        });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">{isEditMode ? '목표 수정' : '새 목표 추가'}</h2>
          <button
            type="button"
            className="rounded-full border border-transparent p-2 text-[var(--color-text-secondary)] transition hover:border-[var(--color-border)]"
            onClick={onClose}
            disabled={saving}
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="goal-title">목표 이름 *</label>
            <input
              id="goal-title"
              type="text"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              placeholder="새 책 읽기, 프로젝트 진행 등"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text)]">목표 시간 *</label>
            <div className="flex gap-3">
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  value={targetHours || ''}
                  onChange={(e) => setTargetHours(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={saving}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">시간</span>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  value={targetMinutes || ''}
                  onChange={(e) => setTargetMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  disabled={saving}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">분</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text)]">아이콘</label>
            <div className="grid grid-cols-6 gap-2">
              {GOAL_ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  className={`rounded-lg border px-2 py-2 text-lg transition ${
                    selectedIcon === icon
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                  }`}
                  onClick={() => setSelectedIcon(icon)}
                  disabled={saving}
                  aria-label={`아이콘 ${icon} 선택`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text)]">색상</label>
            <div className="grid grid-cols-8 gap-2">
              {GOAL_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`h-9 rounded-full border-2 transition ${
                    selectedColor === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  disabled={saving}
                  aria-label={`색상 ${color} 선택`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : isEditMode ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
