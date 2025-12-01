/**
 * @file CompletionCelebrationModal.tsx
 * @role 집중 타이머를 성공적으로 마쳤을 때 축하 UI를 표시
 * @input task, xpGained, timerBonus, onClose
 * @output 축하 메시지와 XP 획득 정보를 보여주는 모달 UI
 * @dependencies react-dom/createPortal, Task 타입
 */

import { createPortal } from 'react-dom';
import type { Task } from '@/shared/types/domain';

interface CompletionCelebrationModalProps {
  task: Task;
  xpGained: number;
  timerBonus: number;
  onClose: () => void;
}

export function CompletionCelebrationModal({
  task,
  xpGained,
  timerBonus,
  onClose,
}: CompletionCelebrationModalProps) {
  const modalContent = (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 px-4 py-8 text-[var(--color-text)] backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81] p-1 shadow-[0_25px_60px_rgba(59,7,100,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 animate-[pulse_8s_ease-in-out_infinite] bg-[radial-gradient(circle,rgba(96,165,250,0.1),transparent)]" />
        <div className="relative rounded-[28px] border border-white/10 bg-black/30 p-8 backdrop-blur-lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-indigo-100">
              Focus Master
            </div>
            <h2 className="text-3xl font-bold text-white">완벽한 집중 성공! ✨</h2>
            <p className="text-sm text-indigo-100">“{task.text}”</p>
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-indigo-100 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">기본 XP</p>
              <p className="text-2xl font-bold text-white">+{xpGained - timerBonus}</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/40 bg-fuchsia-500/10 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200">타이머 보너스</p>
              <p className="text-2xl font-bold text-white">+{timerBonus}</p>
            </div>
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-white/20 bg-black/40 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-200">총 획득 XP</p>
                <p className="text-4xl font-extrabold text-white">+{xpGained}</p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-indigo-100">
            이 열정을 계속 이어가요! 🚀
          </p>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              계속 달리기
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
