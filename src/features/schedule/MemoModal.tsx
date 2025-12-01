/**
 * @file MemoModal.tsx
 * @role 메모 내용을 크게 보고 편집할 수 있는 전용 모달
 * @input memo (기존 메모), onSave, onClose
 * @output 전체 화면 메모 편집 모달 UI
 * @dependencies react-dom/createPortal
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface MemoModalProps {
  memo: string;
  onSave: (newMemo: string) => void;
  onClose: () => void;
}

/**
 * 메모 내용을 전체화면으로 보고 편집할 수 있는 모달 컴포넌트
 * @param props - 모달 프로퍼티
 * @param props.memo - 기존 메모 내용
 * @param props.onSave - 메모 저장 시 호출되는 콜백 함수
 * @param props.onClose - 모달 닫기 시 호출되는 콜백 함수
 * @returns 전체 화면 메모 편집 모달 UI
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <h2 className="text-lg font-bold text-[var(--color-text)]">메모 편집</h2>
          </div>
          <button
            className="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
            onClick={handleCancel}
            aria-label="닫기"
          >
            <span>닫기</span>
            <kbd className="hidden rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-sans text-[var(--color-text-tertiary)] shadow-sm group-hover:text-[var(--color-text-secondary)] sm:inline-block">ESC</kbd>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6">
          <textarea
            ref={textareaRef}
            className="h-[60vh] w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-base leading-relaxed text-[var(--color-text)] shadow-inner transition-all focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            placeholder="자유롭게 메모를 작성하세요..."
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <span className="flex items-center gap-1 rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5">
                <span className="font-sans">Ctrl</span> + <span className="font-sans">Enter</span>
              </span>
              <span>저장</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
                onClick={handleCancel}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-[var(--color-primary-dark)] hover:scale-105 hover:shadow-indigo-500/40 active:scale-95"
                onClick={handleSave}
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
