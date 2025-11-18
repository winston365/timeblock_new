/**
 * LevelUpNotification
 *
 * @role 레벨업 시 표시되는 축하 알림 모달
 * @input level (새로운 레벨), onClose (닫기 핸들러)
 * @output 레벨업 애니메이션 모달
 * @external_dependencies 없음
 */

interface LevelUpNotificationProps {
  level: number;
  onClose: () => void;
}

/**
 * 레벨업 알림 모달
 *
 * @param {LevelUpNotificationProps} props - 컴포넌트 props
 * @returns {JSX.Element} 레벨업 모달
 */
export default function LevelUpNotification({ level, onClose }: LevelUpNotificationProps) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-8 py-10 text-center shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="animate-bounce text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">레벨 업!</h2>
          <div className="flex items-center justify-center gap-2 rounded-full border border-[var(--color-primary)] bg-[rgba(99,102,241,0.15)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[var(--color-primary)]">
            <span>LEVEL</span>
            <span className="text-lg">{level}</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            축하합니다! 레벨 {level}에 도달했습니다!
          </p>
          <button
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
