/**
 * WarmupPresetModal - 워밍업 세트 설정 모달
 *
 * @role 워밍업 작업 프리셋을 관리하는 모달 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { WarmupPresetItem } from '@/shared/types/domain';
import { useModalHotkeys } from '@/shared/hooks';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { SYSTEM_STATE_DEFAULTS } from '@/shared/constants/defaults';

interface WarmupPresetModalProps {
  preset: WarmupPresetItem[];
  onSave: (preset: WarmupPresetItem[]) => void;
  onApply: (preset: WarmupPresetItem[]) => void;
  onClose: () => void;
  /** 토글 변경 시 외부로 알림 (ScheduleView 상태 동기화용) */
  onAutoGenerateToggle?: (enabled: boolean) => void;
}

export function WarmupPresetModal({ preset, onSave, onApply, onClose, onAutoGenerateToggle }: WarmupPresetModalProps) {
  const [draft, setDraft] = useState<WarmupPresetItem[]>(preset);
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState<boolean>(
    SYSTEM_STATE_DEFAULTS.warmupAutoGenerateEnabled
  );

  // Dexie systemState에서 자동생성 설정 로드
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storedValue = await getSystemState<boolean>(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED);
        if (mounted && storedValue !== undefined) {
          setAutoGenerateEnabled(storedValue);
        }
      } catch (error) {
        console.error('Failed to load warmup auto-generate setting:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAutoGenerateToggle = async () => {
    const newValue = !autoGenerateEnabled;
    setAutoGenerateEnabled(newValue);
    try {
      await setSystemState(SYSTEM_KEYS.WARMUP_AUTO_GENERATE_ENABLED, newValue);
      onAutoGenerateToggle?.(newValue);
    } catch (error) {
      console.error('Failed to save warmup auto-generate setting:', error);
      // 저장 실패 시 UI 롤백
      setAutoGenerateEnabled(!newValue);
    }
  };

  const handleChange = (index: number, field: keyof WarmupPresetItem, value: string) => {
    setDraft(prev =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            [field]: field === 'baseDuration' ? Math.max(1, Number(value) || 1) : value,
          }
          : item,
      ),
    );
  };

  const handleAddRow = () => {
    setDraft(prev => [...prev, { text: '', baseDuration: 5, resistance: 'low' }]);
  };

  const handleRemoveRow = (index: number) => {
    setDraft(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => onSave(draft.filter(item => item.text.trim()));
  const handleApply = () => onApply(draft.filter(item => item.text.trim()));

  useModalHotkeys({
    isOpen: true,
    onEscapeClose: onClose,
    primaryAction: {
      onPrimary: handleApply,
    },
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">워밍업 세트 설정</h3>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              자주 쓸 3개 내외의 짧은 작업을 정리해두고 필요할 때 바로 넣어.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            ✕
          </button>
        </div>

        {/* 자동생성 토글 섹션 */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3 bg-[var(--color-bg-surface)]">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--color-text)]">자동 삽입</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              매 시간 50분에 다음 시간대로 워밍업 작업 자동 추가
            </span>
          </div>
          <button
            type="button"
            onClick={handleAutoGenerateToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ${
              autoGenerateEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)]'
            }`}
            role="switch"
            aria-checked={autoGenerateEnabled}
            aria-label="워밍업 자동 삽입 토글"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autoGenerateEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {draft.map((item, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
              >
                <span className="text-xs text-[var(--color-text-tertiary)]">#{index + 1}</span>
                <input
                  type="text"
                  value={item.text}
                  onChange={e => handleChange(index, 'text', e.target.value)}
                  placeholder="예: 책상 정리"
                  className="min-w-[140px] flex-1 rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)]"
                />
                <select
                  value={item.baseDuration}
                  onChange={e => handleChange(index, 'baseDuration', e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)]"
                >
                  {[5, 10, 15, 20, 25, 30].map(min => (
                    <option key={min} value={min}>
                      {min}분
                    </option>
                  ))}
                </select>
                <select
                  value={item.resistance}
                  onChange={e => handleChange(index, 'resistance', e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)]"
                >
                  <option value="low">저항 낮음</option>
                  <option value="medium">중간</option>
                  <option value="high">높음</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  className="rounded-full px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              + 행 추가
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            저장
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.25)] hover:opacity-90"
          >
            다음 블록에 적용
          </button>
        </div>
      </div>
    </div>
  );
}
