/**
 * CompletionCelebrationModal
 *
 * @role 타이머 사용 작업 완료 시 화려한 축하 모달 표시
 * @input task (Task) - 완료된 작업 정보
 * @input xpGained (number) - 획득한 총 XP
 * @input timerBonus (number) - 타이머 보너스 XP
 * @input onClose (function) - 모달 닫기 콜백
 * @output 화려한 축하 UI와 애니메이션
 */

import type { Task } from '@/shared/types/domain';

interface CompletionCelebrationModalProps {
  task: Task;
  xpGained: number;
  timerBonus: number;
  onClose: () => void;
}

/**
 * 완료 축하 모달 컴포넌트
 *
 * @param {CompletionCelebrationModalProps} props
 * @returns {JSX.Element} 축하 모달 UI
 */
export function CompletionCelebrationModal({
  task,
  xpGained,
  timerBonus,
  onClose,
}: CompletionCelebrationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div
        className="relative bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm rounded-2xl shadow-2xl max-w-[600px] w-[90vw] flex flex-col overflow-hidden border-2 border-primary/30"
        onClick={e => e.stopPropagation()}
      >
        {/* 배경 애니메이션 효과 - 간단한 glow 효과 */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 animate-pulse pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center p-lg border-b border-primary/20">
          <h2 className="text-2xl font-bold text-text text-center">🎉 완벽한 몰입! 🎉</h2>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-lg p-xl">
          <div className="flex flex-col items-center gap-sm px-lg py-md bg-primary/20 rounded-full border-2 border-primary/40 shadow-lg">
            <div className="text-4xl">⏱️</div>
            <div className="text-sm font-semibold text-primary">타이머 마스터</div>
          </div>

          <div className="text-lg font-semibold text-text text-center">"{task.text}"</div>

          <div className="text-base text-text-secondary text-center">
            와! 완전 몰입했네요!<br />
            정말 멋져요! 💖
          </div>

          <div className="w-full flex flex-col gap-sm p-md bg-bg-surface/80 rounded-lg border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">기본 XP</span>
              <span className="text-text font-semibold">+{xpGained - timerBonus}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-primary font-medium">⏱️ 타이머 보너스</span>
              <span className="text-primary font-bold animate-pulse">+{timerBonus}</span>
            </div>
            <div className="h-px bg-border my-xs"></div>
            <div className="flex justify-between items-center text-base">
              <span className="text-text font-semibold">총 XP</span>
              <span className="text-reward font-bold text-xl">+{xpGained}</span>
            </div>
          </div>

          <div className="text-sm text-text-tertiary text-center">
            이 조자로 계속 힘내세요! 🚀
          </div>
        </div>

        <div className="relative z-10 flex gap-sm p-lg justify-center border-t border-primary/20">
          <button
            type="button"
            className="px-xl py-md bg-gradient-to-r from-primary to-secondary text-white rounded-lg text-base font-bold transition-all hover:scale-105 hover:shadow-xl"
            onClick={onClose}
          >
            감사합니다! ✨
          </button>
        </div>
      </div>
    </div>
  );
}
