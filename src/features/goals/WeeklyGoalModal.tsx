/**
 * WeeklyGoalModal.tsx
 *
 * @file 장기목표(주간목표) 추가/수정 모달
 * @description
 *   - Role: 새로운 장기목표를 생성하거나 기존 목표를 수정하는 모달 UI
 *   - Responsibilities:
 *     - 목표 제목, 목표 숫자, 단위 입력
 *     - 아이콘, 색상 선택
 *     - 목표 저장 (생성/수정)
 *   - Key Dependencies:
 *     - useWeeklyGoalStore: 장기목표 상태 관리
 *     - WeeklyGoal: 도메인 타입
 */

import { useState, useEffect } from 'react';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import type { WeeklyGoal } from '@/shared/types/domain';
import { useModalHotkeys } from '@/shared/hooks';
import { GOAL_THEME_PRESETS } from './constants/goalConstants';

interface WeeklyGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: WeeklyGoal;
  onSaved?: () => void;
}

/** 모달 단계 (T20: 2단계 UI) */
type ModalStep = 'basic' | 'advanced';

const GOAL_ICONS = ['📚', '💪', '✏️', '💻', '🧘', '🎯', '📖', '🏃', '🎨', '🎸', '🗣️', '💼', '🧠', '📝', '🎧', '🔬'];
const GOAL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b', '#f43f5e'];

const UNIT_PRESETS = ['개', '페이지', '분', '시간', '문제', '단어', '회', 'km', '세트', '챕터'];

/**
 * 장기목표 추가/수정 모달 컴포넌트
 */
export default function WeeklyGoalModal({ isOpen, onClose, goal, onSaved }: WeeklyGoalModalProps) {
  const isEditMode = !!goal;
  const { addGoal, updateGoal } = useWeeklyGoalStore();

  // T20: 모달 단계 상태
  const [step, setStep] = useState<ModalStep>('basic');

  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(100);
  const [unit, setUnit] = useState('개');
  const [selectedIcon, setSelectedIcon] = useState('📚');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  // T18-T19: 테마 상태
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [customTheme, setCustomTheme] = useState('');
  const [saving, setSaving] = useState(false);
  // 우선순위 상태
  const [priority, setPriority] = useState<number | ''>('');

  const handleEscapeClose = () => {
    if (saving) return;
    // T20: 고급 단계에서 ESC 누르면 기본 단계로 돌아가기
    if (step === 'advanced') {
      setStep('basic');
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setTarget(goal.target);
      setUnit(goal.unit);
      setSelectedIcon(goal.icon || '📚');
      setSelectedColor(goal.color || '#6366f1');
      // T18: 테마 로드
      setSelectedTheme(goal.theme ?? null);
      setCustomTheme('');
      // 우선순위 로드
      setPriority(goal.priority ?? '');
    } else {
      setTitle('');
      setTarget(100);
      setUnit('개');
      setSelectedIcon('📚');
      setSelectedColor('#6366f1');
      setSelectedTheme(null);
      setCustomTheme('');
      setPriority(''); // 새 목표는 비워두면 자동 계산
    }
    // T20: 모달 열릴 때 기본 단계로 리셋
    setStep('basic');
  }, [goal, isOpen]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('목표 이름을 입력해 주세요.');
      return;
    }
    if (target <= 0) {
      alert('목표 숫자는 1 이상이어야 합니다.');
      return;
    }
    if (!unit.trim()) {
      alert('단위를 입력해 주세요.');
      return;
    }

    try {
      setSaving(true);
      // T18: 테마 결정 (커스텀 우선)
      const finalTheme = customTheme.trim() || selectedTheme || undefined;
      // 우선순위 결정 (빈 값이면 undefined로 자동 계산 위임)
      const finalPriority = priority !== '' ? priority : undefined;
      
      const goalData = {
        title: title.trim(),
        target,
        unit: unit.trim(),
        icon: selectedIcon,
        color: selectedColor,
        theme: finalTheme,
        priority: finalPriority,
      };

      if (isEditMode && goal) {
        await updateGoal(goal.id, goalData);
      } else {
        await addGoal(goalData);
      }
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('[WeeklyGoalModal] Failed to save goal:', error);
      alert('목표 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  useModalHotkeys({
    isOpen,
    onEscapeClose: handleEscapeClose,
    primaryAction: {
      enabled: !saving,
      onPrimary: handleSave,
    },
  });

  if (!isOpen) return null;

  const inputClass = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all";
  const labelClass = "text-xs font-bold text-[var(--color-text-secondary)] mb-1 block";

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">
              {isEditMode ? '장기목표 수정' : '새 장기목표 추가'}
            </h2>
            {/* T20: 단계 표시 */}
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {step === 'basic' ? '기본 정보' : '고급 설정'}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">✕</button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* T20: 기본 단계 */}
          {step === 'basic' && (
            <>
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
                    placeholder="예: 토익 단어 암기"
                    className={inputClass}
                    autoFocus
                  />
                </div>
              </div>

              {/* Target & Unit */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass}>목표 숫자</label>
                  <input
                    type="number"
                    min="1"
                    value={target}
                    onChange={(e) => setTarget(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClass}
                  />
                </div>
                <div className="w-24">
                  <label className={labelClass}>단위</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="개"
                    className={inputClass}
                    list="unit-presets"
                  />
                  <datalist id="unit-presets">
                    {UNIT_PRESETS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
                <div className="w-20">
                  <label className={labelClass}>우선순위</label>
                  <input
                    type="number"
                    min="1"
                    value={priority}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPriority(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                    }}
                    placeholder="자동"
                    className={inputClass}
                    title="낮을수록 먼저 표시됩니다"
                  />
                </div>
              </div>

              {/* Unit Presets */}
              <div>
                <label className={labelClass}>단위 빠른 선택</label>
                <div className="flex flex-wrap gap-2">
                  {UNIT_PRESETS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        unit === u
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* T20: 고급 설정으로 이동 버튼 */}
              <button
                type="button"
                onClick={() => setStep('advanced')}
                className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition"
              >
                <span>⚙️</span>
                <span>고급 설정 (아이콘, 색상, 테마)</span>
                <span>→</span>
              </button>
            </>
          )}

          {/* T20: 고급 단계 */}
          {step === 'advanced' && (
            <>
              {/* Icon Picker */}
              <div>
                <label className={labelClass}>아이콘</label>
                <div className="grid grid-cols-8 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3">
                  {GOAL_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`flex aspect-square items-center justify-center rounded-lg text-lg transition ${
                        selectedIcon === icon
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
                      className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                        selectedColor === color ? 'ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-bg-surface)]' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* T18-T19: 테마 선택 */}
              <div>
                <label className={labelClass}>테마 (카테고리)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {/* 테마 없음 옵션 */}
                  <button
                    type="button"
                    onClick={() => { setSelectedTheme(null); setCustomTheme(''); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      !selectedTheme && !customTheme
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'
                    }`}
                  >
                    없음
                  </button>
                  {/* 프리셋 테마들 */}
                  {GOAL_THEME_PRESETS.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => { setSelectedTheme(theme.id); setCustomTheme(''); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedTheme === theme.id && !customTheme
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
                {/* 커스텀 테마 입력 */}
                <input
                  type="text"
                  value={customTheme}
                  onChange={(e) => { setCustomTheme(e.target.value); setSelectedTheme(null); }}
                  placeholder="또는 직접 입력 (예: 프로젝트명)"
                  className={inputClass}
                />
              </div>

              {/* T20: 기본 설정으로 돌아가기 버튼 */}
              <button
                type="button"
                onClick={() => setStep('basic')}
                className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
              >
                <span>←</span>
                <span>기본 설정으로 돌아가기</span>
              </button>
            </>
          )}

          {/* Week Info */}
          <div className="rounded-lg bg-[var(--color-bg-base)] p-3 text-xs text-[var(--color-text-secondary)]">
            <p>📅 장기목표는 매주 월요일에 자동으로 초기화됩니다.</p>
            <p className="mt-1">목표: 이번 주 일요일까지 <strong className="text-[var(--color-text)]">{target}{unit}</strong> 달성</p>
            {/* T18: 선택된 테마 표시 */}
            {(selectedTheme || customTheme) && (
              <p className="mt-1">
                테마: <strong className="text-[var(--color-primary)]">
                  {customTheme || GOAL_THEME_PRESETS.find(t => t.id === selectedTheme)?.label || selectedTheme}
                </strong>
              </p>
            )}
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
