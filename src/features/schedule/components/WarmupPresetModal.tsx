/**
 * WarmupPresetModal - 워밍업 세트 설정 모달
 *
 * @role 워밍업 작업 프리셋을 관리하는 모달 컴포넌트
 */

import { useState } from 'react';
import type { WarmupPresetItem } from '@/shared/types/domain';
import { useModalEscapeClose } from '@/shared/hooks';

interface WarmupPresetModalProps {
  preset: WarmupPresetItem[];
  onSave: (preset: WarmupPresetItem[]) => void;
  onApply: (preset: WarmupPresetItem[]) => void;
  onClose: () => void;
}

export function WarmupPresetModal({ preset, onSave, onApply, onClose }: WarmupPresetModalProps) {
  const [draft, setDraft] = useState<WarmupPresetItem[]>(preset);
  useModalEscapeClose(true, onClose);

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
