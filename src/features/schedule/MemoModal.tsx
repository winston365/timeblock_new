/**
 * MemoModal
 *
 * @role 메모 내용을 크게 보고 편집할 수 있는 전용 모달
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface MemoModalProps {
  memo: string;
  onSave: (newMemo: string) => void;
  onClose: () => void;
}

/**
 * 메모 모달 컴포넌트 (Tailwind 기반 스타일)
 */
export function MemoModal({ memo, onSave, onClose }: MemoModalProps) {
  const [editedMemo, setEditedMemo] = useState(memo);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const length = editedMemo.length;
    textareaRef.current?.setSelectionRange(length, length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, editedMemo]);

  const handleSave = () => {
    onSave(editedMemo);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">📝 메모 편집</h2>
          <button
            className="rounded-full p-2 text-base text-[var(--color-text-secondary)] transition hover:bg-white/5 hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            onClick={handleCancel}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          <textarea
            ref={textareaRef}
            className="h-72 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)]/90 p-4 text-sm text-[var(--color-text)] shadow-inner transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            placeholder="메모를 입력해주세요..."
            rows={15}
          />
          <p className="text-center text-xs text-[var(--color-text-tertiary)]">💡 Ctrl+Enter로 저장 | ESC로 닫기</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)] sm:w-auto"
            onClick={handleCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 sm:w-auto"
            onClick={handleSave}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
