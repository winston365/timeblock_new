/**
 * TimerConfirmModal
 *
 * @role 타이머 사용 여부를 확인하는 Tailwind 기반 모달
 */

import { createPortal } from 'react-dom';

interface TimerConfirmModalProps {
  taskName: string;
  onConfirm: (timerUsed: boolean) => void;
}

export function TimerConfirmModal({ taskName, onConfirm }: TimerConfirmModalProps) {
  const handleOverlayClick = () => {
    onConfirm(false);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 py-8 text-[var(--color-text)] backdrop-blur"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">⏱️ 타이머 사용 확인</h2>
        </div>

        <div className="space-y-4 px-6 py-6 text-sm text-[var(--color-text-secondary)]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-base font-semibold text-[var(--color-text)]">
            “{taskName}”
          </div>
          <p className="text-center text-sm">
            방금 완료한 작업을 진행할 때 <strong className="text-[var(--color-text)]">집중 타이머</strong>를 사용했나요?
          </p>
          <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 px-4 py-3 text-center text-xs text-indigo-100">
            타이머를 사용하면 <span className="font-semibold text-white">+20 XP 보너스</span>를 받습니다!
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onConfirm(false)}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)] sm:w-auto"
          >
            아니요
          </button>
          <button
            type="button"
            onClick={() => onConfirm(true)}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 sm:w-auto"
          >
            네, 사용했어요!
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
